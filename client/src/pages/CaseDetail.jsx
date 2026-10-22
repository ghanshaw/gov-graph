import { useEffect, useRef, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_COURT_DECISION, GET_DECISION_BY_COURTLISTENER_ID, GET_NATURAL_COURTS } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, RadioOptions, Fact } from '../components/Rail';
import TagPanel from '../components/TagPanel';
import FavoriteButton from '../components/FavoriteButton';
import OpinionText from '../components/OpinionText';
import OpinionOutline from '../components/OpinionOutline';
import CaseOutcome from '../components/CaseOutcome';
import Loading from '../components/Loading';
import { formatDate } from '../people';

// Old links addressed a case by CourtListener record id (all digits); decisions are now
// addressed by docket number ("25-332", "24a884", "145-orig"), which always has a letter or dash.
const isCourtListenerId = id => /^\d+$/.test(id);

// /supreme-court/:courtSlug/<CourtListener id> → the decision's own address.
function CourtListenerRedirect({ id }) {
  const { data, loading, error } = useQuery(GET_DECISION_BY_COURTLISTENER_ID, { variables: { id } });
  const decision = data?.courtDecisionByCourtListenerId;
  if (decision) return <Navigate replace to={`/supreme-court/${decision.naturalCourt}/${decision.slug}`} />;
  return (
    <PageLayout head={<Crumbs items={[{ label: 'Supreme Court', to: '/supreme-court' }, { label: 'Case' }]} />}>
      {loading && <Loading />}
      {error && <div className="error">Failed to load case: {error.message}</div>}
      {!loading && !error && <div className="state">This case’s text has not been loaded.</div>}
    </PageLayout>
  );
}

