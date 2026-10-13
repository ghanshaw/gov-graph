import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_POPULATION_FILE } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import Loading from '../components/Loading';
import { RailGroup, Fact } from '../components/Rail';
import { fileSize } from './Population';

const PAGE = 500;

// One Census Bureau file as published: a CSV or pipe-separated file as a grid of its cells, a text
// file as text, a spreadsheet one sheet at a time, a zip file as the list of what it holds.
export default function PopulationFile() {
  const [params, setParams] = useSearchParams();
  const path = params.get('path') ?? '';
  const offset = Number(params.get('offset') ?? 0);
  const sheet = Number(params.get('sheet') ?? 0);
  const { data, loading, error } = useQuery(GET_POPULATION_FILE, { variables: { path, offset, limit: PAGE, sheet } });
  const file = data?.populationFile;
  const go = changes => setParams({ path, ...(offset ? { offset } : {}), ...(sheet ? { sheet } : {}), ...changes });

  const crumbs = <Crumbs items={[{ label: 'Demographic Data', to: '/demographics/files' }, { label: path.split('/').pop() || 'File' }]} />;
  if (!file) {
    return (
      <PageLayout rail={null}>
        {crumbs}
        {loading && <Loading />}
        {error && <div className="error">Failed to read the file: {error.message}</div>}
        {!loading && !error && <div className="state">No such file in the data folder.</div>}
      </PageLayout>
    );
  }

  const pages = file.total != null && file.total > PAGE;
  const pager = pages && (
    <div className="pop-pager">
      <button type="button" className="btn" disabled={offset === 0} onClick={() => go({ offset: Math.max(0, offset - PAGE) })}>Previous</button>
      <span>{file.kind === 'text' ? 'Lines' : 'Rows'} {(offset + 1).toLocaleString()}–{Math.min(offset + PAGE, file.total).toLocaleString()} of {file.total.toLocaleString()}</span>
      <button type="button" className="btn" disabled={offset + PAGE >= file.total} onClick={() => go({ offset: offset + PAGE })}>Next</button>
    </div>
  );

  const rail = (
    <>
      <RailGroup title="File">
        <Fact label="Size">{fileSize(file.size)}</Fact>
        {file.total != null && <Fact label={file.kind === 'text' ? 'Lines' : 'Rows'}>{file.total.toLocaleString()}</Fact>}
        {file.sheets && <Fact label="Sheets">{file.sheets.length}</Fact>}
      </RailGroup>
      {file.sheets?.length > 1 && (
        <RailGroup title="Sheet">
          <ol className="toc">
            {file.sheets.map((name, i) => (
              <li key={name}>
                <a href={`?path=${encodeURIComponent(path)}&sheet=${i}`} className={i === file.sheet ? 'on' : undefined}
                  onClick={e => { e.preventDefault(); setParams({ path, ...(i ? { sheet: i } : {}) }); }}>
                  <span>{name}</span>
                </a>
              </li>
            ))}
          </ol>
        </RailGroup>
      )}
      <p className="source-note">
        As published by the Census Bureau at <a href={file.source} target="_blank" rel="noopener noreferrer">{file.source.replace('https://', '')}</a>.
      </p>
    </>
  );

  const grid = rows => (
    <div className="raw-scroll">
      <table className="raw-grid">
        <tbody>
          {file.header && (
            <tr className="repeat">{file.header.map((cell, c) => <td key={c}>{cell}</td>)}</tr>
          )}
          {rows.map((row, r) => (
            <tr key={r}>
              <th>{(offset + r + 1).toLocaleString()}</th>
              {row.map((cell, c) => <td key={c}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <PageLayout rail={rail}>
      {crumbs}
      <div className="page-head">
        <h1 className="page-title raw-title">{file.name}</h1>
      </div>
      <p className="pop-path">{file.path}</p>
      {pager}
      {file.kind === 'text' && <pre className="raw-text">{file.text}</pre>}
      {(file.kind === 'csv' || file.kind === 'pipe' || file.kind === 'sheets') && grid(file.rows)}
      {file.kind === 'zip' && (
        <ul className="raw-entries">{file.entries.map(e => <li key={e}>{e}</li>)}</ul>
      )}
      {pager}
    </PageLayout>
  );
}
