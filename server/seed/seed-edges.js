import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const edges = [
  { citing: 264, cited: 263 }, // Casey -> Roe
  { citing: 265, cited: 264 }, // Dobbs -> Casey
  { citing: 265, cited: 263 }, // Dobbs -> Roe
];

for (const { citing, cited } of edges) {
  const res = await client.query(
    `INSERT INTO cg_case_relationships (citing_case_id, cited_case_id, source)
     VALUES ($1, $2, 'courtlistener')
     ON CONFLICT (citing_case_id, cited_case_id) DO NOTHING
     RETURNING id`,
    [citing, cited]
  );
  console.log(`Edge ${citing} -> ${cited}: ${res.rows[0]?.id ? 'inserted id=' + res.rows[0].id : 'already exists'}`);
}

client.release();
await pool.end();
