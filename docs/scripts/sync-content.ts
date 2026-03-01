import { Client } from 'typesense';
import { sync, DocumentRecord } from 'typesense-fumadocs-adapter';
import * as fs from 'node:fs';

// the path of pre-rendered `static.json`, choose one according to your React framework
const filePath = {
  next: '.next/server/app/static.json.body',
  'tanstack-start': '.output/public/static.json',
  'react-router': 'build/client/static.json',
  waku: 'dist/public/static.json',
}['next'];

const content = fs.readFileSync(filePath);

const records = JSON.parse(content.toString()) as DocumentRecord[];

const client = new Client({
  nodes: [
    {
      host: 'localhost',
      port: 8108,
      protocol: 'http',
    },
  ],
  apiKey: 'xyz',
  connectionTimeoutSeconds: 2,
});

// update the collection settings and sync search indexes
void sync(client, {
  typesenseCollectionName: 'typesense-fumadocs-adapter',
  documents: records,
});
