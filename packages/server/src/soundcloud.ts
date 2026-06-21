import { Cache } from './utils/cache.js';
import { Limiter } from './utils/limiter.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { isDev } from './env.js';
import type { Track } from '@vizl/common/track.js';

const SOUNDCLOUD_API_BASE_URL = 'https://api.soundcloud.com';
const SOUNDCLOUD_OAUTH_TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';
const SOUNDCLOUD_RESOLVE_URL = `${SOUNDCLOUD_API_BASE_URL}/resolve`;

function soundcloudStreamsUrl(id: number): string {
  return `${SOUNDCLOUD_API_BASE_URL}/tracks/${id}/streams`;
}

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_CACHE_FILE = path.resolve(process.cwd(), '../../.soundcloud-token.json');

export interface SoundcloudClientInterface {
  resolve(url: string): Promise<Track>;
  resolveMetadata(url: string): Promise<SoundcloudTrackResponse>;
  getStreamUrl(id: number): Promise<string>;
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

export interface SoundcloudTrackResponse {
  id: number;
  stream_url: string;
  permalink_url: string;
  title: string;
  artwork_url: string | null;
  user: {
    username: string;
    permalink_url: string;
  };
}

export interface SoundcloudStreamsResponse {
  hls_aac_160_url?: string;
  hls_aac_96_url?: string;
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

    async getStreamUrl(id: number): Promise<string> {
      const response = await fetch(soundcloudStreamsUrl(id), {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new SoundcloudApiError(response.status);
      }

      const streams = (await response.json()) as SoundcloudStreamsResponse;
      const hlsUrl = streams.hls_aac_160_url ?? streams.hls_aac_96_url;

      if (!hlsUrl) {
        throw new Error('soundcloud streams endpoint returned no hls aac variant');
      }

      // hls_aac_*_url is an authenticated api endpoint that 302-redirects to a signed,
      // expiring cdn playlist. resolve it server-side so the browser gets a directly
      // playable url that doesn't require the oauth header.
      const playlistResponse = await fetch(hlsUrl, {
        headers: this.headers,
        redirect: 'manual',
      });

      if (playlistResponse.status !== 302) {
        throw new SoundcloudApiError(playlistResponse.status);
      }

      const playlistUrl = playlistResponse.headers.get('location');
      if (!playlistUrl) {
        throw new Error('soundcloud hls stream did not return a redirect location');
      }

      return playlistUrl;
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
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
    });

    const response = await fetch(SOUNDCLOUD_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        accept: 'application/json; charset=utf-8',
      },
      body,
    });

    if (!response.ok) {
      throw new SoundcloudApiError(response.status);
    }

    const token = (await response.json()) as SoundcloudClientCredentialsToken;
    return token;
  }

  private async ensureAccessToken(): Promise<void> {
    // try to load from cache if in dev and no token state currently
    if (isDev && !this.tokenState) {
      try {
        const cacheData = await fs.readFile(TOKEN_CACHE_FILE, 'utf-8');
        const cached: TokenState = JSON.parse(cacheData);
        // verify it's not expired (or close to expiring)
        if (Date.now() < cached.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
          console.log('Using cached SoundCloud access token');
          this.tokenState = cached;
          this.internalClient = new SoundcloudClient.InternalClient(this.tokenState.accessToken);
          return;
        }
      } catch {
        // ignore cache errors (file not found, invalid json, etc)
      }
    }

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

    if (isDev) {
      try {
        await fs.writeFile(TOKEN_CACHE_FILE, JSON.stringify(this.tokenState, null, 2));
      } catch (e) {
        console.warn('Failed to cache SoundCloud token', e);
      }
    }
  }

  async resolveMetadata(url: string): Promise<SoundcloudTrackResponse> {
    await this.ensureAccessToken();

    if (!this.internalClient) {
      throw new Error('Internal client not initialized');
    }

    return this.internalClient.resolve(url);
  }

  async getStreamUrl(id: number): Promise<string> {
    await this.ensureAccessToken();

    if (!this.internalClient) {
      throw new Error('Internal client not initialized');
    }

    return this.internalClient.getStreamUrl(id);
  }

  async resolve(url: string): Promise<Track> {
    const trackData = await this.resolveMetadata(url);
    const streamUrl = await this.getStreamUrl(trackData.id);

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
    private readonly cache: Cache<SoundcloudTrackResponse | null> = new Cache<SoundcloudTrackResponse | null>(
      60 * 60 * 1000,
      10 * 60 * 1000,
    ),
  ) {}

  async resolveMetadata(url: string): Promise<SoundcloudTrackResponse> {
    const cached = this.cache.get(url);

    if (cached !== undefined) {
      if (cached === null) {
        throw new Error('SoundCloud track resolution failed (cached error)');
      }
      console.log('cache hit');
      return cached;
    }

    try {
      console.log('cache miss');
      const result = await this.client.resolveMetadata(url);
      this.cache.set(url, result);
      return result;
    } catch (error) {
      this.cache.set(url, null);
      throw error;
    }
  }

  async getStreamUrl(id: number): Promise<string> {
    return this.client.getStreamUrl(id);
  }

  async resolve(url: string): Promise<Track> {
    const trackData = await this.resolveMetadata(url);
    const streamUrl = await this.getStreamUrl(trackData.id);

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

export class ConcurrencyLimitedSoundcloudClient implements SoundcloudClientInterface {
  private readonly limiter: Limiter;

  constructor(
    private readonly client: SoundcloudClientInterface,
    private readonly concurrency: number = 10,
  ) {
    this.limiter = new Limiter(concurrency);
  }

  async resolveMetadata(url: string): Promise<SoundcloudTrackResponse> {
    return this.limiter.run(() => this.client.resolveMetadata(url));
  }

  async getStreamUrl(id: number): Promise<string> {
    return this.limiter.run(() => this.client.getStreamUrl(id));
  }

  async resolve(url: string): Promise<Track> {
    return this.limiter.run(() => this.client.resolve(url));
  }
}
