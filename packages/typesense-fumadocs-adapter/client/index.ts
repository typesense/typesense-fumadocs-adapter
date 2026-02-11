import { useMemo, useRef, useState } from 'react';
import { type SortedResult } from 'fumadocs-core/search';
import { useDebounce } from './utils';
import { useOnChange } from 'fumadocs-core/utils/use-on-change';
import { searchDocs, type TypesenseOptions } from './search';

interface useTypesenseSearch {
  search: string;
  setSearch: (v: string) => void;
  query: {
    isLoading: boolean;
    data?: SortedResult[] | 'empty';
    error?: Error;
  };
}

const cache = new Map<string, SortedResult[] | 'empty'>();

export function useTypesenseSearch({
  delayMs = 100,
  allowEmpty = false,
  key,
  ...options
}: TypesenseOptions & {
  delayMs?: number;
  allowEmpty?: boolean;
  key?: string;
}): useTypesenseSearch {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SortedResult[] | 'empty'>('empty');
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
      setResults(cached);
      return;
    }

    setIsLoading(true);
    let interrupt = false;
    onStart.current = () => {
      interrupt = true;
    };

    async function run(): Promise<SortedResult[] | 'empty'> {
      if (debouncedValue.length === 0 && !allowEmpty) return 'empty';

      return searchDocs(debouncedValue, options);
    }

    void run()
      .then((res) => {
        cache.set(cacheKey, res);
        if (interrupt) return;

        setError(undefined);
        setResults(res);
      })
      .catch((err: unknown) => {
        setError(err as Error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  });

  return { search, setSearch, query: { isLoading, data: results, error } };
}
