import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import type { StructuredData } from 'fumadocs-core/mdx-plugins';

export interface SyncOptions {
  /**
   * Typesense Collection Name for documents.
   */
  typesenseCollectionName: string;

  /**
   * Search indexes
   */
  documents: DocumentRecord[];

  /**
   * Typesense creates different collections for different locales. This allows you to set custom collection settings per locale.
   * ```
   *  zh: {
   *    token_separators: ["_", "-"]
   *  }
   * ```
   */
  customLocaleCollectionSettings?: Record<string, CustomSettings>;
}

export interface DocumentRecord {
  /**
   * The ID of document, must be unique
   */
  _id: string;

  title: string;
  description?: string;
  breadcrumbs?: string[];

  /**
   * URL to the page
   */
  url: string;
  structured: StructuredData;

  /**
   * Tag to filter results
   */
  tag?: string;

  /**
    The locale of the document e.g. `en`, `fr`
  */
  locale?: string;
  /**
   * Data to be added to each section index
   */
  extra_data?: object;
}
export interface TypesenseDocument {
  objectID: string;
  title: string;
  searchable_title?: string;
  url: string;
  tag?: string;

  /**
   * The id of page, used for group_by
   */
  page_id: string;

  /**
   * Heading content
   */
  section?: string;

  /**
   * Heading (anchor) id
   */
  section_id?: string;

  breadcrumbs?: string[];

  content: string;
}

export interface CustomSettings {
  token_separators?: CollectionCreateSchema['token_separators'];
  symbols_to_index?: CollectionCreateSchema['symbols_to_index'];
  field_definitions?: CollectionCreateSchema['fields'];
  enable_nested_fields?: CollectionCreateSchema['enable_nested_fields'];
}
