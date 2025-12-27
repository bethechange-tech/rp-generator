import { ICache } from "../../../ports";

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

/**
 * LRU (Least Recently Used) Cache with TTL expiration.
 *
 * - When full, removes the least recently accessed item first
 * - Items expire after TTL seconds
 * - Accessing an item keeps it in cache longer
 */
export class LRUCache<T> implements ICache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  /**
   * @param maxSize - Max items to store (default: 100)
   * @param ttlSeconds - Seconds until expiry (default: 300)
   */
  constructor(maxSize: number = 100, ttlSeconds: number = 300) {
    this.maxSize = maxSize;
    this.ttlMs = ttlSeconds * 1000;
  }

  /** Get value by key. Returns undefined if not found or expired. */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /** Store a value. Evicts oldest item if cache is full. */
  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttlMs,
    });
  }

  /** Clear all entries. */
  clear(): void {
    this.cache.clear();
  }

  /** Current number of cached items. */
  get size(): number {
    return this.cache.size;
  }
}
