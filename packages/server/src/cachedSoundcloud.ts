import type { Track } from '@vizl/shared';
import { Cache } from '@vizl/shared';
import { SoundcloudClientInterface } from './soundcloud.js';

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
