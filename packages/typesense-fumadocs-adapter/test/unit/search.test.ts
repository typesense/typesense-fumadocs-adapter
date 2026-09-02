import { describe, expect, test } from 'bun:test';
import type { SearchResponseHit } from 'typesense/lib/Typesense/Documents';
import { groupResults } from '../../client/search';
import type { TypesenseDocument } from '../../index';

function createHit(
  document: TypesenseDocument,
  contentSnippet: string,
): SearchResponseHit<TypesenseDocument> {
  return {
    document,
    highlight: {
      content: { snippet: contentSnippet },
    },
    text_match: 1,
  };
}

describe('groupResults', () => {
  const inlineCodeHit = createHit(
    {
      objectID: 'configuration-timeout',
      title: 'Configuration',
      url: '/docs/configuration',
      page_id: '/docs/configuration',
      section: '`timeout`',
      section_id: 'timeout',
      content: '`timeout`',
    },
    '`<mark>timeout</mark>`',
  );
  const textHit = createHit(
    {
      ...inlineCodeHit.document,
      objectID: 'configuration-timeout-description',
      section: '`timeout`',
      content: 'Configure the request timeout.',
    },
    'request <mark>timeout</mark>.',
  );

  test('preserves Markdown when highlighting inline code', () => {
    const results = groupResults([inlineCodeHit], 'timeout');

    expect(results[1]).toMatchObject({
      type: 'heading',
      content: '`timeout`',
      url: '/docs/configuration#timeout',
    });
  });

  test('highlights the original Markdown instead of the Typesense snippet', () => {
    const results = groupResults([textHit], 'timeout');

    expect(results[1]).toMatchObject({
      type: 'text',
      content: 'Configure the request <mark>timeout</mark>.',
    });
  });

  test('keeps the legacy highlight representation', () => {
    const results = groupResults([textHit], 'timeout', true);

    expect(results[1]).toMatchObject({
      content: 'Configure the request timeout.',
      contentWithHighlights: [
        { type: 'text', content: 'request ' },
        { type: 'text', content: 'timeout', styles: { highlight: true } },
        { type: 'text', content: '.' },
      ],
    });
  });
});
