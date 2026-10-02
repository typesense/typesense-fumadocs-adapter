import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { SearchCache } from '../../client/cache';

afterEach(() => {
  clock?.mockRestore();
  clock = undefined;
});

let clock: ReturnType<typeof spyOn<typeof Date, 'now'>> | undefined;

describe('search cache lifetime', () => {
  test('expires results even when they are repeatedly read', () => {
    let now = 0;
    clock = spyOn(Date, 'now').mockImplementation(() => now);
    const cache = new SearchCache<string>();
    cache.set('query', 'before rebuild');
    now = 299_999;
    expect(cache.get('query')).toBe('before rebuild');
    now = 300_000;
    expect(cache.get('query')).toBeUndefined();
    cache.set('query', 'after rebuild');
    expect(cache.get('query')).toBe('after rebuild');
  });

  test('evicts the least recently used entry at the size bound', () => {
    const cache = new SearchCache<number>();
    for (let i = 0; i < 100; i++) cache.set(String(i), i);
    expect(cache.get('0')).toBe(0);
    cache.set('100', 100);
    expect(cache.get('1')).toBeUndefined();
    expect(cache.get('0')).toBe(0);
    expect(cache.get('100')).toBe(100);
  });

  test('honors custom capacity and TTL', () => {
    let now = 0;
    clock = spyOn(Date, 'now').mockImplementation(() => now);
    const cache = new SearchCache<string>({ maxEntries: 2, ttlMs: 10 });
    cache.set('first', 'a');
    cache.set('second', 'b');
    cache.get('first');
    cache.set('third', 'c');
    expect(cache.get('second')).toBeUndefined();
    now = 9;
    expect(cache.get('first')).toBe('a');
    now = 10;
    expect(cache.get('first')).toBeUndefined();
    expect(cache.get('third')).toBeUndefined();
  });

  test('zero capacity or TTL disables caching', () => {
    for (const options of [{ maxEntries: 0 }, { ttlMs: 0 }]) {
      const cache = new SearchCache<string>(options);
      cache.set('query', 'result');
      expect(cache.get('query')).toBeUndefined();
    }
  });

  test('rejects invalid policies', () => {
    for (const maxEntries of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => new SearchCache({ maxEntries })).toThrow(RangeError);
    }
    for (const ttlMs of [-1, NaN, Infinity]) {
      expect(() => new SearchCache({ ttlMs })).toThrow(RangeError);
    }
  });
});
