import type { TypesenseDocument } from '../index';
import type { Client } from 'typesense';
import {
  createContentHighlighter,
  type SortedResult,
} from 'fumadocs-core/search';
import type {
  SearchResponse,
  SearchResponseHit,
} from 'typesense/lib/Typesense/Documents';

export interface TypesenseOptions {
  typesenseCollectionName: string;
  client: Client;

  /**
   * Filter results with specific tag.
   */
  tag?: string;

  locale?: string;

  onSearch?: (
    query: string,
    tag?: string,
    locale?: string,
  ) => Promise<SearchResponse<TypesenseDocument>>;
}

export function groupResults(
  hits: SearchResponseHit<TypesenseDocument>[],
): SortedResult[] {
  const grouped: SortedResult[] = [];
  const scannedUrls = new Set<string>();

  for (const doc of hits) {
    const hit = doc.document;

    if (!scannedUrls.has(hit.url)) {
      scannedUrls.add(hit.url);

      grouped.push({
        id: hit.url,
        type: 'page',
        breadcrumbs: hit.breadcrumbs,
        url: hit.url,
        content: hit.title,
      });
    }

    grouped.push({
      id: hit.objectID,
      type: hit.content === hit.section ? 'heading' : 'text',
      url: hit.section_id ? `${hit.url}#${hit.section_id}` : hit.url,
      content: hit.content,
    });
  }

  return grouped;
}

export async function searchDocs(
  query: string,
  { typesenseCollectionName, onSearch, client, locale, tag }: TypesenseOptions,
): Promise<SortedResult[]> {
  if (query.trim().length === 0) return [];

  const result = onSearch
    ? await onSearch(query, tag, locale)
    : await client
        .collections<TypesenseDocument>(typesenseCollectionName)
        .documents()
        .search({
          q: query,
          query_by: 'title,section,content',
          // include_fields:"",
          // group_by: 'page_id',
          // group_limit: 1,
          limit: 10,
          filter_by: tag ? `tag:${tag}` : undefined,
        });

  const highlighter = createContentHighlighter(query);

  if (!result.hits) return [];

  return groupResults(result.hits).map((hit) => {
    return {
      ...hit,
      contentWithHighlights: hit.content
        ? highlighter.highlight(hit.content)
        : undefined,
    };
  });
}
