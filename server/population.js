// The population section (client/src/pages/Population*.jsx): Census Bureau files as published, read
// from the data directory (lib/population/). Nothing here touches the database.

import { collectionsOnDisk, readFile } from './lib/population/files.js';
import { acsYears, acsGeographies, acsTable } from './lib/population/acs-read.js';
import { ACS_TABLES } from './lib/population/sources.js';

export const populationQueries = {
  // Each collection with its description and the files of it on disk.
  populationCollections: () => collectionsOnDisk(),

  // One file, a page of rows or lines at a time (a sheet at a time for spreadsheets).
  populationFile: (_, { path, offset, limit, sheet }) =>
    readFile(path, { offset: offset ?? 0, limit: Math.min(limit ?? 500, 2000), sheet: sheet ?? 0 }),

  // The ACS: years on disk with their tables, every table's title, and the places of a year.
  acsYears: () => ({ years: acsYears(), tables: ACS_TABLES.map(([id, title]) => ({ id, title })) }),
  acsGeographies: (_, { year }) => acsGeographies(year),
  acsTable: (_, { year, geoid, table }) => acsTable(year, geoid, table),
};
