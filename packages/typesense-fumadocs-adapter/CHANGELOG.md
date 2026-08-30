# typesense-fumadocs-adapter

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
