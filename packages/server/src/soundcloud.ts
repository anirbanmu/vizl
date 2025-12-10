import { Cache } from './utils/cache.js';
import { Limiter } from './utils/limiter.js';
import type { Track } from '@vizl/common/track.js';

const SOUNDCLOUD_API_BASE_URL = 'https://api.soundcloud.com';
const SOUNDCLOUD_OAUTH_TOKEN_URL = `${SOUNDCLOUD_API_BASE_URL}/oauth2/token`;
const SOUNDCLOUD_RESOLVE_URL = `${SOUNDCLOUD_API_BASE_URL}/resolve`;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export interface SoundcloudClientInterface {
  resolve(url: string): Promise<Track>;
}

export interface SoundcloudClientCredentials {
  clientId: string;
  clientSecret: string;
}

interface SoundcloudClientCredentialsToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

interface SoundcloudTrackResponse {
  stream_url: string;
  permalink_url: string;
  title: string;
  artwork_url: string | null;
  user: {
    username: string;
    permalink_url: string;
  };
}

export class SoundcloudApiError extends Error {
  constructor(public readonly status: number) {
    super(`SoundCloud API error: ${status}`);
    Object.setPrototypeOf(this, SoundcloudApiError.prototype);
  }
}

export class SoundcloudClient implements SoundcloudClientInterface {
  private static InternalClient = class {
    private readonly headers: HeadersInit;

    constructor(accessToken: string) {
      this.headers = {
        Authorization: `OAuth ${accessToken}`,
      };
    }

    async resolve(url: string): Promise<SoundcloudTrackResponse> {
      const resolveUrl = new URL(SOUNDCLOUD_RESOLVE_URL);
      resolveUrl.searchParams.set('url', url);

      const response = await fetch(resolveUrl.toString(), {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new SoundcloudApiError(response.status);
      }

      return (await response.json()) as SoundcloudTrackResponse;
    }

    async getStreamUrl(streamUrl: string): Promise<string> {
      const streamResponse = await fetch(streamUrl, {
        headers: this.headers,
        redirect: 'manual',
      });

      if (streamResponse.status !== 302) {
        throw new SoundcloudApiError(streamResponse.status);
      }

      const location = streamResponse.headers.get('location');
      if (!location) {
        throw new SoundcloudApiError(streamResponse.status);
      }

      return location;
    }
  };

  private readonly clientId: string;
  private readonly clientSecret: string;
  private tokenState: TokenState | null = null;
  private internalClient: InstanceType<typeof SoundcloudClient.InternalClient> | null = null;

  private constructor(credentials: SoundcloudClientCredentials) {
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
  }

  static async create(credentials: SoundcloudClientCredentials): Promise<SoundcloudClient> {
    const instance = new SoundcloudClient(credentials);
    await instance.ensureAccessToken();
    return instance;
  }

  static async getClientCredentialsToken(
    clientId: string,
    clientSecret: string,
  ): Promise<SoundcloudClientCredentialsToken> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });

    const response = await fetch(SOUNDCLOUD_OAUTH_TOKEN_URL, {
      method: 'POST',
      body,
    });

    if (!response.ok) {
      throw new SoundcloudApiError(response.status);
    }

    const token = (await response.json()) as SoundcloudClientCredentialsToken;
    return token;
  }

  private async ensureAccessToken(): Promise<void> {
    const needsRefresh = !this.tokenState || Date.now() >= this.tokenState.expiresAt - TOKEN_REFRESH_BUFFER_MS;

    if (!needsRefresh) {
      return;
    }

    console.log('Refreshing SoundCloud access token');

    const tokenResponse = await SoundcloudClient.getClientCredentialsToken(this.clientId, this.clientSecret);

    this.tokenState = {
      accessToken: tokenResponse.access_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    };

    this.internalClient = new SoundcloudClient.InternalClient(this.tokenState.accessToken);
  }

  async resolve(url: string): Promise<Track> {
    await this.ensureAccessToken();

    if (!this.internalClient) {
      throw new Error('Internal client not initialized');
    }

    const trackData = await this.internalClient.resolve(url);
    const streamUrl = await this.internalClient.getStreamUrl(trackData.stream_url);

    return {
      streamUrl,
      url: trackData.permalink_url,
      title: trackData.title,
      artwork: trackData.artwork_url,
      user: {
        name: trackData.user.username,
        profile: trackData.user.permalink_url,
      },
    };
  }
}

export class CachedSoundcloudClient implements SoundcloudClientInterface {
  constructor(
    private readonly client: SoundcloudClientInterface,
    private readonly cache: Cache<Track | null> = new Cache<Track | null>(60 * 60 * 1000, 10 * 60 * 1000),
  ) {}

  async resolve(url: string): Promise<Track> {
    const cached = this.cache.get(url);

    if (cached !== undefined) {
      if (cached === null) {
        throw new Error('SoundCloud track resolution failed (cached error)');
      }
      return cached;
    }

    try {
      const result = await this.client.resolve(url);
      this.cache.set(url, result);
      return result;
    } catch (error) {
      this.cache.set(url, null);
      throw error;
    }
  }
}

export class ConcurrencyLimitedSoundcloudClient implements SoundcloudClientInterface {
  private readonly limiter: Limiter;

  constructor(
    private readonly client: SoundcloudClientInterface,
    private readonly concurrency: number = 10,
  ) {
    this.limiter = new Limiter(concurrency);
  }

  async resolve(url: string): Promise<Track> {
    return this.limiter.run(() => this.client.resolve(url));
  }
}
