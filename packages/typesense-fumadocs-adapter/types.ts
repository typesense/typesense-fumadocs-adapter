import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export interface CustomSettings {
  token_separators?: CollectionCreateSchema['token_separators'];
  symbols_to_index?: CollectionCreateSchema['symbols_to_index'];
  field_definitions?: CollectionCreateSchema['fields'];
  enable_nested_fields?: CollectionCreateSchema['enable_nested_fields'];
}
