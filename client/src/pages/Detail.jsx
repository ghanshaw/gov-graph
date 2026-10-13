import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDER, GET_PRESIDENTIAL_DOCUMENT } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, RadioOptions, Fact } from '../components/Rail';
import TagPanel from '../components/TagPanel';
import OrderText from '../components/OrderText';
import OrderOutline from '../components/OrderOutline';
import Loading from '../components/Loading';

const PRESIDENT_NAMES = {
  'barack-obama':    'Barack Obama',
  'donald-trump':    'Donald Trump',
  'donald-trump-47': 'Donald Trump',
  'joseph-biden':    'Joe Biden',
};

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Wording per document type. The route's :docType is 'executive-orders' or 'memoranda'.
const DOC_TYPES = {
  'executive-orders': { plural: 'Executive Orders', singular: 'Executive Order', noun: 'order' },
  'memoranda': { plural: 'Presidential Memoranda', singular: 'Presidential Memorandum', noun: 'memorandum' },
};

// The stored text opens with "Administration of …" and "Executive Order N—Title",
// which this page already shows in its header.
function bodyParagraphs(body, number) {
  const paragraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (/^Administration of /.test(paragraphs[0] ?? '')) paragraphs.shift();
  if ((paragraphs[0] ?? '').startsWith(`Executive Order ${number}`)) paragraphs.shift();
  return paragraphs;
}

// What the rail's "In this order" group counts.
function orderFacts(structure) {
  const { preamble = [], sections = [], citations = [], publication } = structure;
  const items = sections.flatMap(s => s.items);
  const deadlines = [...preamble, ...items]
    .flatMap(item => item.spans ?? [])
    .filter(span => span.type === 'deadline').length;
  const pages = publication?.start_page && publication?.end_page
    ? publication.end_page - publication.start_page + 1
    : new Set(items.map(item => item.page).filter(Boolean)).size;
  // A document written as plain paragraphs is stored as one unnumbered section.
  return { sections: sections.filter(s => s.number != null).length, deadlines, citations: citations.length, pages };
}

