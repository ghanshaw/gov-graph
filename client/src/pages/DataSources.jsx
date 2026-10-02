import PageLayout from '../components/PageLayout';
import { RailGroup, Fact } from '../components/Rail';

const BRANCHES = [
  {
    id: 'executive',
    label: 'Executive Branch',
    sources: [
      {
        name: 'Federal Register API',
        url: 'https://www.federalregister.gov/api/v1',
        displayUrl: 'federalregister.gov/api/v1',
        docTypes: ['Executive Orders', 'Memoranda', 'Proclamations', 'Notices', 'Rules'],
        auth: { label: 'No auth required', type: 'open' },
      },
    ],
  },
  {
    id: 'judicial',
    label: 'Judicial Branch',
    sources: [
      {
        name: 'CourtListener API',
        url: 'https://www.courtlistener.com/api/rest/v4',
        displayUrl: 'courtlistener.com/api/rest/v4',
        docTypes: ['Opinions', 'Dissents', 'Concurrences', 'Case Clusters'],
        auth: { label: 'Free token required', type: 'token', envVar: 'COURTLISTENER_TOKEN' },
      },
    ],
  },
  {
    id: 'legislative',
    label: 'Legislative Branch',
    sources: [
      {
        name: 'Congress.gov API',
        url: 'https://api.congress.gov/v3',
        displayUrl: 'api.congress.gov/v3',
        docTypes: ['Bills', 'Laws', 'Resolutions', 'Actions', 'Full Text'],
        auth: { label: 'API key required', type: 'key', envVar: 'CONGRESS_API_KEY' },
      },
    ],
  },
];

// What it takes to use a source: nothing, a free token, or an API key.
const AUTH_CHIP = { open: 'chip ok', token: 'chip danger', key: 'chip warn' };

function SourceTable({ children }) {
  return (
    <table className="records">
      <thead>
        <tr>
          <th>Source</th>
          <th className="wide-only">Holds</th>
          <th className="date">Access</th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export default function DataSources() {
  const sourceCount = BRANCHES.reduce((sum, branch) => sum + branch.sources.length, 0);

  const rail = (
    <>
      <RailGroup title="On this page">
        <div className="toc">
          {BRANCHES.map(branch => (
            <a key={branch.id} className="plain" href={`#${branch.id}`}>{branch.label}</a>
          ))}
          <a className="plain" href="#database">Internal Database</a>
        </div>
      </RailGroup>
      <RailGroup title="Sources">
        <Fact label="External APIs">{sourceCount}</Fact>
        <Fact label="Need no key">{BRANCHES.flatMap(b => b.sources).filter(s => s.auth.type === 'open').length}</Fact>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <div className="page-head">
        <h1 className="page-title">Data Sources <small>{sourceCount} APIs</small></h1>
      </div>
      <p className="lede">
        Every document in GovLens is fetched from a primary government or court API.
        No intermediaries — the data comes straight from the source.
      </p>

      {BRANCHES.map(branch => (
        <section key={branch.id} id={branch.id} className="page-section">
          <h2 className="section-title"><span className={`chip ${branch.id}`}>{branch.label}</span></h2>
          <SourceTable>
            {branch.sources.map(src => (
              <tr key={src.name}>
                <td className="title">
                  {src.name}
                  <span className="sub mono">
                    <a href={src.url} target="_blank" rel="noopener noreferrer">{src.displayUrl} ↗</a>
                  </span>
                </td>
                <td className="wide-only">
                  <div className="chips">
                    {src.docTypes.map(dt => <span key={dt} className="chip">{dt}</span>)}
                  </div>
                </td>
                <td className="date">
                  <span className={AUTH_CHIP[src.auth.type]}>{src.auth.label}</span>
                  {src.auth.envVar && <span className="env-var">{src.auth.envVar}</span>}
                </td>
              </tr>
            ))}
          </SourceTable>
        </section>
      ))}

      <section id="database" className="page-section">
        <h2 className="section-title"><span className="chip">Internal Database</span></h2>
        <SourceTable>
          <tr>
            <td className="title">
              Supabase / PostgreSQL
              <span className="sub">Self-hosted Postgres via Supabase</span>
              <span className="sub">
                Stores the citation graph — document nodes and typed edges
                (cites · revokes · amends · supersedes). Powers the Case Graph view.
              </span>
            </td>
            <td className="wide-only">
              <div className="chips">
                {['documents', 'document_relationships'].map(t => (
                  <span key={t} className="chip mono">{t}</span>
                ))}
              </div>
            </td>
            <td className="date">
              <span className="chip danger">Connection string required</span>
            </td>
          </tr>
        </SourceTable>
      </section>
    </PageLayout>
  );
}
