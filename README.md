# Typesense Fumadocs Adapter 🔎⚡️

An adapter that brings lightning-fast, typo-tolerant search powered by Typesense to your Fumadocs site.

## About Typesense & Fumadocs

[**Typesense**](https://typesense.org/) is an open-source, lightning-fast search engine that delivers instant, typo-tolerant results with minimal setup. It's an open source alternative to Algolia and an easier-to-use alternative to ElasticSearch.

[**Fumadocs**](https://fumadocs.dev/) is a React.js documentation framework that lets you build fast, MDX-powered docs sites.

Together, **Typesense** and **Fumadocs** provide a seamless way to add powerful, blazingly-fast search to modern documentation websites.

## Getting started

Install dependencies:

```bash
npm install typesense typesense-fumadocs-adapter
```

Then, follow the [integration guide](https://www.fumadocs.dev/docs/headless/search/typesense) in the official Fumadocs documentation.

## Search UI

Refer to [this Search UI guide](https://www.fumadocs.dev/docs/search/typesense) to integrate Typesense with the Fumadocs UI components.

## Advanced configuration

### Search caching

Results are cached in memory and cleared on reload. Cache hits do not extend expiry, displayed results do not refresh automatically. Full caches evict the least recently used result.

Create a shared cache outside your component to customize the limits:

```tsx
import { createTypesenseSearchCache, useTypesenseSearch } from 'typesense-fumadocs-adapter/client';

const searchCache = createTypesenseSearchCache({
  maxEntries: 200,
  ttlMs: 5 * 60 * 1000,
});

function SearchDialog() {
  const { search, setSearch, query } = useTypesenseSearch({
    client,
    typesenseCollectionName: 'docs',
    cache: searchCache,
  });
}
```

| Option       | Default          | Purpose                            |
| ------------ | ---------------- | ---------------------------------- |
| `maxEntries` | `100`            | Maximum number of cached responses |
| `ttlMs`      | `300_000` (5 min) | Response lifetime in milliseconds  |

Both options are optional set either to `0` to disable caching. Keep client and cache instances stable across renders.

### Refreshing cached results

Use `cacheNamespace: indexRevision` to force fresh results after an index rebuild. E.g. updating `indexRevision` from `'build-42'` to `'build-43'` triggers a new search for every users. Your application supplies the revision, the hook does not detect rebuilds automatically.

Also change the namespace when switching a custom search source, such as published versus preview documentation.

### Custom search requests

Use `onSearch` to call your own endpoint, which must return a Typesense search response. Forward `signal` to cancel obsolete requests:

```tsx
const { search, setSearch, query } = useTypesenseSearch({
  client,
  typesenseCollectionName: 'docs',
  locale,
  onSearch: async (query, tag, locale, signal) => {
    const params = new URLSearchParams({ q: query });
    if (tag) params.set('tag', tag);
    if (locale) params.set('locale', locale);
    const response = await fetch(`/api/search?${params}`, { signal });
    if (!response.ok) throw new Error('Search request failed');
    return response.json();
  },
});
```

## Development

This repository uses [Bun](https://bun.com/) for package management and tests, and Docker for the integration test with Typesense server.

Install dependencies:

```bash
bun install
```

The `docs` app is part of the root Bun workspace and consumes the local adapter through `workspace:*`; it does not need a separate install.

Start Typesense using the repository's development configuration:

```bash
docker compose up -d typesense
curl http://localhost:8108/health
```

Run the integration suite:

```bash
bun run test:integration
```

The integration command first builds the Fumadocs app in `./docs` to produce its real search-index JSON then synced to Typesense. Test collections and aliases use a unique prefix and are removed after the suite.

The integration suite defaults to `http://localhost:8108`. Set `TYPESENSE_URL` and `TYPESENSE_API_KEY` to test against a different server.

Build the adapter package:

```bash
bun run plugin-build
```

Run the pure unit tests with `bun run test:unit`. React hook tests run in real Chromium through Vitest Browser Mode:

```bash
bun run test:browser:install
bun run test:browser
```

Browser tests require Node.js 24 and use mocked Typesense responses so Typesense server is not required.

Run the documentation site locally:

```bash
bun run docs-dev
```

## License

Licensed under the Apache 2.0 License, Copyright © Typesense.

See [LICENSE](../../LICENSE) for more information.
