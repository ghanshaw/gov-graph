import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_SCOTUS_CASE, GET_CASE_IN_GRAPH } from '../queries';
import TagPanel from '../components/TagPanel';

const DIRECTION_LABEL = {
  'liberal': 'Liberal',
  'conservative': 'Conservative',
};

const OPINION_TYPE_ORDER = [
  'Majority Opinion', 'Plurality Opinion', 'Concurrence',
  'Concurrence in Part / Dissent in Part', 'Dissent',
];

function OpinionRow({ opinion }) {
  const label = opinion.perCuriam ? 'Per Curiam' : opinion.author || 'Unknown';
  return (
    <a
      href={opinion.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1rem 1.25rem',
        background: 'rgba(17,32,64,0.4)',
        border: '1px solid rgba(201,168,76,0.12)',
        borderRadius: '4px',
        textDecoration: 'none',
        transition: 'all 0.15s',
        marginBottom: '0.5rem',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)';
        e.currentTarget.style.background = 'rgba(17,32,64,0.7)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(201,168,76,0.12)';
        e.currentTarget.style.background = 'rgba(17,32,64,0.4)';
      }}
    >
      <div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.65rem',
          color: 'var(--gold)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '0.2rem',
        }}>
          {opinion.type}
        </div>
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '0.9rem',
          color: 'var(--cream)',
        }}>
          {label}
        </div>
      </div>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.7rem',
        color: 'var(--gold)',
        opacity: 0.6,
      }}>↗</span>
    </a>
  );
}

export default function CaseDetail() {
  const { courtSlug, caseId } = useParams();
  const { data, loading, error } = useQuery(GET_SCOTUS_CASE, {
    variables: { id: caseId },
  });
  const { data: graphData } = useQuery(GET_CASE_IN_GRAPH, {
    variables: { clusterId: parseInt(caseId, 10) },
  });
  const graphCaseId = graphData?.caseInGraph ?? null;

  const c = data?.scotusCase;
  const courtName = data?.naturalCourts?.find(nc => nc.slug === courtSlug)?.name || courtSlug;

  const formattedDate = c?.dateFiled
    ? new Date(c.dateFiled + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  const voteDisplay = c?.votesMajority != null && c?.votesMinority != null
    ? `${c.votesMajority}–${c.votesMinority}`
    : null;

  const direction = DIRECTION_LABEL[c?.decisionDirection] || null;

  const groupedOpinions = c?.opinions
    ? OPINION_TYPE_ORDER.reduce((acc, type) => {
        const group = c.opinions.filter(o => o.type === type);
        if (group.length) acc.push({ type, opinions: group });
        return acc;
      }, [])
    : [];

  const otherOpinions = c?.opinions?.filter(o => !OPINION_TYPE_ORDER.includes(o.type)) || [];
  if (otherOpinions.length) groupedOpinions.push({ type: 'Other', opinions: otherOpinions });

  return (
    <main style={{ maxWidth: '820px', margin: '0 auto', padding: '3rem 2rem' }}>
      <Link to={`/supreme-court/${courtSlug}`} style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        textDecoration: 'none',
        letterSpacing: '0.08em',
        marginBottom: '3rem',
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        ← {courtName}
      </Link>

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>
          Loading…
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(192,57,43,0.1)',
          border: '1px solid rgba(192,57,43,0.4)',
          borderRadius: '4px',
          padding: '1.5rem',
          color: '#e88',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.8rem',
        }}>
          Failed to load case: {error.message}
        </div>
      )}

      {c && (
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.7rem',
            color: 'var(--gold)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}>
            Supreme Court · {courtName}
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            fontWeight: 900,
            color: 'var(--cream)',
            margin: '0 0 2.5rem 0',
            lineHeight: 1.15,
          }}>
            {c.caseName}
          </h1>

          {/* Metadata grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem',
            padding: '2rem',
            background: 'rgba(17,32,64,0.5)',
            border: '1px solid rgba(201,168,76,0.15)',
            borderRadius: '6px',
          }}>
            {formattedDate && (
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Date Decided
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.95rem', color: 'var(--cream)' }}>
                  {formattedDate}
                </div>
              </div>
            )}

            {c.citation && (
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Citation
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.9rem', color: 'var(--cream)' }}>
                  {c.citation}
                </div>
              </div>
            )}

            {c.docketNumber && (
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Docket
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.9rem', color: 'var(--cream)' }}>
                  {c.docketNumber}
                </div>
              </div>
            )}

            {voteDisplay && (
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Decision
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1.1rem', fontWeight: 600, color: 'var(--cream)' }}>
                  {voteDisplay}
                  {direction && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      {direction}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Opinions */}
          {groupedOpinions.length > 0 && (
            <div style={{ marginBottom: '3rem' }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                color: 'var(--gold)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '1rem',
              }}>
                Opinions
              </div>
              {groupedOpinions.map(({ type, opinions }) => (
                <div key={type} style={{ marginBottom: '1rem' }}>
                  {opinions.map(op => <OpinionRow key={op.id} opinion={op} />)}
                </div>
              ))}
            </div>
          )}

          {/* Syllabus */}
          {c.syllabus && (
            <div style={{ marginBottom: '3rem' }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                color: 'var(--gold)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '1rem',
              }}>
                Syllabus
              </div>
              <p style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: '0.95rem',
                color: 'var(--text-muted)',
                lineHeight: 1.8,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {c.syllabus}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {c.url && (
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.75rem',
                  color: 'var(--gold)',
                  textDecoration: 'none',
                  border: '1px solid rgba(201,168,76,0.4)',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  transition: 'all 0.15s',
                  letterSpacing: '0.05em',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(201,168,76,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.8)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)';
                }}
              >
                View on CourtListener ↗
              </a>
            )}
            {graphCaseId != null && (
              <Link
                to={`/case-graph?caseId=${graphCaseId}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.75rem',
                  color: 'rgba(136,153,187,0.9)',
                  textDecoration: 'none',
                  border: '1px solid rgba(136,153,187,0.3)',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  transition: 'all 0.15s',
                  letterSpacing: '0.05em',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(136,153,187,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(136,153,187,0.6)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(136,153,187,0.3)';
                }}
              >
                View in Case Graph →
              </Link>
            )}
          </div>

          {scotusCase && <TagPanel entityType="scotus_case" entityId={scotusCase.id} />}
        </div>
      )}
    </main>
  );
}
