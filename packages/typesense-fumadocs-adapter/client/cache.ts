import type { TypesenseOptions } from './search';

// Isolate client instances without serializing their configuration or credentials.
const clientIds = new WeakMap<TypesenseOptions['client'], number>();
let nextClientId = 0;

export function getSearchCacheKey(
  query: string,
  options: TypesenseOptions,
  namespace?: string,
): string {
  let clientId = clientIds.get(options.client);
  if (clientId === undefined) {
    clientId = nextClientId++;
    clientIds.set(options.client, clientId);
  }

  return JSON.stringify([
    clientId,
    options.typesenseCollectionName,
    options.locale,
    options.tag,
    options.legacy ?? false,
    options.onSearch !== undefined,
    namespace,
    query,
  ]);
}

export interface TypesenseSearchCacheOptions {
  /** Maximum number of responses to retain. Set to 0 to disable caching. @defaultValue 100 */
  maxEntries?: number;
  /** Freshness lifetime in milliseconds, measured from fetch completion. Default: `5 minutes` @defaultValue 300000 */
  ttlMs?: number;
}

export class SearchCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor({
    maxEntries = 100,
    ttlMs = 300_000,
  }: TypesenseSearchCacheOptions = {}) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 0) {
      throw new RangeError('maxEntries must be a non-negative safe integer');
    }
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new RangeError('ttlMs must be a finite non-negative number');
    }
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expiresAt <= Date.now()) return undefined;

    // Promote a hit without extending its lifetime.
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.maxEntries === 0 || this.ttlMs === 0) return;
    const now = Date.now();
    for (const [entryKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(entryKey);
    }
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
