import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_SOURCE_PROGRAM, GET_SOURCE_FILES } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, Fact } from '../components/Rail';
import Loading from '../components/Loading';
import { shortDate } from '../dates';
import { bytes, LICENCE_CHIP, accessChip, abstractLabel, publishers } from '../sources';
import AbstractTables, { coverageCounts } from '../components/AbstractTables';

const ROLE = { publisher: 'Publisher', producer: 'Producer', distributor: 'Distributor', 'former-publisher': 'Former publisher' };
const LINEAGE = { renamed: 'Renamed', merged: 'Merged', transferred: 'Transferred', split: 'Split', abolished: 'Abolished' };

const external = (href, label) => <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>;

// The files of one folder, fetched when the folder is opened.
function FolderFiles({ slug, folder }) {
  const { data, loading } = useQuery(GET_SOURCE_FILES, { variables: { program: slug, folder, limit: 1000 } });
  if (loading) return <tr><td colSpan={4} className="meta">Loading…</td></tr>;
  return (data?.sourceFiles ?? []).map(f => (
    <tr key={f.path} className="file-row">
      <td className="mono">
        {f.url ? external(f.url, f.path.slice(folder.length + 1)) : f.path.slice(folder.length + 1)}
        {f.archive && <span className="sub">Internet Archive capture {f.archive}</span>}
      </td>
      <td className="date">{bytes(f.size)}</td>
      <td className="date">{shortDate(f.fetchedAt ?? f.modifiedAt)}</td>
      <td className="mono meta nowrap wide-only" title={`sha-256 ${f.sha256}`}>{f.sha256.slice(0, 8)}</td>
    </tr>
  ));
}

