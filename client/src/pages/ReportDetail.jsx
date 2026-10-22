import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_REPORT } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, RadioOptions, Fact } from '../components/Rail';
import ReportText from '../components/ReportText';
import ReportOutline from '../components/ReportOutline';
import Loading from '../components/Loading';
import TagPanel from '../components/TagPanel';
import FavoriteButton from '../components/FavoriteButton';
import { formatDate } from '../people';

// govinfo's PDFs cannot be framed directly; server/pdf.js passes them through (/pdf/govinfo/…).
const pdfPath = url => {
  const m = /\/content\/pkg\/([A-Za-z0-9-]+)\/pdf\/([A-Za-z0-9-]+)\.pdf$/.exec(url ?? '');
  return m ? `/pdf/govinfo/${m[1]}/${m[2]}` : null;
};

// A document the report is linked to: its page here once loaded, otherwise the source.
function RelatedLink({ doc }) {
  return doc.href
    ? <Link to={doc.href}>{doc.citation}</Link>
    : <a href={doc.url} target="_blank" rel="noopener noreferrer">{doc.citation} ↗</a>;
}

// The recommendations, in reading order, each linking to its place in the text.
function Recommendations({ structure }) {
  const partLabel = Object.fromEntries(structure.parts.map(p => [p.id, p.kind === 'chapter' ? `Ch. ${p.number}` : p.label]));
  const jump = (event, rec) => {
    // The part may not be loaded yet: go to it so it loads; the text holds the recommendation in view
    // once it arrives (ReportText, useHoldTarget).
    event.preventDefault();
    (document.getElementById(rec.id) ?? document.getElementById(rec.part))?.scrollIntoView();
    window.location.assign(`#${rec.id}`);
  };
  return (
    <div className="page-section" id="report-recommendations">
      <h2 className="section-title">Recommendations</h2>
      <ol className="recommendation-list">
        {structure.recommendations.map(rec => (
          <li key={rec.id}>
            <span className="rec-num">{rec.number}</span>
            <a href={`#${rec.id}`} onClick={e => jump(e, rec)}>{rec.text}</a>
            <span className="rec-where">{partLabel[rec.part]}</span>
          </li>
        ))}
      </ol>
      <p className="source-note">
        The Commission set each recommendation in bold, beginning “Recommendation:”, without numbers; they are numbered
        here in reading order. The executive summary restates them and is not counted.
      </p>
    </div>
  );
}

