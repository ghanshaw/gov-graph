import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDecadeTable } from './series.js';
import { linesOf, districtPlace, stateByAbbr } from './places.js';

// A decade table as st5060ts.txt prints it: thousands, the April 1950 census before the July
// estimates, the April 1960 census after them, two blocks of columns.
const ST5060 = `Intercensal Estimates of the Total Resident Population of States:
1950 to 1960.  (in thousands)

               April 1,
                   1950 July 1,  July 1,  July 1, July 1,  July 1,
                 (census)    1950     1951     1952    1953     1954

U.S.            151,326 151,868  153,982  156,393 158,956  161,884
AL                3,062   3,058    3,059    3,068   3,053    3,014

                   1955    1956     1957     1958    1959 (census)

U.S.            165,069 168,088  171,187  174,149 177,135  179,323
AL                3,047   3,124    3,182    3,203   3,231    3,267
`;
const COLUMNS = ['1950-c', '1950', '1951', '1952', '1953', '1954', '1955', '1956', '1957', '1958', '1959', '1960-c'];

test('a decade table: July estimates in persons, census columns left out', () => {
  const t = readDecadeTable(ST5060, COLUMNS, true);
  assert.deepEqual(t.get('us').slice(0, 2), [['1950-07-01', 151868000], ['1951-07-01', 153982000]]);
  assert.equal(t.get('us').length, 10);
  assert.deepEqual(t.get('al').at(-1), ['1959-07-01', 3231000]);
});

test('a decade table with a row missing a column is refused', () => {
  const short = ST5060.replace('AL                3,047   3,124', 'AL                3,124');
  assert.throws(() => readDecadeTable(short, COLUMNS, true), /al: 11 values for 12 columns/);
});

test('district lines: each census cycle, split by mid-cycle redraws', () => {
  assert.equal(linesOf('ca', 109), 109);
  assert.equal(linesOf('ca', 112), 109);
  assert.equal(linesOf('ca', 117), 113);
  assert.equal(linesOf('ca', 119), 118);
  assert.equal(linesOf('tx', 111), 110); // court-ordered redraw for the 110th
  assert.equal(linesOf('pa', 115), 113);
  assert.equal(linesOf('pa', 117), 116); // Pennsylvania's 2018 map
  assert.equal(linesOf('nc', 116), 115);
  assert.equal(linesOf('nc', 117), 117);
  assert.equal(linesOf('nc', 119), 119);
});

test('a district place is named by its lines', () => {
  const p = districtPlace(stateByAbbr.get('ca'), '12', 113, 117);
  assert.equal(p.key, 'ca-12-l113');
  assert.equal(p.label, 'California District 12 (113th–117th Congress Lines)');
  assert.equal(districtPlace(stateByAbbr.get('wy'), '00', 118, 118).label, 'Wyoming at Large (118th Congress Lines)');
});
