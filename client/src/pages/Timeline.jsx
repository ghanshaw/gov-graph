import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_EXECUTIVE_ORDERS, GET_TIMELINE_CASES } from '../queries';
import PageLayout from '../components/PageLayout';
import { RailGroup } from '../components/Rail';
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

// A kind of event that is shown or hidden as a whole.
function ToggleButton({ active, onClick, children, testId }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      data-testid={testId}
      className={active ? 'opt check on' : 'opt check'}
      onClick={onClick}
    >
      <b />{children}
    </button>
  );
}

// One of the kinds of presidential action.
function SubToggle({ active, onClick, children, testId }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-testid={testId}
      className={active ? 'opt sub on' : 'opt sub'}
      onClick={onClick}
    >
      <b />{children}
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

  const showEos = showPresidential && (presidentialSub === 'eo' || presidentialSub === 'both');
  const showMemos = showPresidential && (presidentialSub === 'memorandum' || presidentialSub === 'both');

  const rail = (
    <>
      <div className="group" data-testid="timeline-controls">
        <h3>Show</h3>
        <ToggleButton
          active={showPresidential}
          onClick={() => setShowPresidential(v => !v)}
          testId="timeline-toggle-presidential"
        >
          Presidential actions
        </ToggleButton>
        {showPresidential && (
          <div data-testid="timeline-presidential-subtypes" role="radiogroup" aria-label="Presidential actions">
            <SubToggle active={presidentialSub === 'eo'} onClick={() => setPresidentialSub('eo')} testId="timeline-subtype-eo">
              Executive orders
            </SubToggle>
            <SubToggle active={presidentialSub === 'memorandum'} onClick={() => setPresidentialSub('memorandum')} testId="timeline-subtype-memorandum">
              Memoranda
            </SubToggle>
            <SubToggle active={presidentialSub === 'both'} onClick={() => setPresidentialSub('both')} testId="timeline-subtype-both">
              Both
            </SubToggle>
          </div>
        )}
        <ToggleButton
          active={showScotus}
          onClick={() => setShowScotus(v => !v)}
          testId="timeline-toggle-scotus"
        >
          Supreme Court cases
        </ToggleButton>
      </div>

      <RailGroup title="On the timeline">
        {showEos && (
          <div className="fact"><span><i className="dot eo" />Executive orders</span><b>{eoCount}</b></div>
        )}
        {showMemos && (
          <div className="fact"><span><i className="dot memo" />Memoranda</span><b>{memoCount}</b></div>
        )}
        {showScotus && (
          <div className="fact"><span><i className="dot scotus" />Supreme Court</span><b>{scotusCount}</b></div>
        )}
      </RailGroup>
    </>
  );

  return (
    <>
      {OBAMA_COURTS.map(slug => (
        <CourtQuery key={slug} courtSlug={slug} onData={handleCourtData} />
      ))}

      <PageLayout rail={rail}>
        <div className="page-head">
          <h1 className="page-title">Historical Timeline <small>2009 – 2017 · Obama Administration</small></h1>
        </div>
        <p className="lede">
          Presidential actions and Supreme Court decisions during the Obama years.
        </p>

        {/* Range selector */}
        {allDates.length > 0 && (
          <RangeSelector
            minYear={minYear} maxYear={maxYear}
            rangeStart={activeStart} rangeEnd={activeEnd}
            onChange={handleRangeChange}
          />
        )}

        <div data-testid="timeline-card" className="timeline-card">
          {loading && visibleEvents.length === 0 ? (
            <div className="state">Loading…</div>
          ) : (
            <HorizontalTimeline events={visibleEvents} rangeStart={activeStart} rangeEnd={activeEnd} />
          )}
        </div>

        <p className="note">Scroll sideways to explore · scroll up or down over the timeline to zoom</p>
      </PageLayout>
    </>
  );
}
