import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_BILL } from '../queries';
import TagPanel from '../components/TagPanel';

const TYPE_CODE = {
  HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.',
  HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.', HRES: 'H.Res.', SRES: 'S.Res.',
};

const TYPE_FULL = {
  HR: 'House Bill',
  S: 'Senate Bill',
  HJRES: 'House Joint Resolution',
  SJRES: 'Senate Joint Resolution',
  HCONRES: 'House Concurrent Resolution',
  SCONRES: 'Senate Concurrent Resolution',
  HRES: 'House Resolution',
  SRES: 'Senate Resolution',
};

const PARTY_COLOR = { D: '#93c5fd', R: '#fca5a5', I: '#86efac' };

// Map congress.gov text version type strings to canonical stages
const VERSION_STAGE = {
  'Introduced in Senate': 'introduced',
  'Introduced in House': 'introduced',
  'Reported in Senate': 'committee',
  'Reported in House': 'committee',
  'Placed on Calendar Senate': 'floor',
  'Placed on Calendar House': 'floor',
  'Engrossed in Senate': 'passed-origin',
  'Engrossed in House': 'passed-origin',
  'Engrossed Amendment Senate': 'other-chamber',
  'Engrossed Amendment House': 'other-chamber',
  'Referred in Senate': 'other-chamber',
  'Referred in House': 'other-chamber',
  'Reported in Senate without Amendment': 'other-chamber',
  'Considered and Passed Senate': 'passed-origin',
  'Considered and Passed House': 'passed-origin',
  'Enrolled Bill': 'enacted',
};

// Map congress.gov action type strings to canonical stages
const ACTION_TYPE_STAGE = {
  'IntroReferral': 'introduced',
  'Committee': 'committee',
  'Floor': 'floor',
  'Calendars': 'floor',
  'BecameLaw': 'enacted',
  'President': 'enacted',
};

const STAGES = [
  { key: 'introduced',    label: 'Introduced' },
  { key: 'committee',     label: 'Committee' },
  { key: 'floor',         label: 'Floor' },
  { key: 'passed-origin', label: 'Passed Chamber' },
  { key: 'other-chamber', label: 'Other Chamber' },
  { key: 'enacted',       label: 'Enacted' },
];

function deriveStageInfo(bill) {
  // Returns a map of stageKey -> { reached: bool, date: string|null, documents: [] }
  const info = {};
  for (const s of STAGES) {
    info[s.key] = { reached: false, date: null, documents: [] };
  }

  // Seed from introducedDate
  if (bill.introducedDate) {
    info['introduced'].reached = true;
    info['introduced'].date = bill.introducedDate;
  }

  // Overlay from text versions (most authoritative for dates + documents)
  for (const v of (bill.textVersions || [])) {
    const stage = VERSION_STAGE[v.type];
    if (!stage || !info[stage]) continue;
    info[stage].reached = true;
    if (!info[stage].date || v.date < info[stage].date) {
      info[stage].date = v.date;
    }
    info[stage].documents.push(v);
  }

  // Fill gaps from actions
  for (const a of (bill.actions || [])) {
    const stage = ACTION_TYPE_STAGE[a.type];
    if (!stage || !info[stage]) continue;
    if (!info[stage].reached) {
      info[stage].reached = true;
      info[stage].date = a.actionDate;
    }
  }

  return info;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MetaField({ label, children }) {
  return (
    <div>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.65rem',
        color: 'var(--gold)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: '0.4rem',
      }}>
        {label}
      </div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.95rem', color: 'var(--cream)' }}>
        {children}
      </div>
    </div>
  );
}