function Decision({ courtSlug, slug }) {
  const { data, loading, error } = useQuery(GET_COURT_DECISION, { variables: { court: 'scotus', slug } });
  const { data: courtsData } = useQuery(GET_NATURAL_COURTS);
  const d = data?.courtDecision;
  const structure = d?.structure ?? null;

  // The text is shown from the start; the buttons hide it or put the PDF or citations above it.
  const [showText, setShowText] = useState(true);
  const [showPdf, setShowPdf] = useState(false);
  const [showAuthorities, setShowAuthorities] = useState(false);
  // The outcome is short and is what most readers come for, so it starts open.
  const [showOutcome, setShowOutcome] = useState(true);
  // The page the PDF viewer opens at, set from the contents list while only the PDF is shown.
  const [pdfPage, setPdfPage] = useState(1);
  // After a page is picked the viewer is a new frame; bring it into view once it exists.
  const pickedPage = useRef(false);
  useEffect(() => {
    if (!pickedPage.current) return;
    pickedPage.current = false;
    document.getElementById('case-pdf')?.scrollIntoView();
  }, [pdfPage]);
  // Counts opinions as their text arrives, so the contents list can watch their parts.
  const [loaded, setLoaded] = useState(0);

  const court = courtsData?.naturalCourts?.find(nc => nc.slug === (d?.naturalCourt ?? courtSlug));
  const courtName = court?.name || courtSlug;
  const citation = d?.citation || d?.slipCitation;

  const crumbs = (
    <Crumbs items={[
      { label: 'Supreme Court', to: '/supreme-court' },
      { label: courtName, to: `/supreme-court/${court?.slug ?? courtSlug}` },
      { label: citation || d?.docketNumbers?.join(', ') || 'Case' },
    ]} />
  );

  if (!d) {
    return (
      <PageLayout head={crumbs}>
        {loading && <Loading />}
        {error && <div className="error">Failed to load case: {error.message}</div>}
        {!loading && !error && <div className="state">Case not found.</div>}
      </PageLayout>
    );
  }

  const pdfUrl = d.pdfUrl;
  const outcome = structure?.outcome;

  // The rail's "Show" choice drives the same two switches as the buttons.
  const shown = showText && !showPdf ? 'text' : showPdf && !showText ? 'pdf' : null;
  const show = (what) => {
    setShowText(what === 'text');
    setShowPdf(what === 'pdf');
  };

  const head = (
    <>
      {crumbs}
      <span className="eyebrow">Supreme Court · {courtName}</span>
      <h1 className="doc-title">{d.name}</h1>

      <dl className="facts">
        {d.dateArgued && <div><dt>Argued</dt><dd>{formatDate(d.dateArgued)}</dd></div>}
        <div><dt>Decided</dt><dd>{formatDate(d.dateDecided)}</dd></div>
        {citation && <div><dt>Citation</dt><dd className="mono">{citation}</dd></div>}
        <div><dt>Docket</dt><dd className="mono">{d.docketNumbers.join(', ')}</dd></div>
        {d.disposition && <div><dt>Judgment</dt><dd>{d.disposition.replace(/\.$/, '')}</dd></div>}
        {d.voteMajority != null && (
          <div><dt>Decision</dt><dd>{d.voteMajority}–{d.voteMinority ?? 0}</dd></div>
        )}
      </dl>

      <div className="actions">
        <FavoriteButton itemRef={`scotus:${d.slug}`} />
        {structure && (
          <button
            type="button"
            className={showText ? 'btn active' : 'btn'}
            aria-expanded={showText}
            aria-controls="case-text"
            onClick={() => setShowText(s => !s)}
          >
            {showText ? 'Hide full text' : 'Show full text'}
          </button>
        )}
        {pdfUrl && (
          <button
            type="button"
            className={showPdf ? 'btn active' : 'btn'}
            aria-expanded={showPdf}
            aria-controls="case-pdf"
            onClick={() => setShowPdf(s => !s)}
          >
            {showPdf ? 'Hide PDF' : 'Show PDF'}
          </button>
        )}
        {outcome && (
          <button
            type="button"
            className={showOutcome ? 'btn active' : 'btn'}
            aria-expanded={showOutcome}
            aria-controls="case-outcome"
            onClick={() => setShowOutcome(s => !s)}
          >
            {showOutcome ? 'Hide outcome' : 'Show outcome'}
          </button>
        )}
        {structure?.citations?.length > 0 && (
          <button
            type="button"
            className={showAuthorities ? 'btn active' : 'btn'}
            aria-expanded={showAuthorities}
            aria-controls="case-authorities"
            onClick={() => { setShowAuthorities(s => !s); setShowText(true); }}
          >
            {showAuthorities ? 'Hide citations' : 'Show citations'}
          </button>
        )}
        {pdfUrl && <a className="btn" href={pdfUrl} target="_blank" rel="noopener noreferrer">PDF ↗</a>}
        {d.courtListenerUrl && <a className="btn" href={d.courtListenerUrl} target="_blank" rel="noopener noreferrer">CourtListener ↗</a>}
        {d.caseGraphId != null && (
          <Link className="btn" to={`/case-graph?caseId=${d.caseGraphId}`}>View in Case Graph →</Link>
        )}
      </div>
    </>
  );

  const rail = structure && (
    <>
      {/* Beside the text the contents follow the reading; beside the PDF alone they turn its pages. */}
      {(showText || showPdf) && (
        <OpinionOutline
          structure={structure}
          watch={`${loaded}-${showText}`}
          onPick={showText ? undefined : entry => {
            pickedPage.current = true;
            setPdfPage(entry.pdfPage ?? 1);
          }}
        />
      )}
      <RailGroup title="In this decision">
        <Fact label="Opinions">{structure.opinions.length}</Fact>
        <Fact label="Footnotes">{structure.opinions.reduce((n, o) => n + o.footnote_count, 0)}</Fact>
        <Fact label="Authorities cited">{structure.citations.length}</Fact>
        {structure.source?.pages > 0 && <Fact label="Printed pages">{structure.source.pages}</Fact>}
      </RailGroup>
      {pdfUrl && (
        <RailGroup title="Show">
          <RadioOptions
            label="Show"
            options={[
              { label: 'Formatted text', value: 'text' },
              { label: 'Printed PDF', value: 'pdf' },
            ]}
            value={shown}
            onChange={show}
          />
        </RailGroup>
      )}
    </>
  );

  return (
    <PageLayout head={head} rail={rail}>
      {outcome && showOutcome && <CaseOutcome structure={structure} votes={d.votes} onJump={() => setShowText(true)} />}

      {/* The slip opinion as the Court published it; supremecourt.gov allows it to be framed.
          The viewer only reads the page number when it loads, so a new page is a new frame. */}
      {pdfUrl && showPdf && (
        <iframe
          key={pdfPage}
          id="case-pdf"
          className={showText ? 'pdf-frame' : 'pdf-frame tall'}
          title={`${d.name} (PDF)`}
          src={`${pdfUrl}#page=${pdfPage}&navpanes=0&view=FitH`}
        />
      )}

      {structure && showText && (
        <div id="case-text">
          <OpinionText
            decisionId={d.id}
            structure={structure}
            showAuthorities={showAuthorities}
            onLoaded={() => setLoaded(n => n + 1)}
          />
        </div>
      )}

      <TagPanel itemRef={`scotus:${d.slug}`} />
    </PageLayout>
  );
}

export default function CaseDetail() {
  const { courtSlug, caseId } = useParams();
  return isCourtListenerId(caseId)
    ? <CourtListenerRedirect id={caseId} />
    : <Decision courtSlug={courtSlug} slug={caseId} />;
}
