import { afterEach, describe, expect, vi, test } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Client } from 'typesense';
import type { SearchResponse } from 'typesense/lib/Typesense/Documents';
import { createTypesenseSearchCache, useTypesenseSearch, type UseTypesenseSearch } from '../../client';
import type { TypesenseDocument } from '../../index';

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

type Options = Parameters<typeof useTypesenseSearch>[0];
const roots = new Set<Root>();

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots.clear();
  vi.restoreAllMocks();
});

function client() {
  return new Client({
    nodes: [{ host: 'localhost', port: 8108, protocol: 'http' }],
    apiKey: 'search-only-key',
  });
}

function response(content: string): SearchResponse<TypesenseDocument> {
  return {
    found: 1,
    out_of: 1,
    page: 1,
    search_time_ms: 0,
    request_params: { q: content },
    grouped_hits: [{
      group_key: ['/docs/page'],
      found: 1,
      hits: [{
        highlight: {},
        text_match: 1,
        document: {
          objectID: content,
          title: 'Page',
          url: '/docs/page',
          page_id: '/docs/page',
          section: 'Section',
          content,
        },
      }],
    }],
  };
}

async function mount(initial: Options) {
  let current: UseTypesenseSearch;
  function Harness({ options }: { options: Options }) {
    current = useTypesenseSearch(options);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  roots.add(root);
  async function render(options: Options) {
    await act(async () => root.render(createElement(Harness, { options })));
  }
  await render(initial);
  return {
    get value() { return current!; },
    render,
    async search(query: string) {
      await act(async () => current!.setSearch(query));
    },
    async unmount() {
      await act(async () => root.unmount());
      roots.delete(root);
    },
  };
}

describe('useTypesenseSearch cache', () => {
  test('selects each locale collection and keeps cached results isolated across remounts', async () => {
    const typesense = client();
    const collections = vi.spyOn(typesense, 'collections').mockImplementation(((name: string) => ({
      documents: () => ({ search: async () => response(String(name)) }),
    })) as unknown as Client['collections']);
    const options = { client: typesense, typesenseCollectionName: 'docs', delayMs: 0, locale: 'en' };
    const hook = await mount(options);
    await hook.search('shared');
    expect(hook.value.query.data).toMatchObject([{ content: 'Page' }, { content: 'docs_en' }]);
    await hook.render({ ...options, locale: 'fr' });
    expect(hook.value.query.data).toMatchObject([{ content: 'Page' }, { content: 'docs_fr' }]);
    await hook.unmount();
    const remounted = await mount(options);
    await remounted.search('shared');
    expect(remounted.value.query.data).toMatchObject([{ content: 'Page' }, { content: 'docs_en' }]);
    expect(collections.mock.calls.map(([name]) => name)).toEqual(['docs_en', 'docs_fr']);
  });

  test('the deprecated key alias preserves query changes and isolates namespaces', async () => {
    const onSearch = vi.fn(async (query: string) => response(query));
    const options = { client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0, key: 'revision-1' };
    const hook = await mount(options);
    await hook.search('first');
    await hook.search('second');
    expect(onSearch.mock.calls.map(([query]) => query)).toEqual(['first', 'second']);
    await hook.search('first');
    expect(onSearch).toHaveBeenCalledTimes(2);
    await hook.render({ ...options, key: 'revision-2' });
    expect(onSearch).toHaveBeenCalledTimes(3);
    await hook.render({ ...options, key: 'revision-2', locale: 'fr' });
    expect(onSearch).toHaveBeenCalledTimes(4);
  });

  test('cacheNamespace still uses the internally debounced query', async () => {
    const onSearch = vi.fn(async (query: string) => response(query));
    const hook = await mount({ client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 15, cacheNamespace: 'en' });
    await hook.search('first');
    await hook.search('second');
    expect(onSearch).not.toHaveBeenCalled();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(onSearch.mock.calls.map(([query]) => query)).toEqual(['second']);
  });

  test('cacheNamespace shares the alias namespace and takes precedence, including an empty string', async () => {
    const onSearch = vi.fn(async () => response('content'));
    const options = {
      client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0,
      key: 'legacy',
    };
    const hook = await mount(options);
    await hook.search('query');
    await hook.render({ ...options, key: undefined, cacheNamespace: 'legacy' });
    expect(onSearch).toHaveBeenCalledTimes(1);
    await hook.render({ ...options, cacheNamespace: 'preferred' });
    expect(onSearch).toHaveBeenCalledTimes(2);
    await hook.render({ ...options, key: 'other', cacheNamespace: 'preferred' });
    expect(onSearch).toHaveBeenCalledTimes(2);
    await hook.render({ ...options, cacheNamespace: '' });
    expect(onSearch).toHaveBeenCalledTimes(3);
    await hook.render({ ...options, key: '' });
    expect(onSearch).toHaveBeenCalledTimes(3);
  });

  test('isolates collection, tag, client and legacy result format', async () => {
    const onSearch = vi.fn(async () => response('content'));
    const options = { client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0 };
    const hook = await mount(options);
    await hook.search('content');
    await hook.render({ ...options, typesenseCollectionName: 'other' });
    await hook.render({ ...options, tag: 'guide' });
    await hook.render({ ...options, client: client() });
    await hook.render({ ...options, legacy: true });
    expect(hook.value.query.data).toMatchObject([{ contentWithHighlights: [{ type: 'text', content: 'Page' }] }, {}]);
    expect(onSearch).toHaveBeenCalledTimes(5);
    await hook.render(options);
    expect(onSearch).toHaveBeenCalledTimes(5);
  });

  test('refetches expired results after an index rebuild', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const onSearch = vi.fn(async () => response(`revision-${now}`));
    const options = { client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0 };
    const hook = await mount(options);
    await hook.search('query');
    await hook.search('');
    now = 300_000;
    await hook.search('query');
    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(hook.value.query.data).toMatchObject([{ content: 'Page' }, { content: 'revision-300000' }]);
  });

  test('shares a custom cache across remounts and honors its TTL', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const onSearch = vi.fn(async () => response('content'));
    const options = {
      client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0,
      cache: createTypesenseSearchCache({ maxEntries: 2, ttlMs: 100 }),
    };
    const hook = await mount(options);
    await hook.search('query');
    await hook.unmount();
    const remounted = await mount(options);
    await remounted.search('query');
    expect(onSearch).toHaveBeenCalledTimes(1);
    await remounted.search('');
    now = 100;
    await remounted.search('query');
    expect(onSearch).toHaveBeenCalledTimes(2);
  });

  test('honors custom capacity and isolates cache instances', async () => {
    const onSearch = vi.fn(async () => response('content'));
    const options = {
      client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0,
      cache: createTypesenseSearchCache({ maxEntries: 1 }),
    };
    const hook = await mount(options);
    await hook.search('first');
    await hook.search('second');
    await hook.search('first');
    expect(onSearch).toHaveBeenCalledTimes(3);
    await hook.render({ ...options, cache: createTypesenseSearchCache() });
    expect(onSearch).toHaveBeenCalledTimes(4);
    await hook.render(options);
    expect(onSearch).toHaveBeenCalledTimes(4);
  });

  test('a zero limit disables caching through the public factory', async () => {
    const onSearch = vi.fn(async () => response('content'));
    const hook = await mount({
      client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0,
      cache: createTypesenseSearchCache({ ttlMs: 0 }),
    });
    await hook.search('query');
    await hook.search('');
    await hook.search('query');
    expect(onSearch).toHaveBeenCalledTimes(2);
  });

  test('namespaces isolate published and preview custom sources', async () => {
    const published = vi.fn(async () => response('published result'));
    const preview = vi.fn(async () => response('preview result'));
    const options = {
      client: client(), typesenseCollectionName: 'docs', delayMs: 0,
      cacheNamespace: 'published', onSearch: published,
    };
    const hook = await mount(options);
    await hook.search('query');
    await hook.render({ ...options, cacheNamespace: 'preview', onSearch: preview });
    expect(hook.value.query.data).toMatchObject([{ content: 'Page' }, { content: 'preview result' }]);
    await hook.render(options);
    expect(hook.value.query.data).toMatchObject([{ content: 'Page' }, { content: 'published result' }]);
    expect(published).toHaveBeenCalledTimes(1);
    expect(preview).toHaveBeenCalledTimes(1);
  });

  test('aborts obsolete Typesense requests on query changes, locale changes and unmount', async () => {
    const typesense = client();
    const requests: {
      collection: string;
      query: string;
      signal: AbortSignal;
      resolve: (value: SearchResponse<TypesenseDocument>) => void;
    }[] = [];
    vi.spyOn(typesense, 'collections').mockImplementation(((collection: string) => ({
      documents: () => ({
        search: ({ q }: { q: string }, { abortSignal }: { abortSignal: AbortSignal }) =>
          new Promise<SearchResponse<TypesenseDocument>>((resolve, reject) => {
            requests.push({ collection, query: q, signal: abortSignal, resolve });
            abortSignal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          }),
      }),
    })) as unknown as Client['collections']);
    const options = {
      client: typesense, typesenseCollectionName: 'docs', locale: 'en', delayMs: 0,
    };
    const hook = await mount(options);
    await hook.search('old');
    expect(requests[0]!.signal.aborted).toBe(false);
    await hook.search('new');
    expect(requests[0]!.signal.aborted).toBe(true);
    expect(requests[1]!.signal.aborted).toBe(false);
    expect(hook.value.query.isLoading).toBe(true);
    expect(hook.value.query.error).toBeUndefined();
    await hook.render({ ...options, locale: 'fr' });
    expect(requests[1]!.signal.aborted).toBe(true);
    expect(requests[2]!).toMatchObject({ collection: 'docs_fr', query: 'new' });
    expect(requests[2]!.signal.aborted).toBe(false);
    await act(async () => requests[2]!.resolve(response('current result')));
    expect(hook.value.query.data).toMatchObject([{ content: 'Page' }, { content: 'current result' }]);
    expect(hook.value.query.error).toBeUndefined();
    expect(hook.value.query.isLoading).toBe(false);
    await hook.search('pending');
    await hook.unmount();
    expect(requests[3]!.signal.aborted).toBe(true);
  });

  test('passes an optional fourth signal to onSearch and ignores cleanup cancellation errors', async () => {
    const signals: AbortSignal[] = [];
    const onSearch = vi.fn<NonNullable<Options['onSearch']>>((query, tag, locale, signal) => {
      if (!signal) throw new Error('Missing search signal');
      signals.push(signal);
      if (signals.length > 1) return Promise.resolve(response('fresh result'));
      return new Promise<SearchResponse<TypesenseDocument>>((resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    });
    const options = {
      client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0,
      tag: 'guide', locale: 'en', cacheNamespace: 'revision-1',
    };
    const hook = await mount(options);
    await hook.search('query');
    expect(onSearch).toHaveBeenLastCalledWith('query', 'guide', 'en', expect.any(AbortSignal));
    await hook.render({ ...options, cacheNamespace: 'revision-2' });
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
    expect(hook.value.query.error).toBeUndefined();
    expect(hook.value.query.isLoading).toBe(false);
    expect(hook.value.query.data).toMatchObject([{ content: 'Page' }, { content: 'fresh result' }]);
    await hook.unmount();
    expect(signals[1]!.aborted).toBe(true);
  });

  test('obsolete failures cannot end a newer request or replace its error state', async () => {
    let rejectOld!: (error: Error) => void;
    let resolveNew!: (value: SearchResponse<TypesenseDocument>) => void;
    const onSearch = (query: string) => new Promise<SearchResponse<TypesenseDocument>>((resolve, reject) => {
      if (query === 'old') rejectOld = reject;
      else resolveNew = resolve;
    });
    const hook = await mount({ client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0 });
    await hook.search('old');
    await hook.search('new');
    await act(async () => rejectOld(new Error('obsolete')));
    expect(hook.value.query.isLoading).toBe(true);
    expect(hook.value.query.error).toBeUndefined();
    await act(async () => resolveNew(response('new result')));
    expect(hook.value.query.isLoading).toBe(false);
    expect(hook.value.query.data).toMatchObject([{ content: 'Page' }, { content: '<mark>new</mark> result' }]);
  });

  test('obsolete successes cannot overwrite current results or populate the cache', async () => {
    let resolveOld!: (value: SearchResponse<TypesenseDocument>) => void;
    const onSearch = vi.fn((query: string) => query === 'old'
      ? new Promise<SearchResponse<TypesenseDocument>>((resolve) => { resolveOld = resolve; })
      : Promise.resolve(response('current result')));
    const hook = await mount({ client: client(), typesenseCollectionName: 'docs', onSearch, delayMs: 0 });
    await hook.search('old');
    await hook.search('new');
    await act(async () => resolveOld(response('obsolete result')));
    expect(hook.value.query.data).toMatchObject([{ content: 'Page' }, { content: 'current result' }]);
    await hook.search('old');
    expect(onSearch).toHaveBeenCalledTimes(3);
    await act(async () => resolveOld(response('fresh result')));
  });

  test('inline onSearch callbacks do not cause repeated requests', async () => {
    const onSearch = vi.fn(async () => response('content'));
    const options = { client: client(), typesenseCollectionName: 'docs', delayMs: 0 };
    const hook = await mount({ ...options, onSearch: () => onSearch() });
    await hook.search('query');
    await hook.render({ ...options, onSearch: () => onSearch() });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  test('empty searches respect allowEmpty without sharing the suppressed result', async () => {
    const options = { client: client(), typesenseCollectionName: 'docs', delayMs: 0 };
    const hook = await mount(options);
    expect(hook.value.query.data).toBe('empty');
    await hook.render({ ...options, allowEmpty: true });
    expect(hook.value.query.data).toEqual([]);
    await hook.render(options);
    expect(hook.value.query.data).toBe('empty');
  });
});
