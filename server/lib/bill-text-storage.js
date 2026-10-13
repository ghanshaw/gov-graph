// How a parsed bill text version (parse-bill-xml.js) is laid out in the database. Shared by
// seed/load-bill-text.js (one bill, via Congress.gov) and seed/load-bill-text-bulk.js (govinfo zips).
//
//   legislative_documents: one row per version. `doc_type` is the version code ("ih", "enr"),
//     `source_id` the govinfo package id (BILLS-119hr1enr), `structure` everything except the
//     section text, `source_xml` the raw file.
//   legislative_document_sections: one row per section, in reading order, so the client can
//     load a long bill a few sections at a time.

export const SCHEMA = `
  -- filled by seed/load-bill-status-bulk.js; read here for each version's official label and date
  ALTER TABLE legislation ADD COLUMN IF NOT EXISTS details JSONB;
  ALTER TABLE legislative_documents
    ADD COLUMN IF NOT EXISTS structure JSONB,
    ADD COLUMN IF NOT EXISTS source_xml TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS legislative_documents_source_id_key ON legislative_documents (source_id);
  CREATE INDEX IF NOT EXISTS legislative_documents_legislation_id_idx ON legislative_documents (legislation_id);
  CREATE TABLE IF NOT EXISTS legislative_document_sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES legislative_documents(id) ON DELETE CASCADE,
    position    INT  NOT NULL,   -- reading order within the version, from 0
    section_id  TEXT NOT NULL,   -- anchor within the version, e.g. sec-10101
    number      TEXT,
    heading     TEXT,
    structure   JSONB NOT NULL,  -- { number, title, id, path, items }
    UNIQUE (document_id, position)
  );
`;

/** Split a parsed version into what is stored on the document row and its section rows. */
export function splitForStorage(parsed) {
  const { sections, ...head } = parsed;
  // What the client needs before any section text: where each section sits and how long it is.
  head.section_index = sections.map((s, position) => ({
    position,
    id: s.id,
    // Length of the section when printed; a table of contents counts a line per entry.
    chars: s.items.reduce((n, item) => n + item.text.length + (item.entries?.length ?? 0) * 85, 0),
    ...(s.changed ? { changed: s.changed } : {}),
  }));
  return { head, sections };
}

/** "BILLS-119hconres14enr" → { congress: 119, type: "hconres", number: "14", code: "enr" } */
export function parsePackageId(packageId) {
  const m = /^BILLS-(\d+)([a-z]+?)(\d+)([a-z][a-z0-9]*)$/.exec(packageId);
  return m ? { congress: Number(m[1]), type: m[2], number: m[3], code: m[4] } : null;
}
