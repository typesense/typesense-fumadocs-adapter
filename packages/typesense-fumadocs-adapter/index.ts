import type { Client as TypesenseClient } from 'typesense';
import type { StructuredData } from 'fumadocs-core/mdx-plugins';
import { TypesenseHelper } from './typesenseHelper';
import type { CustomSettings } from './types';

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

/**
 * Update index settings and replace all objects
 *
 * @param client - Typesense Server Client with Write Permissions
 * @param options - Index Options
 */
export async function sync(
  client: TypesenseClient,
  options: SyncOptions,
): Promise<void> {
  const { documents, typesenseCollectionName } = options;

  // Group documents by locale
  const docsByLocale = new Map<string, DocumentRecord[]>();

  for (const doc of documents) {
    // Fallback to 'en' or a default if locale is missing
    const locale = doc.locale || 'en';

    if (!docsByLocale.has(locale)) {
      docsByLocale.set(locale, []);
    }
    docsByLocale.get(locale)!.push(doc);
  }

  // Iterate and sync each locale separately
  console.log(`Found ${docsByLocale.size} languages to index.`);

  for (const [locale, docs] of docsByLocale) {
    const localizedCollectionName = `${typesenseCollectionName}_${locale}`;

    console.log(
      `\n⏳ Indexing [${locale}] to collection: "${localizedCollectionName}"...`,
    );

    await updateDocuments(
      client,
      {
        ...options,
        typesenseCollectionName: localizedCollectionName, // Override name
        documents: docs, // Only pass docs for this language
      },
      options.customLocaleCollectionSettings?.[locale],
      locale,
    );
  }
}

function toTypesenseDocument(page: DocumentRecord): TypesenseDocument[] {
  let id = 0;
  const documentRecords: TypesenseDocument[] = [];
  const scannedHeadings = new Set<string>();
  function createDocument(
    section: string | undefined,
    sectionId: string | undefined,
    content: string,
  ): TypesenseDocument {
    return {
      objectID: `${page._id}-${(id++).toString()}`,
      breadcrumbs: page.breadcrumbs,
      title: page.title,
      url: page.url,
      page_id: page._id,
      tag: page.tag,
      section,
      section_id: sectionId,
      content,
      ...page.extra_data,
    };
  }

  if (page.description)
    documentRecords.push(
      createDocument(undefined, undefined, page.description),
    );
  const { headings, contents } = page.structured;
  if (page.url === '/docs/test') {
    console.log('Processing /docs/test', page.structured);
  }

  for (const p of contents) {
    const heading = p.heading ? headings.find((h) => p.heading === h.id) : null;

    const index = createDocument(heading?.content, heading?.id, p.content);

    if (heading && !scannedHeadings.has(heading.id)) {
      scannedHeadings.add(heading.id);

      documentRecords.push(
        createDocument(heading.content, heading.id, heading.content),
      );
    }

    documentRecords.push(index);
  }

  // Process headings with no content
  for (const h of headings) {
    if (!scannedHeadings.has(h.id)) {
      documentRecords.push(createDocument(h.content, h.id, h.content));
    }
  }

  return documentRecords;
}

export async function updateDocuments(
  client: TypesenseClient,
  options: SyncOptions,
  collectionSettings: CustomSettings | undefined,
  locale: string,
): Promise<void> {
  const helper = new TypesenseHelper(
    client,
    options.typesenseCollectionName,
    collectionSettings || null,
    locale,
  );

  try {
    await helper.init();
    await helper.createTmpCollection();

    const objects = options.documents.flatMap(toTypesenseDocument);

    await helper.addRecords(objects, '', false);
    await helper.commitTmpCollection();

    console.log('✅ [Typesense] Indexing Complete.');
  } catch (error) {
    console.error('❌ [Typesense] Indexing Failed:');
    throw error;
  }
}

export interface TypesenseDocument {
  objectID: string;
  title: string;
  url: string;
  tag?: string;

  /**
   * The id of page, used for distinct
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
