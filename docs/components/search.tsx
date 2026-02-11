'use client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import { Client } from 'typesense';
import { useTypesenseSearch } from '../../packages/typesense-fumadocs-adapter/client';
import { useEffect } from 'react';

const client = new Client({
  nodes: [
    {
      host: 'localhost',
      port: 8108,
      protocol: 'http',
    },
  ],
  apiKey: 'xyz',
});

export default function TypesenseSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n

  const { search, setSearch, query } = useTypesenseSearch({
    typesenseCollectionName: `typesense-fumadocs-adapter_${locale || 'en'}`,
    client,
    locale,
  });

  useEffect(() => {
    console.log(query.data);
  }, [query.data]);

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
        <SearchDialogFooter>
          <a
            href='https://algolia.com'
            rel='noreferrer noopener'
            className='ms-auto text-xs text-fd-muted-foreground'
          >
            Search powered by Typesense
          </a>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
