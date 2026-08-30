import { Client } from 'typesense';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import type { ImportResponse } from 'typesense/lib/Typesense/Documents';
import type { CustomSettings, TypesenseDocument } from './types';
import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';

export class TypesenseHelper {
  private typesenseClient: Client;
  private aliasName: string;
  private collectionNameTmp: string;
  private collectionLocale: string;
  private customSettings: CustomSettings | null;
  private typesenseVersion: number = 0;

  constructor(
    client: Client,
    aliasName: string,
    customSettings: CustomSettings | null,
    locale: string = 'en',
  ) {
    this.typesenseClient = client;
    this.aliasName = aliasName;
    this.collectionNameTmp = `${aliasName}_${Date.now()}`;
    this.collectionLocale = locale;
    this.customSettings = customSettings;
  }

  public async init() {
    const debugInfo = await this.typesenseClient.debug.retrieve();
    const version = debugInfo.version;

    if (version === 'nightly') {
      this.typesenseVersion = 30;
    } else {
      this.typesenseVersion = parseInt(version.split('.')[0]!, 10);
    }
  }

  public async createTmpCollection(): Promise<void> {
    // Ensure version is set
    if (this.typesenseVersion === 0) await this.init();

    try {
      await this.typesenseClient.collections(this.collectionNameTmp).delete();
    } catch (error: any) {
      // Ignore ObjectNotFound
      if (error?.httpStatus !== 404) throw error;
    }

    const textLocale = this.collectionLocale;

    const schema: CollectionCreateSchema = {
      name: this.collectionNameTmp,
      fields: getDefaultCollectionFields(textLocale),
      token_separators: ['_', '-'],
    };

    if (this.customSettings) {
      if (this.customSettings.token_separators) {
        schema.token_separators = this.customSettings.token_separators;
      }
      if (this.customSettings.symbols_to_index) {
        schema.symbols_to_index = this.customSettings.symbols_to_index;
      }
      if (this.customSettings.field_definitions) {
        schema.fields = this.customSettings.field_definitions;
      }
      if (this.customSettings.enable_nested_fields !== undefined) {
        schema.enable_nested_fields = this.customSettings.enable_nested_fields;
      }
    }

    await this.typesenseClient.collections().create(schema);
  }

  public async addRecords(
    records: TypesenseDocument[],
    url: string,
    fromSitemap: boolean,
  ): Promise<void> {
    const recordCount = records.length;

    try {
      // Batch process 50 items at a time
      for (let i = 0; i < recordCount; i += 50) {
        const chunk = records.slice(i, i + 50);

        const results = (await this.typesenseClient
          .collections(this.collectionNameTmp)
          .documents()
          .import(chunk, { action: 'create' })) as ImportResponse[];

        const failedItems = results.filter((r) => r.success === false);

        if (failedItems.length > 0) {
          console.error(
            'Typesense Import Failed:',
            JSON.stringify(failedItems, null, 2),
          );
          throw new Error('Failed to import some records');
        }
      }
    } catch (error: any) {
      console.error(
        '❌ [Typesense] Error adding records:',
        error.importResults,
      );
      throw error;
    }

    const color = fromSitemap ? '96' : '94';
    const prefix = url ? ` ${url}` : '';
    console.log(
      `    └── \x1b[${color}mIndexed\x1b[0m${prefix} \x1b[93m${recordCount} records\x1b[0m`,
    );
  }

  public async commitTmpCollection(): Promise<void> {
    const oldCollectionName = await this.getOldCollectionName();

    if (oldCollectionName) {
      await this.transferSynonyms(oldCollectionName);
      await this.transferOverrides(oldCollectionName);
    }

    await this.typesenseClient.aliases().upsert(this.aliasName, {
      collection_name: this.collectionNameTmp,
    });

    if (oldCollectionName) {
      await this.typesenseClient.collections(oldCollectionName).delete();
    }
  }

  private async getOldCollectionName(): Promise<string | null> {
    try {
      const alias = await this.typesenseClient
        .aliases(this.aliasName)
        .retrieve();
      return alias.collection_name;
    } catch (error: any) {
      if (error?.httpStatus === 404) return null;
      throw error;
    }
  }

  private async transferSynonyms(oldCollectionName: string): Promise<void> {
    if (this.typesenseVersion >= 30) {
      const oldCollection = await this.typesenseClient
        .collections(oldCollectionName)
        .retrieve();
      const synonyms = (oldCollection as any).synonym_sets || [];

      for (const syn of synonyms) {
        await this.typesenseClient
          .collections(this.collectionNameTmp)
          .synonyms()
          .upsert(syn.id, syn);
      }
      return;
    }

    // Older versions
    const result = await this.typesenseClient
      .collections(oldCollectionName)
      .synonyms()
      .retrieve();

    const synonyms = result.synonyms || [];

    for (const synonym of synonyms) {
      const { id, ...synonymKeys } = synonym;
      await this.typesenseClient
        .collections(this.collectionNameTmp)
        .synonyms()
        .upsert(synonym.id, synonymKeys as any);
    }
  }

  private async transferOverrides(oldCollectionName: string): Promise<void> {
    if (this.typesenseVersion >= 30) {
      const oldCollection = await this.typesenseClient
        .collections(oldCollectionName)
        .retrieve();

      const curations = (oldCollection as any).curation_sets || [];

      for (const cur of curations) {
        await this.typesenseClient
          .collections(this.collectionNameTmp)
          .overrides()
          .upsert(cur.id, cur);
      }
      return;
    }

    // Older versions
    const result = await this.typesenseClient
      .collections(oldCollectionName)
      .overrides()
      .retrieve();

    const overrides = result.overrides || [];

    for (const override of overrides) {
      const { id, ...overrideKeys } = override;
      await this.typesenseClient
        .collections(this.collectionNameTmp)
        .overrides()
        .upsert(override.id, overrideKeys as any);
    }
  }
}

/**
 * Returns the default collection fields used when creating a Typesense collection.
 *
 * Use this when you need to customize specific fields without redefining the entire schema.
 *
 * @param locale - The locale used for text fields (e.g. `'en'`, `'zh'`). Should match the
 * locale key in `customLocaleCollectionSettings`.
 *
 * @example
 * // Make `section` searchable while keeping all other fields intact
 * customLocaleCollectionSettings: {
 *   en: {
 *     field_definitions: [
 *       ...getDefaultCollectionFields('en').filter(f => f.name !== 'section'),
 *       { name: 'section', type: 'string', optional: true, index: true, locale: 'en' },
 *     ]
 *   }
 * }
 */
export function getDefaultCollectionFields(
  locale: string,
): CollectionFieldSchema[] {
  return [
    // use page_id for grouping and limit 1
    // This will turn the search into "Most Relevant Pages" instead of "Most Relevant Snippets". This will diversify the results to come from multiple pages.
    { name: 'page_id', type: 'string', facet: true },
    { name: 'objectID', type: 'string', index: false },

    { name: 'title', type: 'string', index: false },
    {
      name: 'searchable_title',
      type: 'string',
      optional: true,
      locale: locale,
    },
    { name: 'content', type: 'string', locale: locale },
    {
      name: 'section',
      type: 'string',
      optional: true,
      index: false,
    },
    {
      name: 'breadcrumbs',
      type: 'string[]',
      index: false,
      optional: true,
    },

    { name: 'url', type: 'string', index: false },
    { name: 'tag', type: 'string', facet: true, optional: true },
    { name: 'section_id', type: 'string', index: false, optional: true },
  ];
}
