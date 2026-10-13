import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLookup, parseGeoLine, congressOf, splitCsv } from './acs.js';

// Rows as they appear in the 2019 lookup (comma-separated, one table copied twice into
// another sequence, as the lookups do for Puerto Rico tables).
const LOOKUP_2019 = `File ID,Table ID,Sequence Number,Line Number,Start Position,Total Cells in Table,Total Cells in Sequence,Table Title,Subject Area
ACSSF,B01002,0002,,100,3 CELLS,,MEDIAN AGE BY SEX,Age-Sex
ACSSF,B01002,0002,,,,,Universe:  Total population,
ACSSF,B01002,0002,1,,,,Median age --!!Total:,
ACSSF,B01002,0002,2,,,,Median age --!!Male,
ACSSF,B01002,0002,3,,,,Median age --!!Female,
ACSSF,B05002,0009,,19,4 CELLS,,PLACE OF BIRTH BY NATIVITY AND CITIZENSHIP STATUS,Foreign Birth
ACSSF,B05002,0009,,,,,Universe:  Total population,
ACSSF,B05002,0009,1,,,,Total:,
ACSSF,B05002,0009,1.5,,,,Native:,
ACSSF,B05002,0009,2,,,,Born in state of residence,
ACSSF,B05002,0009,3,,,,Born in other state,
ACSSF,B05002,0009,4,,,,Foreign born:,
ACSSF,B05002,0169,,13,4 CELLS,,PLACE OF BIRTH BY NATIVITY AND CITIZENSHIP STATUS,Foreign Birth
ACSSF,B05002,0169,1,,,,Total:,
ACSSF,B05002,0169,2,,,,Born in Puerto Rico,
ACSSF,B05002,0169,3,,,,Born in the United States,
ACSSF,B05002,0169,4,,,,Foreign born:,
ACSSF,B24010,0107,,200,,,SEX BY OCCUPATION,Occupation
ACSSF,B24010,0107,1,,,,Total:,
ACSSF,B24010,0107,2,,,,Male:,
ACSSF,B24010,0108,,7,,,SEX BY OCCUPATION,Occupation
ACSSF,B24010,0108,3,,,,Female:,
`;

// The 2006 lookup is tab-separated, with other column names.
const LOOKUP_2006 = [
  'fileid\ttblid\tseq\torder\tposition\tcells\ttotal\ttitle\tsubject_area',
  'ACSSF\tB19013\t78\t0\t126\t1 CELLS\t0\tMEDIAN HOUSEHOLD INCOME IN THE PAST 12 MONTHS\tIncome',
  'ACSSF\tB19013\t78\t0\t0\t\t0\tUniverse:  Households\t',
  'ACSSF\tB19013\t78\t1\t0\t\t0\tMedian household income in the past 12 months\t',
].join('\n');

test('a comma-separated lookup: parts, cells, headings and universe', () => {
  const { tables } = readLookup(Buffer.from(LOOKUP_2019), 'ACS_1yr_Seq_Table_Number_Lookup.txt');
  const age = tables.get('B01002');
  assert.equal(age.title, 'MEDIAN AGE BY SEX');
  assert.equal(age.universe, 'Total population');
  assert.deepEqual(age.parts, [{ sequence: 2, start: 100, cells: 3 }]);
  assert.deepEqual(age.lines.map(l => l.label), ['Median age --!!Total:', 'Median age --!!Male', 'Median age --!!Female']);

  // The copy in sequence 169 is dropped; the heading at line 1.5 is kept, but is not a cell.
  const birth = tables.get('B05002');
  assert.deepEqual(birth.parts, [{ sequence: 9, start: 19, cells: 4 }]);
  assert.deepEqual(birth.lines.map(l => [l.line, l.cell]), [[1, true], [1.5, false], [2, true], [3, true], [4, true]]);

  // A table split over two sequences keeps both parts, numbered on.
  assert.deepEqual(tables.get('B24010').parts, [{ sequence: 107, start: 200, cells: 2 }, { sequence: 108, start: 7, cells: 1 }]);
  assert.equal(tables.get('B24010').cells, 3);
});

test('a tab-separated lookup (2006)', () => {
  const { tables } = readLookup(Buffer.from(LOOKUP_2006), 'merge_5_6_final.txt');
  const income = tables.get('B19013');
  assert.deepEqual(income.parts, [{ sequence: 78, start: 126, cells: 1 }]);
  assert.equal(income.universe, 'Households');
  assert.equal(income.lines[0].label, 'Median household income in the past 12 months');
});

test('geography lines from 2005 and 2019', () => {
  const g2005 = `ACSSF CA500000000035${' '.repeat(3)}06${' '.repeat(85)}50000US0601${' '.repeat(29)}Congressional District 1, California (109th Congress)`;
  const g2019 = `ACSSF CA040000000001${' '.repeat(5)}06${' '.repeat(151)}04000US06${' '.repeat(31)}California                                 `;
  assert.deepEqual(parseGeoLine(g2005), {
    sumlev: '500', component: '00', logrecno: 35, geoid: '50000US0601', name: 'Congressional District 1, California (109th Congress)',
  });
  assert.deepEqual(parseGeoLine(g2019), { sumlev: '040', component: '00', logrecno: 1, geoid: '04000US06', name: 'California' });
  assert.equal(congressOf('Congressional District 1 (116th Congress), California'), 116);
  assert.equal(congressOf('Congressional District 1, California (109th Congress)'), 109);
  assert.equal(congressOf('California'), null);
});

test('quoted fields', () => {
  assert.deepEqual(splitCsv('ACSSF,B08406,"Car, truck, or van:",""'), ['ACSSF', 'B08406', 'Car, truck, or van:', '']);
});
