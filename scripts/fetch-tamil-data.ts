// @ts-nocheck
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { SHLOKAS } from '../src/lib/shlokas.js'; // Use .js extension for tsx resolution or just import

const connectionString = 'postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@YOUR_DB_HOST/YOUR_DB_NAME';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  const updatedShlokas = [];

  for (const shloka of SHLOKAS) {
    // Determine url
    const refParts = shloka.reference.split('.');
    if (refParts.length < 2) {
      console.warn(`Invalid reference format for ${shloka.id}: ${shloka.reference}`);
      updatedShlokas.push(shloka);
      continue;
    }
    const chapter = refParts[0];
    const versePart = refParts[1];
    const firstVerse = versePart.split('-')[0];
    const url = `/${chapter}/${firstVerse}`;

    console.log(`Processing ${shloka.id} (${shloka.reference}) -> ${url}`);

    // Query tbl_sub_chapters
    const subChapRes = await client.query('SELECT id FROM tbl_sub_chapters WHERE url = $1 LIMIT 1', [url]);
    if (subChapRes.rows.length === 0) {
      console.warn(`No sub_chapter found for url: ${url}`);
      updatedShlokas.push(shloka);
      continue;
    }
    const subChapterId = subChapRes.rows[0].id;

    // Query tbl_translations for translation
    const transRes = await client.query(
      "SELECT translated_text FROM tbl_translations WHERE language_code = 'ta' AND field_name = 'translation' AND record_id = $1 LIMIT 1",
      [subChapterId]
    );
    let tamilTranslation = shloka.tamil; // fallback
    if (transRes.rows.length > 0 && transRes.rows[0].translated_text) {
      tamilTranslation = transRes.rows[0].translated_text;
    } else {
        console.warn(`No translation found for ${shloka.id}`);
    }

    // Query tbl_purports and its translation
    let tamilPurport = undefined;
    const purpRes = await client.query('SELECT id FROM tbl_purports WHERE sub_chapter_id = $1 LIMIT 1', [subChapterId]);
    if (purpRes.rows.length > 0) {
      const purportId = purpRes.rows[0].id;
      const purpTransRes = await client.query(
        "SELECT translated_array FROM tbl_translations WHERE language_code = 'ta' AND table_name = 'purports' AND record_id = $1 LIMIT 1",
        [purportId]
      );
      if (purpTransRes.rows.length > 0 && purpTransRes.rows[0].translated_array) {
        tamilPurport = purpTransRes.rows[0].translated_array;
      } else {
        console.warn(`No purport translation found for ${shloka.id}`);
      }
    } else {
        console.warn(`No purport found for ${shloka.id}`);
    }

    updatedShlokas.push({
      ...shloka,
      tamil: tamilTranslation,
      tamilPurport: tamilPurport,
    });
  }

  await client.end();

  // Validate we still have 108 verses
  if (updatedShlokas.length !== 108) {
    throw new Error(`Expected exactly 108 verses, but got ${updatedShlokas.length}`);
  }

  // Generate new shlokas.ts file
  const shlokasFilePath = path.join(__dirname, '../src/lib/shlokas.ts');
  const newContent = `export type LoopStep = "listen" | "repeat" | "understand" | "recall";

export type Shloka = {
  id: string;
  chapter: number;
  verse: number;
  reference: string;
  sanskrit: string;
  tamil: string;
  transliteration: string;
  english: string;
  translationAuthor: string;
  reflectionPrompt: string;
  audioSrc?: string;
  tamilPurport?: string[];
};

export const SHLOKA_SOURCE = "https://prabhupadagita.com/2012/10/17/108-imporant-slokas-from-the-1972-bhagavad-gita-as-it-is/";

export const SHLOKAS: Shloka[] = ${JSON.stringify(updatedShlokas, null, 2)};

export const TOTAL_SHLOKAS = SHLOKAS.length;
export const DAILY_TARGET = 2;
export const JOURNEY_DAYS = TOTAL_SHLOKAS / DAILY_TARGET;
`;

  fs.writeFileSync(shlokasFilePath, newContent, 'utf-8');
  console.log('Successfully updated shlokas.ts with Tamil translations and purports.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
