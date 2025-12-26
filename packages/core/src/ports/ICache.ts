/** Generic cache interface (infrastructure agnostic) */
export interface ICache<T> {
  /** Get cached value by key */
  get(key: string): T | undefined;

  /** Set value in cache */
  set(key: string, value: T): void;

  /** Clear all cached entries */
  clear(): void;

  /** Number of entries in cache */
  readonly size: number;
}
