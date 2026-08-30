# Typesense Fumadocs Adapter 🔎⚡️

An adapter that brings lightning-fast, typo-tolerant search powered by Typesense to your Fumadocs site.

## Getting started

Install dependencies:

```bash
npm install typesense typesense-fumadocs-adapter
```

Then, follow the [integration guide](https://www.fumadocs.dev/docs/headless/search/typesense) in the official Fumadocs documentation.

## Search UI

Refer to [this Search UI guide](https://www.fumadocs.dev/docs/search/typesense) to integrate Typesense with the Fumadocs UI components.

## About Typesense & Fumadocs

[**Typesense**](https://typesense.org/) is an open-source, lightning-fast search engine that delivers instant, typo-tolerant results with minimal setup. It's an open source alternative to Algolia and an easier-to-use alternative to ElasticSearch.

[**Fumadocs**](https://fumadocs.dev/) is a React.js documentation framework that lets you build fast, MDX-powered docs sites.

Together, **Typesense** and **Fumadocs** provide a seamless way to add powerful, blazingly-fast search to modern documentation websites.

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

Build the adapter package:

```bash
bun run plugin-build
```

Run the documentation site locally:

```bash
bun run docs-dev
```

## License

Licensed under the Apache 2.0 License, Copyright © Typesense.

See [LICENSE](../../LICENSE) for more information.