// One program: its publishers and their history, terms, how it is fetched, where it stands against the
// Statistical Abstract, the series made from it and the files downloaded, by folder.
export default function SourceProgram() {
  const { slug } = useParams();
  const { data, loading, error } = useQuery(GET_SOURCE_PROGRAM, { variables: { slug } });
  const [open, setOpen] = useState(() => new Set());
  const d = data?.sourceProgram;
  const access = data?.sourceVocabulary?.access ?? {};
  const crumbs = <Crumbs items={[{ label: 'Sources', to: '/sources' }, { label: d?.name ?? slug }]} />;

  if (loading || error || !d) {
    return (
      <PageLayout head={crumbs}>
        {loading && <Loading />}
        {error && <div className="error">Failed to load: {error.message}</div>}
        {!loading && !error && <div className="state">No program {slug}.</div>}
      </PageLayout>
    );
  }

  const l = d.licenceDetail ?? {};
  const toggle = path => setOpen(s => {
    const next = new Set(s);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });

  const head = (
    <>
      {crumbs}
      <span className="eyebrow">{d.kindLabel.replace(/s$/, '')}</span>
      <h1 className="doc-title">{d.name}</h1>
      <p className="doc-subtitle">{d.description}</p>
      <dl className="facts">
        <div><dt>Published by</dt><dd>{publishers(d).map(o => o.name).join('; ')}</dd></div>
        <div><dt>Terms</dt><dd><span className={LICENCE_CHIP[d.licence]}>{d.licenceLabel}</span></dd></div>
        <div><dt>Status</dt><dd>{d.statusLabel}{d.ended && <small>{shortDate(d.ended)}</small>}</dd></div>
        <div><dt>Statistical Abstract</dt><dd>{abstractLabel(d.inAbstract)}</dd></div>
      </dl>
      <div className="actions">
        <a className="btn" href={d.homepage} target="_blank" rel="noopener noreferrer">Publisher’s page ↗</a>
        {l.url && <a className="btn" href={l.url} target="_blank" rel="noopener noreferrer">Terms ↗</a>}
      </div>
    </>
  );

  const rail = (
    <RailGroup title="Collected">
      <Fact label="Files">{d.fileCount.toLocaleString()}</Fact>
      <Fact label="On disk">{bytes(d.fileBytes)}</Fact>
      {d.lastModified && <Fact label="Latest file">{shortDate(d.lastModified)}</Fact>}
      <Fact label="Series">{d.seriesCount.toLocaleString()}</Fact>
      {d.abstractTableCount > 0 && <Fact label="Abstract tables">{d.abstractTableCount}</Fact>}
    </RailGroup>
  );

  return (
    <PageLayout head={head} rail={rail}>
      <section className="page-section">
        <h2 className="section-title">Terms</h2>
        <dl className="source-terms">
          <dt>Licence</dt>
          <dd>{l.name ?? d.licenceLabel}{d.licence === 'public-domain' && !l.name && ' (a work of the U.S. government, 17 U.S.C. 105)'}</dd>
          {l.attribution && <><dt>Credit as</dt><dd>{l.attribution}</dd></>}
          {l.limits && <><dt>Limits</dt><dd>{l.limits}</dd></>}
          {l.note && <><dt>Note</dt><dd>{l.note}</dd></>}
          {l.checked && <><dt>Checked</dt><dd>{shortDate(l.checked)}</dd></>}
          {!d.collected && <><dt>Collected</dt><dd>{d.licence === 'licensed' ? 'No: licensed data is listed here but not collected.'
            : d.fileCount ? 'Downloaded, not loaded yet.' : 'Not yet: a Statistical Abstract table names it.'}</dd></>}
        </dl>
      </section>

      <section className="page-section">
        <h2 className="section-title">Fetched by</h2>
        <dl className="source-terms">
          <dt>Now</dt>
          <dd><span className="chips">{d.accessUsed.length ? d.accessUsed.map(a => <span key={a} className={accessChip(a)}>{access[a]}</span>) : 'Not fetched'}</span></dd>
          {d.accessBest && !d.accessUsed.includes(d.accessBest) && <><dt>Better</dt><dd>{access[d.accessBest]}</dd></>}
          {d.accessKey && <><dt>Key</dt><dd className="mono">{d.accessKey}</dd></>}
          {d.accessContact && <><dt>Contact</dt><dd>The publisher requires a contact address with each request.</dd></>}
          {d.accessNote && <><dt>Note</dt><dd>{d.accessNote}</dd></>}
        </dl>
      </section>

      {d.abstractTables.length > 0 && (
        <section className="page-section">
          <h2 className="section-title">
            In the Statistical Abstract{' '}
            <small>
              {d.abstractTables.length} {d.abstractTables.length === 1 ? 'table' : 'tables'}
              {' · '}{coverageCounts(d.abstractTables).map(([c, n]) => `${n} ${data.sourceVocabulary.coverage[c].toLowerCase()}`).join(' · ')}
            </small>
          </h2>
          <AbstractTables tables={d.abstractTables} vocabulary={data.sourceVocabulary} except={d.slug} />
          <p className="note">Tables of the 2012 edition whose source note names this program. <Link to="/sources/abstract-coverage">Every table</Link></p>
        </section>
      )}

      {d.inAbstract === false && (
        <section className="page-section">
          <h2 className="section-title">Not in the Statistical Abstract</h2>
          <p className="source-text">{d.outsideAbstract}</p>
        </section>
      )}

      <section className="page-section">
        <h2 className="section-title">Organizations</h2>
        <table className="records">
          <tbody>
            {d.organizations.map(({ role, organization: o }) => (
              <tr key={`${role}-${o.slug}`}>
                <td className="meta nowrap">{ROLE[role] ?? role}</td>
                <td className="title">
                  {o.url ? external(o.url, o.name) : o.name}
                  <span className="sub">{[o.kindLabel, o.parentName].filter(Boolean).join(' · ')}</span>
                  {o.notes && <span className="sub">{o.notes}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.lineage?.length > 0 && (
          <ul className="source-lineage">
            {d.lineage.map(x => (
              <li key={`${x.from}-${x.to}-${x.date}`}>
                <span className="date">{shortDate(x.date)}</span>{' '}
                {LINEAGE[x.kind]}: {x.fromName}{x.toName && ` → ${x.toName}`}
                {x.citation && <span className="sub"> ({x.href ? <Link to={x.href}>{x.citation}</Link> : x.citation})</span>}
                {x.notes && <span className="sub"> {x.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.notes && (
        <section className="page-section">
          <h2 className="section-title">Notes</h2>
          <p className="source-text">{d.notes}</p>
        </section>
      )}

      {d.series.length > 0 && (
        <section className="page-section">
          <h2 className="section-title">Series {d.seriesCount > d.series.length && <small>{d.series.length} national of {d.seriesCount.toLocaleString()}, the rest by place</small>}</h2>
          <table className="records">
            <thead><tr><th>Series</th><th className="wide-only">Every</th><th className="date">From</th><th className="date">To</th></tr></thead>
            <tbody>
              {d.series.map(s => (
                <tr key={s.slug}>
                  <td className="title">{s.name}</td>
                  <td className="meta wide-only">{s.frequency}</td>
                  <td className="date">{shortDate(s.firstDate)}</td>
                  <td className="date">{shortDate(s.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {d.downloadPlan && <DownloadList plan={d.downloadPlan} />}

      {d.folders.length > 0 && (
        <section className="page-section">
          <h2 className="section-title">Files</h2>
          <table className="records source-files">
            <thead><tr><th>Folder</th><th className="date">Size</th><th className="date">Fetched</th><th className="wide-only">Files</th></tr></thead>
            <tbody>
              {d.folders.map(f => (
                <FolderRows key={f.path} slug={d.slug} folder={f} open={open.has(f.path)} onToggle={() => toggle(f.path)} />
              ))}
            </tbody>
          </table>
          {d.folders.length === 200 && <p className="note">The first 200 folders.</p>}
          <p className="note">Kept in the data folder at the publisher’s own paths. Links are the address each file was fetched from; for files fetched before addresses were recorded, the address is worked out from the path.</p>
        </section>
      )}
    </PageLayout>
  );
}

// What one entry of the download list asks for, in words.
function entryText(e) {
  const where = e.url ?? e.list ?? e.catalog;
  const what = e.catalog ? `Datasets titled /${e.title}/ in the catalog`
    : e.list ? `Every file ${e.page ? 'the page links to' : 'in the folder'}${e.match ? ` matching /${e.match}/` : ''}${e.recursive ? ', with subfolders' : ''}${e.follow ? `, through pages matching /${e.follow}/` : ''}`
    : 'One file';
  return { where, what: e.years ? `${what}, ${e.years}` : what };
}

// The program's entry on the download list (seed/data/downloads.json, Phase 5a) and what of it is not on disk.
function DownloadList({ plan }) {
  const [showAll, setShowAll] = useState(false);
  const missing = showAll ? plan.missing : plan.missing.slice(0, 50);
  const summary = plan.state === 'nothing' ? 'No file to get'
    : plan.toGet ? 'Still to get' : 'Everything listed is on disk';
  return (
    <section className="page-section">
      <h2 className="section-title">Download list <small>{summary}</small></h2>
      <dl className="source-terms">
        {plan.needsLabel && <><dt>Left to settle</dt><dd><span className="chip">{plan.needsLabel}</span></dd></>}
        {plan.none && <><dt>No file</dt><dd>{plan.none}</dd></>}
        {plan.note && <><dt>Note</dt><dd>{plan.note}</dd></>}
        {plan.listed > 0 && (
          <><dt>Files</dt><dd>{plan.have.toLocaleString()} of {plan.listed.toLocaleString()} on disk{plan.listedBytes > 0 && ` (${bytes(plan.listedBytes)} measured)`}</dd></>
        )}
        <dt>Checked</dt><dd>{shortDate(plan.checked)}{plan.draft && ' (draft, not yet reviewed)'}</dd>
      </dl>
      {plan.entries.length > 0 && (
        <table className="records">
          <thead><tr><th>What the list asks for</th></tr></thead>
          <tbody>
            {plan.entries.map((e, i) => {
              const { where, what } = entryText(e);
              return (
                <tr key={i}>
                  <td className="title">
                    {what}<span className="sub mono">{external(where.replace(/\{y(ear|y)\}/g, '…'), where)}</span>
                    {e.note && <span className="sub">{e.note}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {plan.listingErrors.length > 0 && (
        <>
          <h3 className="download-subhead">Listed nothing</h3>
          <ul className="source-lineage">{plan.listingErrors.map(x => <li key={x} className="mono">{x}</li>)}</ul>
        </>
      )}
      {plan.missing.length > 0 && (
        <>
          <h3 className="download-subhead">Not on disk <small>{plan.missing.length.toLocaleString()}</small></h3>
          <table className="records">
            <thead><tr><th>File</th><th className="date">Size</th><th className="wide-only">Why</th></tr></thead>
            <tbody>
              {missing.map(f => (
                <tr key={f.url}>
                  <td className="mono">{external(f.url, f.path)}</td>
                  <td className="date">{f.bytes ? bytes(f.bytes) : '—'}</td>
                  <td className="meta wide-only">{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {plan.missing.length > missing.length && (
            <button type="button" className="btn" onClick={() => setShowAll(true)}>Show all {plan.missing.length.toLocaleString()}</button>
          )}
        </>
      )}
      <p className="note">From the download list (Phase 5a), the files each program needs from its publisher; fetched into the data folder in Phase 5b.</p>
    </section>
  );
}

function FolderRows({ slug, folder, open, onToggle }) {
  return (
    <>
      <tr className="folder-row">
        <td className="mono">
          <button type="button" className="folder-toggle" aria-expanded={open} onClick={onToggle}>{open ? '−' : '+'} {folder.path}/</button>
        </td>
        <td className="date">{bytes(folder.bytes)}</td>
        <td className="date">{shortDate(folder.lastModified)}</td>
        <td className="meta wide-only">{folder.count.toLocaleString()}</td>
      </tr>
      {open && <FolderFiles slug={slug} folder={folder.path} />}
    </>
  );
}
