interface CacheEntry<T> {
  value: T;
  expireTs: number;
}

export class Cache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private evictionTimer?: NodeJS.Timeout;

  constructor(
    private readonly ttlMillis: number,
    private readonly evictionIntervalMillis: number,
    private readonly maxItems: number = 16384,
  ) {
    this.scheduleEviction();
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const expireTs = Date.now() + this.ttlMillis;
    this.cache.delete(key);
    this.cache.set(key, { value: entry.value, expireTs });
    return entry.value;
  }

  set(key: string, value: T): void {
    const expireTs = Date.now() + this.ttlMillis;
    this.cache.set(key, { value, expireTs });

    if (this.cache.size > this.maxItems) {
      const mustEvict = this.cache.size - this.maxItems;
      this.evict(mustEvict);
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const expireTs = Date.now() + this.ttlMillis;
    this.cache.delete(key);
    this.cache.set(key, { value: entry.value, expireTs });
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  private scheduleEviction(): void {
    this.evictionTimer = setTimeout(() => {
      this.evict(0); // only evict expired entries
      this.scheduleEviction();
    }, this.evictionIntervalMillis);
  }

  private evict(mustEvictCount: number): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache) {
      const isExpired = now > entry.expireTs;
      const needMoreEvictions = evicted < mustEvictCount;

      // maps keep insertion order, i.e. what we see first is going to expire first.
      // so we can bail early as long as we've evicted enough.
      if (isExpired || needMoreEvictions) {
        this.cache.delete(key);
        evicted++;
      } else {
        break;
      }
    }

    if (evicted > 0) {
      console.log(`cache: evicted=${evicted} size=${this.cache.size}`);
    }
  }
}
