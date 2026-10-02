import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDERS, GET_TIMELINE_CASES } from '../queries';
import HorizontalTimeline, { RangeSelector } from '../components/HorizontalTimeline';

const OBAMA_COURTS = ['roberts-2', 'roberts-3', 'roberts-4', 'roberts-4b'];

function CourtQuery({ courtSlug, onData }) {
  const { data } = useQuery(GET_TIMELINE_CASES, {
    variables: { courtSlug },
  });
  const cases = data?.allScotusCases;
  useEffect(() => {
    if (cases) onData(courtSlug, cases);
  }, [cases, courtSlug]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ToggleButton({ active, onClick, children, color, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.65rem',
        letterSpacing: '0.08em',
        padding: '6px 14px',
        borderRadius: '3px',
        border: active
          ? `1px solid ${color || 'var(--gold)'}`
          : '1px solid rgba(201,168,76,0.2)',
        background: active ? `${color || 'var(--gold)'}1a` : 'transparent',
        color: active ? (color || 'var(--gold)') : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </button>
  );
}

function SubToggle({ active, onClick, children, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.6rem',
        letterSpacing: '0.06em',
        padding: '4px 10px',
        borderRadius: '2px',
        border: active ? 'none' : '1px solid rgba(201,168,76,0.15)',
        background: active ? 'rgba(201,168,76,0.18)' : 'transparent',
        color: active ? 'var(--gold)' : 'rgba(136,153,187,0.6)',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </button>
  );
}

export default function Timeline() {
  const [showPresidential, setShowPresidential] = useState(true);
  const [presidentialSub, setPresidentialSub] = useState('both'); // 'eo' | 'memorandum' | 'both'
  const [showScotus, setShowScotus] = useState(true);
  const [courtData, setCourtData] = useState({});
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd]     = useState(null);

  const { data: eoData, loading: eoLoading } = useQuery(GET_EXECUTIVE_ORDERS, {
    variables: { president: 'barack-obama', documentType: 'executive_order', page: 1, perPage: 500 },
    skip: !showPresidential || presidentialSub === 'memorandum',
  });

  const { data: memoData, loading: memoLoading } = useQuery(GET_EXECUTIVE_ORDERS, {
    variables: { president: 'barack-obama', documentType: 'memorandum', page: 1, perPage: 500 },
    skip: !showPresidential || presidentialSub === 'eo',
  });

  const handleCourtData = (slug, cases) => {
    setCourtData(prev => {
      if (prev[slug]) return prev;
      return { ...prev, [slug]: cases };
    });
  };

  const eoEvents = useMemo(() => {
    if (!eoData?.executiveOrders?.orders) return [];
    return eoData.executiveOrders.orders
      .filter(o => o.dateSigned)
      .map((o, i) => ({
        id: `eo-${i}`,
        type: 'eo',
        date: o.dateSigned,
        title: o.title,
        number: o.number,
        url: o.url,
      }));
  }, [eoData]);

  const memoEvents = useMemo(() => {
    if (!memoData?.executiveOrders?.orders) return [];
    return memoData.executiveOrders.orders
      .filter(o => o.dateSigned)
      .map((o, i) => ({
        id: `memo-${i}`,
        type: 'memo',
        date: o.dateSigned,
        title: o.title,
        number: o.number,
        url: o.url,
      }));
  }, [memoData]);

  const scotusEvents = useMemo(() => {
    return Object.values(courtData).flat()
      .filter(c => c.dateFiled)
      .map(c => ({
        id: `scotus-${c.id}`,
        type: 'scotus',
        date: c.dateFiled,
        title: c.caseName,
        url: c.url,
      }));
  }, [courtData]);

  const visibleEvents = useMemo(() => {
    const all = [];
    if (showPresidential) {
      if (presidentialSub === 'eo' || presidentialSub === 'both') all.push(...eoEvents);
      if (presidentialSub === 'memorandum' || presidentialSub === 'both') all.push(...memoEvents);
    }
    if (showScotus) all.push(...scotusEvents);
    return all.sort((a, b) => a.date.localeCompare(b.date));
  }, [showPresidential, presidentialSub, showScotus, eoEvents, memoEvents, scotusEvents]);

  const scotusLoading = OBAMA_COURTS.some(slug => !courtData[slug]);
  const loading = eoLoading || memoLoading || scotusLoading;

  const eoCount = eoEvents.length;
  const memoCount = memoEvents.length;
  const scotusCount = scotusEvents.length;

  // Derive full year span from all events (not just visible ones)
  const allEvents = useMemo(() => [...eoEvents, ...memoEvents, ...scotusEvents], [eoEvents, memoEvents, scotusEvents]);
  const allDates = allEvents.map(e => new Date(e.date + 'T00:00:00').getFullYear()).filter(Boolean);
  const minYear = allDates.length ? Math.min(...allDates) : 2009;
  const maxYear = allDates.length ? Math.max(...allDates) : 2017;

  // Initialise range once data arrives
  useEffect(() => {
    if (allDates.length && rangeStart === null) {
      setRangeStart(minYear);
      setRangeEnd(maxYear);
    }
  }, [allDates.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRangeChange = useCallback(({ start, end }) => {
    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  const activeStart = rangeStart ?? minYear;
  const activeEnd   = rangeEnd   ?? maxYear;

  return (
    <>
      {OBAMA_COURTS.map(slug => (
        <CourtQuery key={slug} courtSlug={slug} onData={handleCourtData} />
      ))}

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '5rem 2rem 4rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.7rem',
            color: 'var(--gold)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}>
            2009 – 2017 · Obama Administration
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900,
            color: 'var(--cream)',
            margin: '0 0 1rem 0',
            lineHeight: 1.1,
          }}>
            Historical Timeline
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: '1rem',
            color: 'var(--text-muted)',
            margin: 0,
            maxWidth: '520px',
            lineHeight: 1.7,
            fontWeight: 300,
          }}>
            Presidential actions and Supreme Court decisions during the Obama years.
          </p>
        </div>

        {/* Controls */}
        <div data-testid="timeline-controls" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

            {/* Presidential Actions toggle + sub-options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <ToggleButton
                active={showPresidential}
                onClick={() => setShowPresidential(v => !v)}
                testId="timeline-toggle-presidential"
              >
                Presidential Actions
              </ToggleButton>
              {showPresidential && (
                <div data-testid="timeline-presidential-subtypes" style={{ display: 'flex', gap: '0.25rem', paddingLeft: '2px' }}>
                  <SubToggle active={presidentialSub === 'eo'} onClick={() => setPresidentialSub('eo')} testId="timeline-subtype-eo">
                    Exec. Orders
                  </SubToggle>
                  <SubToggle active={presidentialSub === 'memorandum'} onClick={() => setPresidentialSub('memorandum')} testId="timeline-subtype-memorandum">
                    Memoranda
                  </SubToggle>
                  <SubToggle active={presidentialSub === 'both'} onClick={() => setPresidentialSub('both')} testId="timeline-subtype-both">
                    Both
                  </SubToggle>
                </div>
              )}
            </div>

            {/* SCOTUS toggle */}
            <div>
              <ToggleButton
                active={showScotus}
                onClick={() => setShowScotus(v => !v)}
                color="rgba(245,240,232,0.8)"
                testId="timeline-toggle-scotus"
              >
                SCOTUS Cases
              </ToggleButton>
            </div>
          </div>

          {/* Legend counts */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {showPresidential && (presidentialSub === 'eo' || presidentialSub === 'both') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  {eoCount} EOs
                </span>
              </div>
            )}
            {showPresidential && (presidentialSub === 'memorandum' || presidentialSub === 'both') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(201,168,76,0.45)', display: 'inline-block' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  {memoCount} Memoranda
                </span>
              </div>
            )}
            {showScotus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(245,240,232,0.55)', display: 'inline-block' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  {scotusCount} SCOTUS
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Range selector */}
        {allDates.length > 0 && (
          <RangeSelector
            minYear={minYear} maxYear={maxYear}
            rangeStart={activeStart} rangeEnd={activeEnd}
            onChange={handleRangeChange}
          />
        )}

        {/* Timeline card */}
        <div data-testid="timeline-card" style={{
          background: 'rgba(17,32,64,0.4)',
          border: '1px solid rgba(201,168,76,0.15)',
          borderRadius: '6px',
          padding: '2rem 1.5rem',
          marginTop: '1.25rem',
        }}>
          {loading && visibleEvents.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', textAlign: 'center', padding: '3rem 0' }}>
              Loading…
            </div>
          ) : (
            <HorizontalTimeline events={visibleEvents} rangeStart={activeStart} rangeEnd={activeEnd} />
          )}
        </div>

        <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            SCROLL TO EXPLORE →
          </span>
        </div>
      </main>
    </>
  );
}
