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

  /**
   * Search locale
   */
  locale?: string;

  /**
   * Support older versions of fumadocs-ui (< 16.6.0) by parsing `<mark>` tags into `contentWithHighlights`.
   * This might impact performance.
   *
   * @defaultValue false
   */
  legacy?: boolean;

  onSearch?: (
    query: string,
    tag?: string,
    locale?: string,
  ) => Promise<SearchResponse<TypesenseDocument>>;
}

interface HighlightedText {
  type: 'text';
  content: string;
  styles?: {
    highlight?: boolean;
  };
}

function parseSnippet(snippet: string): HighlightedText[] {
  return snippet
    .split(/(<mark>.*?<\/mark>)/g)
    .map((part) => {
      if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
        return {
          type: 'text' as const,
          content: part.replace(/<\/?mark>/g, ''),
          styles: { highlight: true },
        };
      }

      return {
        type: 'text' as const,
        content: part,
      };
    })
    .filter((part) => part.content.length > 0);
}

export function groupResults(
  hits: SearchResponseHit<TypesenseDocument>[],
  query: string,
  legacy?: boolean,
): SortedResult[] {
  const grouped: SortedResult[] = [];
  const scannedUrls = new Set<string>();
  const highlighter = createContentHighlighter(query);

  for (const doc of hits) {
    const hit = doc.document;
    const highlight = doc.highlight;

    if (!scannedUrls.has(hit.url)) {
      scannedUrls.add(hit.url);

      const titleSnippet =
        highlight?.searchable_title?.snippet ??
        highlight?.title?.snippet ??
        hit.title;

      grouped.push({
        id: hit.url,
        type: 'page',
        breadcrumbs: hit.breadcrumbs,
        url: hit.url,
        content: legacy
          ? hit.title
          : highlighter.highlightMarkdown(hit.title).trim(),
        contentWithHighlights: legacy ? parseSnippet(titleSnippet) : undefined,
      });
    }

    const contentSnippet = highlight?.content?.snippet ?? hit.content;

    grouped.push({
      id: hit.objectID,
      type: hit.content === hit.section ? 'heading' : 'text',
      url: hit.section_id ? `${hit.url}#${hit.section_id}` : hit.url,
      content: legacy
        ? hit.content
        : highlighter.highlightMarkdown(hit.content).trim(),
      contentWithHighlights: legacy ? parseSnippet(contentSnippet) : undefined,
    });
  }

  return grouped;
}

export async function searchDocs(
  query: string,
  {
    typesenseCollectionName,
    onSearch,
    client,
    tag,
    locale,
    legacy,
  }: TypesenseOptions,
): Promise<{
  results: SortedResult[];
  raw: SearchResponse<TypesenseDocument>;
}> {
  if (query.trim().length === 0)
    return {
      results: [],
      raw: {
        found: 0,
        hits: [],
        out_of: 0,
        page: 0,
        search_time_ms: 0,
        request_params: {
          q: '',
        },
      },
    };

  const collectionName = locale
    ? `${typesenseCollectionName}_${locale}`
    : typesenseCollectionName;

  const result = onSearch
    ? await onSearch(query, tag, locale)
    : await client
        .collections<TypesenseDocument>(collectionName)
        .documents()
        .search({
          q: query,
          query_by: 'searchable_title,content',
          group_by: 'page_id',
          exclude_fields: 'out_of,search_time_ms',
          group_limit: 3,
          limit: 10,
          filter_by: tag ? `tag:${tag}` : undefined,
        });

  if (!result.grouped_hits)
    return {
      results: [],
      raw: result,
    };

  const flatHits = result.grouped_hits?.flatMap((group) => group.hits) || [];

  return {
    results: groupResults(flatHits, query, legacy),
    raw: result,
  };
}