export default function Detail() {
  // Executive orders are addressed by number (/eo/14160); documents without one, such as
  // memoranda, by Federal Register document number (/doc/2017-01503).
  const { slug, docType, number, documentNumber } = useParams();
  const type = DOC_TYPES[docType] ?? DOC_TYPES['executive-orders'];
  const { data, loading, error } = useQuery(
    number ? GET_EXECUTIVE_ORDER : GET_PRESIDENTIAL_DOCUMENT,
    { variables: number ? { number } : { documentNumber } }
  );

  const order = number ? data?.executiveOrder : data?.presidentialDocument;
  const structure = order?.structure;
  const hasText = Boolean(structure || order?.body);

  // The text is shown from the start; the button hides it.
  const [showText, setShowText] = useState(true);

  const [showPdf, setShowPdf] = useState(false);

  useEffect(() => {
    if (!showText || !hasText || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [showText, hasText]);

  const crumbs = (
    <Crumbs items={[
      { label: 'Presidents', to: '/' },
      { label: PRESIDENT_NAMES[slug] ?? slug, to: `/${slug}` },
      { label: type.plural, to: `/${slug}/${docType}` },
      { label: number ?? documentNumber },
    ]} />
  );

  if (!order) {
    return (
      <PageLayout head={crumbs}>
        {loading && <Loading />}
        {error && <div className="error">Error: {error.message}</div>}
        {!loading && !error && <div className="state">{type.singular} not found.</div>}
      </PageLayout>
    );
  }

  const facts = structure ? orderFacts(structure) : null;
  // Orders with no "Section 1" heading have a single unnumbered section.
  const numbered = structure?.sections?.filter(s => s.number != null) ?? [];
  const subjects = structure?.govinfo?.subjects ?? [];
  const publication = structure?.publication;
  // The order's page in govinfo's Compilation of Presidential Documents, where it has one.
  const govinfoUrl = structure?.govinfo?.details_url;

  // The rail's "Show" choice drives the same two switches as the buttons.
  const shown = showText && !showPdf ? 'text' : showPdf && !showText ? 'pdf' : null;
  const show = (what) => {
    setShowText(what === 'text');
    setShowPdf(what === 'pdf');
  };

  const head = (
    <>
      {crumbs}
      <span className="eyebrow">{order.number ? `${type.singular} ${order.number}` : type.singular}</span>
      <h1 className="doc-title">{order.title}</h1>
      {/* "Memorandum for the Secretary of …", or another printed heading that is not the title */}
      {(structure?.addressee || structure?.subheading) && (
        <p className="doc-addressee">{[structure.subheading, structure.addressee].filter(Boolean).join(' · ')}</p>
      )}

      <dl className="facts">
        {order.dateSigned && <div><dt>Signed</dt><dd>{formatDate(order.dateSigned)}</dd></div>}
        <div><dt>President</dt><dd>{PRESIDENT_NAMES[slug] ?? slug}</dd></div>
        {publication?.date && <div><dt>Published</dt><dd>{formatDate(publication.date)}</dd></div>}
        {publication?.citation && <div><dt>Citation</dt><dd className="mono">{publication.citation}</dd></div>}
      </dl>

      <div className="actions">
        {hasText && (
          <button
            type="button"
            className={showText ? 'btn active' : 'btn'}
            aria-expanded={showText}
            aria-controls="eo-text"
            onClick={() => setShowText(s => !s)}
          >
            {showText ? 'Hide full text' : 'Show full text'}
          </button>
        )}
        {order.pdfUrl && (
          <>
            <button
              type="button"
              className={showPdf ? 'btn active' : 'btn'}
              aria-expanded={showPdf}
              aria-controls="eo-pdf"
              onClick={() => setShowPdf(s => !s)}
            >
              {showPdf ? 'Hide PDF' : 'Show PDF'}
            </button>
            <a className="btn" href={order.pdfUrl} target="_blank" rel="noopener noreferrer">PDF ↗</a>
          </>
        )}
        {order.url && (
          <a className="btn" href={order.url} target="_blank" rel="noopener noreferrer">
            Federal Register ↗
          </a>
        )}
        {govinfoUrl && (
          <a className="btn" href={govinfoUrl} target="_blank" rel="noopener noreferrer">
            GovInfo ↗
          </a>
        )}
        {order.bodyHtmlUrl && !hasText && order.number && (
          <Link className="btn" to={`/${slug}/${docType}/eo/${order.number}/text`}>Full Text</Link>
        )}
      </div>
    </>
  );

  const rail = (
    <>
      {showText && numbered.length > 0 && <OrderOutline sections={numbered} />}
      {facts && (
        <RailGroup title={`In this ${type.noun}`}>
          <Fact label="Sections">{facts.sections}</Fact>
          <Fact label="Deadlines">{facts.deadlines}</Fact>
          <Fact label="Documents cited">{facts.citations}</Fact>
          {facts.pages > 0 && <Fact label="Printed pages">{facts.pages}</Fact>}
        </RailGroup>
      )}
      {hasText && order.pdfUrl && (
        <RailGroup title="Show">
          <RadioOptions
            label="Show"
            options={[
              { label: structure ? 'Formatted text' : 'Plain text', value: 'text' },
              { label: 'Printed PDF', value: 'pdf' },
            ]}
            value={shown}
            onChange={show}
          />
        </RailGroup>
      )}
      {subjects.length > 0 && (
        <RailGroup title="Subjects">
          <div className="chips">
            {subjects.map(subject => <span key={subject} className="chip">{subject}</span>)}
          </div>
        </RailGroup>
      )}
      {order.topics?.length > 0 && (
        <RailGroup title="Topics">
          <div className="chips">
            {order.topics.map(topic => <span key={topic} className="chip">{topic}</span>)}
          </div>
        </RailGroup>
      )}
    </>
  );

  return (
    <PageLayout head={head} rail={rail}>
      {order.abstract && (
        <>
          <h2 className="section-title">Summary</h2>
          <p className="summary">{order.abstract}</p>
        </>
      )}

      {/* PDF as printed in the Federal Register, passed through the server (see server/pdf.js) */}
      {order.pdfUrl && showPdf && (
        <iframe
          id="eo-pdf"
          className="pdf-frame"
          title={`${type.singular} ${order.number ?? order.documentNumber} (PDF)`}
          src={`${order.number ? `/pdf/eo/${order.number}` : `/pdf/doc/${order.documentNumber}`}#navpanes=0&view=FitH`}
        />
      )}

      {/* Full text: structured where the order has been parsed, plain paragraphs otherwise */}
      {hasText && showText && (
        <div id="eo-text">
          {structure ? (
            <OrderText structure={structure} />
          ) : (
            <div className="eo-full-text">
              {bodyParagraphs(order.body, order.number).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {order.documentNumber && <TagPanel itemRef={`fr:${order.documentNumber}`} />}
    </PageLayout>
  );
}
