import { useEffect, useState } from 'react';
import { type SortedResult } from 'fumadocs-core/search';
import { useDebounce } from './utils';
import { searchDocs, type TypesenseOptions } from './search';
import { getSearchCacheKey, SearchCache, type TypesenseSearchCacheOptions } from './cache';
import type { SearchResponse } from 'typesense/lib/Typesense/Documents';
import type { TypesenseDocument } from '../index';

export interface UseTypesenseSearch {
  search: string;
  setSearch: (v: string) => void;
  query: {
    isLoading: boolean;
    data?: SortedResult[] | 'empty';
    raw_data?: SearchResponse<TypesenseDocument>;
    error?: Error;
  };
}

interface SearchResult {
  results: SortedResult[] | 'empty';
  raw?: SearchResponse<TypesenseDocument>;
}

export type { TypesenseSearchCacheOptions } from './cache';
export type TypesenseSearchCache = SearchCache<SearchResult>;

/** Create once and share between hooks that should use the same cache policy. */
export function createTypesenseSearchCache(
  options: TypesenseSearchCacheOptions = {},
): TypesenseSearchCache {
  return new SearchCache<SearchResult>(options);
}

const defaultCache = createTypesenseSearchCache();

export function useTypesenseSearch({
  delayMs = 100,
  allowEmpty = false,
  key,
  cacheNamespace,
  cache = defaultCache,
  ...options
}: TypesenseOptions & {
  delayMs?: number;
  allowEmpty?: boolean;
  /** @deprecated Use cacheNamespace instead. Ignored when cacheNamespace is supplied. */
  key?: string;
  /** Additional cache namespace, e.g. an index revision or custom `onSearch` source. */
  cacheNamespace?: string;
  /** Shared cache instance. Defaults to 100 entries with a five-minute TTL. */
  cache?: TypesenseSearchCache;
}): UseTypesenseSearch {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<SearchResult>({ results: 'empty' });
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(false);
  const debouncedValue = useDebounce(search, delayMs);
  const cacheKey = getSearchCacheKey(debouncedValue, options, cacheNamespace ?? key);

  useEffect(() => {
    if (debouncedValue.length === 0 && !allowEmpty) {
      setIsLoading(false);
      setError(undefined);
      setResult({ results: 'empty' });
      return;
    }

    const cached = cache.get(cacheKey);
    if (cached) {
      setIsLoading(false);
      setError(undefined);
      setResult(cached);
      return;
    }

    setIsLoading(true);
    let interrupt = false;
    const controller = new AbortController();

    void searchDocs(debouncedValue, options, controller.signal)
      .then((res) => {
        if (interrupt) return;

        cache.set(cacheKey, res);
        setError(undefined);
        setResult(res);
      })
      .catch((err: unknown) => {
        if (interrupt) return;
        setError(err as Error);
      })
      .finally(() => {
        if (interrupt) return;
        setIsLoading(false);
      });

    return () => {
      interrupt = true;
      controller.abort();
    };
    // The key captures the request parameters. Inline onSearch callbacks may
    // change identity each render; use cacheNamespace to identify a different source.
  }, [cache, cacheKey, allowEmpty]);

  return {
    search,
    setSearch,
    query: {
      isLoading,
      data: result.results,
      raw_data: result.raw,
      error,
    },
  };
}