export default function ReportDetail() {
  const { slug } = useParams();
  const { data, loading, error } = useQuery(GET_REPORT, { variables: { slug } });
  const r = data?.report;
  const structure = r?.structure ?? null;

  const [showText, setShowText] = useState(true);
  const [showPdf, setShowPdf] = useState(false);
  const [showRecs, setShowRecs] = useState(false);
  // The PDF shown: the whole report, or the part picked in the contents list.
  const [pdfUrl, setPdfUrl] = useState(null);
  const pickedPart = useRef(false);
  useEffect(() => {
    if (!pickedPart.current) return;
    pickedPart.current = false;
    document.getElementById('report-pdf')?.scrollIntoView();
  }, [pdfUrl]);
  const [loaded, setLoaded] = useState(0);

  const crumbs = <Crumbs items={[{ label: 'Reports', to: '/reports' }, { label: r?.shortTitle ?? 'Report' }]} />;
  if (!r) {
    return (
      <PageLayout head={crumbs}>
        {loading && <Loading />}
        {error && <div className="error">Failed to load report: {error.message}</div>}
        {!loading && !error && <div className="state">Report not found.</div>}
      </PageLayout>
    );
  }

  const createdBy = r.related.filter(d => d.relation === 'created_by');
  const followedBy = r.related.filter(d => d.relation === 'followed_by');
  const wholePdf = pdfPath(structure?.source?.pdf_url);
  const shownPdf = pdfUrl ?? wholePdf;
  const shown = showText && !showPdf ? 'text' : showPdf && !showText ? 'pdf' : null;
  const show = what => {
    setShowText(what === 'text');
    setShowPdf(what === 'pdf');
  };
  const toggle = (on, set, id, labels) => (
    <button type="button" className={on ? 'btn active' : 'btn'} aria-expanded={on} aria-controls={id} onClick={() => set(s => !s)}>
      {on ? labels[1] : labels[0]}
    </button>
  );

  const head = (
    <>
      {crumbs}
      <span className="eyebrow">Report · {r.kindLabel}</span>
      <h1 className="doc-title">{r.shortTitle ?? r.title}</h1>
      {r.shortTitle && <p className="doc-subtitle">{r.title}</p>}

      <dl className="facts">
        <div><dt>Issued</dt><dd>{formatDate(r.dateIssued)}</dd></div>
        <div><dt>By</dt><dd>{r.issuer}</dd></div>
        {createdBy.map(d => <div key={d.citation}><dt>Created by</dt><dd><RelatedLink doc={d} /></dd></div>)}
        {r.sourceId && <div><dt>govinfo</dt><dd className="mono">{r.sourceId}</dd></div>}
      </dl>

      <div className="actions">
        <FavoriteButton itemRef={`report:${r.slug}`} />
        {structure && toggle(showText, setShowText, 'report-text', ['Show full text', 'Hide full text'])}
        {wholePdf && toggle(showPdf, setShowPdf, 'report-pdf', ['Show PDF', 'Hide PDF'])}
        {structure?.recommendations?.length > 0 && toggle(showRecs, setShowRecs, 'report-recommendations',
          [`Show recommendations (${structure.recommendations.length})`, 'Hide recommendations'])}
        {r.govinfoUrl && <a className="btn" href={r.govinfoUrl} target="_blank" rel="noopener noreferrer">govinfo ↗</a>}
        {r.sourceUrl && <a className="btn" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">Commission site ↗</a>}
      </div>
    </>
  );

  const rail = structure && (
    <>
      {(showText || showPdf) && (
        <ReportOutline
          structure={structure}
          watch={`${loaded}-${showText}`}
          onPick={showText ? undefined : part => {
            pickedPart.current = true;
            setPdfUrl(pdfPath(part.pdf_url));
          }}
        />
      )}
      <RailGroup title="In this report">
        <Fact label="Chapters">{structure.counts.chapters}</Fact>
        <Fact label="Recommendations">{structure.counts.recommendations}</Fact>
        <Fact label="Notes">{structure.counts.notes.toLocaleString()}</Fact>
      </RailGroup>
      {wholePdf && (
        <RailGroup title="Show">
          <RadioOptions
            label="Show"
            options={[{ label: 'Formatted text', value: 'text' }, { label: 'Printed PDF', value: 'pdf' }]}
            value={shown}
            onChange={show}
          />
        </RailGroup>
      )}
    </>
  );

  return (
    <PageLayout head={head} rail={rail}>
      {showRecs && structure && <Recommendations structure={structure} />}

      {followedBy.length > 0 && (
        <div className="page-section report-laws">
          <h2 className="section-title">What followed</h2>
          <ul className="related-list">
            {followedBy.map(d => (
              <li key={d.citation}>
                <span className="date">{formatDate(d.date)}</span>
                <span><RelatedLink doc={d} /> · {d.title}{d.notes && <span className="sub">{d.notes}</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* GPO's edition on govinfo, whole or the part picked in the contents. */}
      {shownPdf && showPdf && (
        <iframe
          key={shownPdf}
          id="report-pdf"
          className={showText ? 'pdf-frame' : 'pdf-frame tall'}
          title={`${r.shortTitle ?? r.title} (PDF)`}
          src={`${shownPdf}#navpanes=0&view=FitH`}
        />
      )}

      {structure && showText && (
        <div id="report-text">
          <ReportText slug={r.slug} structure={structure} onLoaded={() => setLoaded(n => n + 1)} />
        </div>
      )}

      <TagPanel itemRef={`report:${r.slug}`} />
    </PageLayout>
  );
}
