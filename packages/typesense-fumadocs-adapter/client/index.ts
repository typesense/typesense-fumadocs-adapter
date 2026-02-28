import { useMemo, useRef, useState } from 'react';
import { type SortedResult } from 'fumadocs-core/search';
import { useDebounce } from './utils';
import { useOnChange } from 'fumadocs-core/utils/use-on-change';
import { searchDocs, type TypesenseOptions } from './search';
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

const cache = new Map<string, SearchResult>();

export function useTypesenseSearch({
  delayMs = 100,
  allowEmpty = false,
  key,
  ...options
}: TypesenseOptions & {
  delayMs?: number;
  allowEmpty?: boolean;
  key?: string;
}): UseTypesenseSearch {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<SearchResult>({ results: 'empty' });
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(false);
  const debouncedValue = useDebounce(search, delayMs);
  const onStart = useRef<() => void>(undefined);

  const cacheKey = useMemo(() => {
    return key ?? JSON.stringify([debouncedValue, options.tag]);
  }, [debouncedValue, options.tag, key]);

  useOnChange(cacheKey, () => {
    const cached = cache.get(cacheKey);

    if (onStart.current) {
      onStart.current();
      onStart.current = undefined;
    }

    if (cached) {
      setIsLoading(false);
      setError(undefined);
      setResult(cached);
      return;
    }

    setIsLoading(true);
    let interrupt = false;
    onStart.current = () => {
      interrupt = true;
    };

    async function run(): Promise<SearchResult> {
      if (debouncedValue.length === 0 && !allowEmpty)
        return { results: 'empty' };

      return searchDocs(debouncedValue, options);
    }

    void run()
      .then((res) => {
        cache.set(cacheKey, res);
        if (interrupt) return;

        setError(undefined);
        setResult(res);
      })
      .catch((err: unknown) => {
        setError(err as Error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  });

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
