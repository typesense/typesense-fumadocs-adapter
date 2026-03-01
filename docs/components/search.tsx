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
import { useTypesenseSearch } from 'typesense-fumadocs-adapter/client';
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
  const { locale } = useI18n(); // optional

  const { search, setSearch, query } = useTypesenseSearch({
    typesenseCollectionName: `typesense-fumadocs-adapter`,
    locale,
    legacy: false, // optional, set to true for fumadocs-ui version < 16.6.0
    client,
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
          <div className='w-full text-right text-xs text-fd-muted-foreground'>
            <a
              href='https://typesense.org'
              rel='noreferrer noopener'
              target='_blank'
            >
              Search powered by Typesense
            </a>
          </div>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