function BillStepper({ bill }) {
  const stageInfo = deriveStageInfo(bill);
  const reachedKeys = STAGES.filter(s => stageInfo[s.key].reached).map(s => s.key);
  const lastReachedIdx = STAGES.reduce((acc, s, i) => stageInfo[s.key].reached ? i : acc, -1);

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.65rem',
        color: 'var(--gold)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: '1.25rem',
      }}>
        Legislative Progress
      </div>

      {/* Stepper row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {STAGES.map((stage, i) => {
          const info = stageInfo[stage.key];
          const isReached = info.reached;
          const isCurrent = i === lastReachedIdx;
          const isPast = i < lastReachedIdx;

          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 80 }}>
              {/* Step */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                {/* Circle */}
                <div style={{
                  width: 28, height: 28,
                  borderRadius: '50%',
                  background: isReached ? 'var(--gold)' : 'transparent',
                  border: `2px solid ${isReached ? 'var(--gold)' : 'rgba(201,168,76,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: isCurrent ? '0 0 0 4px rgba(201,168,76,0.15)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {isReached && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#0a1628" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Label + date */}
                <div style={{ textAlign: 'center', marginTop: '0.5rem', padding: '0 4px' }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.6rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: isReached ? 'var(--gold)' : 'rgba(201,168,76,0.3)',
                    marginBottom: '0.2rem',
                    whiteSpace: 'nowrap',
                  }}>
                    {stage.label}
                  </div>
                  {info.date && formatDate(info.date) && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '0.55rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatDate(info.date)}
                    </div>
                  )}
                  {/* Document links */}
                  {info.documents.length > 0 && (
                    <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                      {info.documents.map((v, di) => {
                        const pdf = v.formats?.find(f => f.type === 'PDF');
                        const html = v.formats?.find(f => f.type === 'Formatted Text' || f.type === 'HTML');
                        const link = pdf || html;
                        return link ? (
                          <a key={di} href={link.url} target="_blank" rel="noopener noreferrer" style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: '0.55rem',
                            color: 'var(--gold)',
                            textDecoration: 'none',
                            border: '1px solid rgba(201,168,76,0.3)',
                            borderRadius: '3px',
                            padding: '2px 6px',
                            whiteSpace: 'nowrap',
                          }}>
                            {pdf ? 'PDF' : 'Text'} ↗
                          </a>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Connector line (not after last) */}
              {i < STAGES.length - 1 && (
                <div style={{
                  height: 2,
                  flex: 1,
                  marginTop: 13,
                  background: isPast || isCurrent
                    ? 'rgba(201,168,76,0.5)'
                    : 'rgba(201,168,76,0.1)',
                  minWidth: 16,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ACTION_CODE_NAME = {
  // Introduction
  '14000': 'Introduced',
  '10000': 'Introduced',
  // Committee referral
  'H11100': 'Referred to Committee',
  'H11200': 'Referred to Subcommittee',
  'S06300': 'Referred to Committee',
  'S06500': 'Referred to Subcommittee',
  // Committee action
  'H12100': 'Committee Consideration',
  'H12200': 'Ordered Reported',
  'H12300': 'Committee Discharged',
  'H12410': 'Reported by Committee',
  'H12420': 'Reported with Amendment',
  'S12100': 'Committee Consideration',
  'S12200': 'Ordered Reported',
  'S12300': 'Committee Discharged',
  'S12410': 'Reported by Committee',
  'S12420': 'Reported with Amendment',
  // Calendar
  'H15000': 'Placed on House Calendar',
  'S15000': 'Placed on Senate Calendar',
  // Floor
  'H17000': 'Floor Consideration',
  'H30000': 'Passed House',
  'H36000': 'Passed House',
  'H37300': 'Failed in House',
  'H8D000': 'Tabled in House',
  'S17000': 'Floor Consideration',
  'S30000': 'Passed Senate',
  'S36000': 'Passed Senate',
  'S37300': 'Failed in Senate',
  // Cross-chamber
  'H14000': 'Received in Senate',
  'S14000': 'Received in House',
  // Conference
  'H42000': 'Conference Report Filed',
  'S42000': 'Conference Report Filed',
  // Presidential
  '28000': 'Presented to President',
  '36000': 'Presented to President',
  'E20000': 'Enrolled Bill Signed',
  'E30000': 'Signed by President',
  'E40000': 'Vetoed by President',
  // Enacted
  'B00100': 'Became Public Law',
  'BF0A00': 'Became Public Law',
};

function ActionRow({ action }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tick */}
      <div style={{
        position: 'absolute',
        left: '-1.45rem',
        top: '0.35rem',
        width: 6, height: 6,
        borderRadius: '50%',
        background: hovered ? 'var(--gold)' : 'rgba(201,168,76,0.4)',
        transition: 'background 0.15s',
      }} />

      <div style={{ marginBottom: '0.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            {formatDate(action.actionDate)}
          </div>
          {action.actionCode && hovered && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.55rem',
              color: 'rgba(201,168,76,0.4)',
              letterSpacing: '0.06em',
            }}>
              {action.actionCode}
            </span>
          )}
        </div>
        {ACTION_CODE_NAME[action.actionCode] && (
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.55rem',
            color: 'rgba(201,168,76,0.5)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '0.1rem',
          }}>
            {ACTION_CODE_NAME[action.actionCode]}
          </div>
        )}
      </div>
      <div style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: '0.875rem',
        color: 'var(--cream)',
        lineHeight: 1.5,
        fontWeight: 300,
      }}>
        {action.text}
      </div>
    </div>
  );
}

function ActionsLog({ actions }) {
  const [expanded, setExpanded] = useState(false);
  if (!actions || actions.length === 0) return null;

  const shown = expanded ? actions : actions.slice(0, 5);

  return (
    <div style={{ marginBottom: '3rem' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, marginBottom: '1rem',
        }}
      >
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.65rem',
          color: 'var(--gold)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Action History ({actions.length})
        </span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.6rem',
          color: 'var(--text-muted)',
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
          display: 'inline-block',
        }}>▾</span>
      </button>

      <div style={{
        borderLeft: '1px solid rgba(201,168,76,0.15)',
        paddingLeft: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}>
        {shown.map((action, i) => (
          <ActionRow key={i} action={action} />
        ))}
      </div>

      {actions.length > 5 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: '0.75rem',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
          }}
        >
          {expanded ? '− Show less' : `+ Show ${actions.length - 5} more`}
        </button>
      )}
    </div>
  );
}

export default function BillDetail() {
  const { number, billType, billNumber } = useParams();
  const congressNum = parseInt(number);

  const { data, loading, error } = useQuery(GET_BILL, {
    variables: {
      congress: congressNum,
      billType: billType.toUpperCase(),
      billNumber,
    },
  });

  const bill = data?.bill;
  const t = (bill?.type || billType).toUpperCase();
  const typeCode = TYPE_CODE[t] || t;
  const typeFull = TYPE_FULL[t] || t;

  const introducedDate = bill?.introducedDate
    ? new Date(bill.introducedDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  return (
    <main style={{ maxWidth: '820px', margin: '0 auto', padding: '3rem 2rem' }}>
      <Link to={`/congress/${number}`} style={{
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
        ← {number}th Congress
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
          Failed to load bill: {error.message}
        </div>
      )}

      {bill && (
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.7rem',
            color: 'var(--gold)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.75rem',
          }}>
            <span>{number}th Congress · {typeFull} {bill.number}</span>
            <span style={{ color: 'rgba(201,168,76,0.4)', fontSize: '0.6rem' }}>{typeCode} {bill.number}</span>
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            fontWeight: 900,
            color: 'var(--cream)',
            margin: '0 0 2.5rem 0',
            lineHeight: 1.2,
          }}>
            {bill.title || 'Untitled Bill'}
          </h1>

          {/* Meta grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem',
            padding: '2rem',
            background: 'rgba(17,32,64,0.5)',
            border: '1px solid rgba(201,168,76,0.15)',
            borderRadius: '6px',
          }}>
            {introducedDate && (
              <MetaField label="Introduced">{introducedDate}</MetaField>
            )}
            {bill.sponsor && (
              <MetaField label="Sponsor">
                <span>{bill.sponsor.fullName}</span>
                {bill.sponsor.party && (
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.75rem',
                    color: PARTY_COLOR[bill.sponsor.party] || 'var(--text-muted)',
                    marginLeft: '0.4rem',
                  }}>
                    ({bill.sponsor.party}-{bill.sponsor.state})
                  </span>
                )}
              </MetaField>
            )}
            {bill.policyArea && (
              <MetaField label="Policy Area">{bill.policyArea}</MetaField>
            )}
            <MetaField label="Congress">{bill.congress}th Congress</MetaField>
          </div>

          {/* Stage stepper */}
          <BillStepper bill={bill} />

          {/* Actions log */}
          <ActionsLog actions={bill.actions} />

          {/* External link */}
          {bill.url && (
            <a
              href={bill.url}
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
              View on Congress.gov ↗
            </a>
          )}

          {bill && <TagPanel entityType="legislation" entityId={bill.id} />}
        </div>
      )}
    </main>
  );
}
