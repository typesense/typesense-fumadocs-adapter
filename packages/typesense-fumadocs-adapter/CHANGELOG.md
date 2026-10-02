# typesense-fumadocs-adapter

## 0.5.0

### Minor Changes

- Add `createTypesenseSearchCache({ maxEntries, ttlMs })` and a `cache` option for `useTypesenseSearch`. The shared default cache retains up to 100 least recently used responses with a 5-minute TTL. Set either limit to zero to disable caching.

- Add `cacheNamespace` to identify index revisions or custom search sources while preserving the internally debounced query. Keep `key` as a deprecated alias; `cacheNamespace` takes precedence when both are supplied.

- Cancel obsolete Typesense requests when search parameters change or the hook unmounts. Custom `onSearch` callbacks receive an optional fourth `AbortSignal` argument.

- Fix client search cache collisions across locales, collections, clients, tags, and result formats. Prevent obsolete requests from updating results, errors, loading state, or the cache.

## 0.4.3

### Patch Changes

- fix(search): preserve markdown in highlighted results

## 0.4.2

### Patch Changes

- Fix tag schema and preserve indexes on import failure:
- Align the default Typesense `tag` field schema with the documented `string` type.
- Import errors now propagate from `TypesenseHelper.addRecords()`, preventing failed syncs from updating the collection alias, deleting the previously working collection, or incorrectly reporting that syncing completed.

## 0.4.1

### Patch Changes

- Fix return type of getDefaultCollectionFields getting undefined

## 0.4.0

### Minor Changes

- Added `getDefaultCollectionFields(locale)` to allow customizing specific collection fields without redefining the entire schema.

## 0.3.0

### Minor Changes

- Support i18n, use Typesense text match highlight, return raw Typesense results for more flexibility in the hook.

## 0.2.0

### Minor Changes

- Change search parameters to improve search results

## 0.1.2

### Patch Changes

- fix import paths

## 0.1.1

### Patch Changes

- First release ✨
