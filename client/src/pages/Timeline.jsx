import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_TIMELINE_EVENTS, GET_PRESIDENTIAL_TERMS, GET_PERIODS } from '../queries';
import TimelineChart from '../components/TimelineChart';
import YearRange from '../components/YearRange';
import DatasetSearch from '../components/DatasetSearch';
import LanePanel from '../components/LanePanel';
import Loading from '../components/Loading';
import AboutData from '../components/AboutData';
import useSeriesList from '../hooks/useSeriesList';
import useSeriesData from '../hooks/useSeriesData';
import { asPublished, seriesAbout, assignSlots, bandFor } from '../economy';
import { DOLLAR_UNITS, laneFor, laneScales, laneVerdict, scaleName, scaleOf, shownFrequency } from '../lanes';

// The timeline (design/timeline-data, AC.1): a search across the top over a catalogue of every
// economic series; below it the chart of events, presidencies and periods with lanes of series under
// them; beside it the lanes and the context. Each lane is one chart: series measured alike share it,
// a second unit takes a scale on the right, and the reader drags series between lanes.

// Everything stored is fetched once; the toggles and the range filter it here.
const KINDS = ['eo', 'memo', 'law', 'report', 'scotus', 'fomc'];

// What each layer of the timeline is and where it comes from, for "About the data shown". The
// descriptions are GovGraph's own; sources are the publishers the data was loaded from.
const LAYERS = {
  eo: {
    name: 'Executive orders', swatch: 'eo',
    description: 'Executive orders signed by the President, as published in the Federal Register, dated by signing. Orders from 2001 on are loaded; those of George W. Bush without their text.',
    source: { label: 'Office of the Federal Register (National Archives), Federal Register API', href: 'https://www.federalregister.gov/presidential-documents/executive-orders' },
  },
  memo: {
    name: 'Presidential memoranda', swatch: 'memo',
    description: 'Memoranda the President signed and the Federal Register published, from 2009 on, dated by signing.',
    source: { label: 'Office of the Federal Register (National Archives), Federal Register API', href: 'https://www.federalregister.gov/presidential-documents' },
  },
  law: {
    name: 'Enacted laws', swatch: 'law',
    description: 'Bills and joint resolutions that became law, dated by the first “Became Public Law” action in their history. Loaded for the 117th and 119th Congresses.',
    source: { label: 'Bill status files, GPO govinfo bulk data (from the Library of Congress)', href: 'https://www.govinfo.gov/bulkdata/BILLSTATUS' },
  },
  report: {
    name: 'Reports of investigations', swatch: 'report',
    description: 'Reports of commissions and other investigations, dated by their release. Entered by GovGraph; the 9/11 Commission\'s report is loaded.',
    source: { label: 'GPO govinfo, and each body\'s own edition', href: 'https://www.govinfo.gov/app/collection/gpo' },
  },
  scotus: {
    name: 'Supreme Court decisions', swatch: 'scotus',
    description: 'Decisions of the Supreme Court from October 2020 on (Roberts Courts VII and VIII), read from the Court\'s slip opinions.',
    source: { label: 'Supreme Court of the United States, slip opinions', href: 'https://www.supremecourt.gov/opinions/slipopinion/25', note: 'each found through CourtListener (Free Law Project)' },
  },
  fomc: {
    name: 'Fed rate decisions', swatch: 'fomc',
    description: 'Each change in the Federal Open Market Committee\'s target for the federal funds rate, dated when it took effect, from July 1990, with the size of the move.',
    source: { label: 'Federal Reserve Board, Open Market Operations', href: 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm' },
  },
  terms: {
    name: 'Presidential terms', swatch: 'terms',
    description: 'Each president\'s time in office, consecutive terms joined, coloured by party.',
    source: { label: '@unitedstates project, executive.json', href: 'https://github.com/unitedstates/congress-legislators', note: 'public domain, compiled by volunteers from official sources; not a government publication' },
  },
  recessions: {
    name: 'Recessions', swatch: 'recession',
    description: 'Recessions since 1948, from the month after a business-cycle peak through the trough. Entered by GovGraph from NBER\'s table of peaks and troughs; each recession cites both.',
    source: { label: 'NBER Business Cycle Dating Committee', href: 'https://www.nber.org/research/business-cycle-dating', note: 'a private research organization whose dates are the accepted reference' },
  },
  emergencies: {
    name: 'Emergencies', swatch: 'emergency',
    description: 'The COVID-19 Public Health Emergency and National Emergency, from the dates in their declarations to the dates they ended. Entered by GovGraph from the documents cited for each end.',
    source: { label: 'HHS determination; Proclamation 9994 (Federal Register); Pub. L. 118-3 (Congress)', note: 'hover a date in the period for each document' },
  },
};

// The context, as listed beside the lanes: [key, label, swatch class].
const CONTEXT = [
  ['eo', 'Executive orders', 'dot eo'], ['memo', 'Presidential memoranda', 'dot memo'], ['law', 'Enacted laws', 'dot law'],
  ['report', 'Reports', 'dot report'], ['scotus', 'Supreme Court decisions', 'dot scotus'], ['fomc', 'Fed rate decisions', 'dot fomc'],
  ['terms', 'Presidential terms', 'terms'], ['recessions', 'Recessions (NBER)', 'recession'], ['emergencies', 'Emergencies', 'emergency'],
];

// "Since Clinton" (the default) runs from 1993, when Bill Clinton took office; "Last four years" is
// the current year and the four before it. Dragging or typing a year leaves none chosen.
const RECENT_YEARS = 4;
const CLINTON_YEAR = 1993;
const PRESETS = [
  { label: 'Since Clinton (1993)', value: 'clinton' },
  { label: 'Last four years', value: 'recent' },
  { label: 'Everything loaded', value: 'all' },
];
const PALETTE = 8;
const yearOf = iso => Number(iso.slice(0, 4));

export default function Timeline() {
  // Only presidential terms are on at first; everything else is switched on beside the chart.
  const [shown, setShown] = useState({ eo: false, memo: false, law: false, report: false, scotus: false, fomc: false, terms: true, recessions: false, emergencies: false });
  const [period, setPeriod] = useState('clinton'); // a preset, or null once a year is typed or dragged
  const [customRange, setCustomRange] = useState(null);
  // The lanes, top to bottom: [{ id, items: [{ slug, on, axis }] }]. Each series keeps its colour
  // (a slot of --cat-1…8) while it is on the timeline.
  const [lanes, setLanes] = useState([]);
  const [slots, setSlots] = useState(new Map());
  const laneSeq = useRef(0);
  const newLaneId = useCallback(() => ++laneSeq.current, []);

  const { data, loading, error } = useQuery(GET_TIMELINE_EVENTS, { variables: { kinds: KINDS } });
  const allEvents = useMemo(() => data?.timelineEvents ?? [], [data]);
  const { data: termData } = useQuery(GET_PRESIDENTIAL_TERMS);
  const { data: periodData } = useQuery(GET_PERIODS);
  const { bySlug } = useSeriesList();

  const items = lanes.flatMap(l => l.items);
  const onSlugs = items.filter(i => i.on).map(i => i.slug);
  // A series drawn with a band (the federal funds rate inside the Fed's target range) brings the band's bounds.
  const bandSlugs = onSlugs.flatMap(slug => { const b = bandFor(slug); return b ? [b.lower, b.upper] : []; });
  const resampleOf = useCallback(slug => (bySlug.get(slug)?.frequency === 'daily' && !asPublished(slug) ? 'week' : null), [bySlug]);
  const { data: seriesData, loading: seriesLoading } = useSeriesData([...items.map(i => i.slug), ...bandSlugs], resampleOf);

  const periods = useMemo(
    () => (periodData?.periods ?? []).filter(p => (p.kind === 'recession' ? shown.recessions : shown.emergencies)),
    [periodData, shown.recessions, shown.emergencies],
  );
  const terms = shown.terms ? termData?.presidentialTerms ?? null : null;
  const visibleEvents = useMemo(() => allEvents.filter(e => shown[e.kind]), [allEvents, shown]);

  // The range spans the data that is on, and no further: the events shown, the series on the lanes,
  // and recessions and emergencies when shown. Presidential terms set it only when nothing else is on
  // (they run from 1789). Never past this year.
  const thisYear = new Date().getFullYear();
  const seriesYears = onSlugs.flatMap(slug => { const s = bySlug.get(slug); return s?.firstDate ? [yearOf(s.firstDate), yearOf(s.lastDate)] : []; });
  const dataYears = [
    ...visibleEvents.map(e => yearOf(e.date)),
    ...seriesYears,
    ...periods.flatMap(p => [yearOf(p.start), p.end ? yearOf(p.end) : thisYear]),
  ];
  const termYears = terms ? terms.flatMap(t => [yearOf(t.start), t.end ? yearOf(t.end) : thisYear]) : [];
  const spanYears = dataYears.length ? dataYears : termYears.length ? termYears : [CLINTON_YEAR, thisYear];
  const minYear = Math.min(...spanYears, CLINTON_YEAR);
  const maxYear = Math.min(Math.max(...spanYears), thisYear);
  const within = y => Math.max(minYear, Math.min(maxYear, y));
  const [activeStart, activeEnd] = period === 'all' ? [minYear, maxYear]
    : period === 'clinton' ? [within(CLINTON_YEAR), maxYear]
    : period === 'recent' ? [within(maxYear - RECENT_YEARS), maxYear]
    : [within(customRange.start), within(customRange.end)];

  const handlePreset = value => { setPeriod(value); setCustomRange(null); };
  const handleRange = useCallback(({ start, end }) => { setPeriod(null); setCustomRange({ start, end }); }, []);

  // Adding and removing series. A series joins the lane it fits (laneFor), else a new lane at the
  // bottom; a pair's two series go on one lane. A series with too little in the years shown (CBO's
  // rates end in 2022) moves the range to its own years.
  const colorOf = slug => `var(--cat-${((slots.get(slug) ?? 1) - 1) % PALETTE + 1})`;
  const commit = next => {
    setLanes(next);
    setSlots(assignSlots(slots, next.flatMap(l => l.items.map(i => i.slug))));
  };
  const addSlugs = (slugs, from = lanes) => {
    let next = from;
    let pairLane = null;
    for (const slug of slugs) {
      if (next.some(l => l.items.some(i => i.slug === slug))) continue;
      const lane = pairLane ?? laneFor(next, slug, bySlug);
      if (lane && laneVerdict(lane, slug, bySlug) !== 'no') {
        const verdict = laneVerdict(lane, slug, bySlug);
        const same = lane.items.find(i => scaleOf(bySlug.get(i.slug)) === scaleOf(bySlug.get(slug)));
        const item = { slug, on: true, axis: verdict === 'axis' ? 'right' : same?.axis ?? 'left' };
        next = next.map(l => (l.id === lane.id ? { ...l, items: [...l.items, item] } : l));
        pairLane = next.find(l => l.id === lane.id);
      } else {
        const created = { id: newLaneId(), items: [{ slug, on: true, axis: 'left' }] };
        next = [...next, created];
        pairLane = created;
      }
    }
    commit(next);
    const s = bySlug.get(slugs[0]);
    if (s?.firstDate) {
      const [first, last] = [yearOf(s.firstDate), yearOf(s.lastDate)];
      if (Math.min(last, activeEnd) - Math.max(first, activeStart) < 1) { setPeriod(null); setCustomRange({ start: first, end: Math.max(last, first + 1) }); }
    }
  };
  // Removing a pair removes both of its series in one change.
  const withoutSlugs = slugs => lanes.map(l => ({ ...l, items: l.items.filter(i => !slugs.includes(i.slug)) })).filter(l => l.items.length);
  const removeSlugs = slugs => commit(withoutSlugs(slugs));
  // The catalogue's Build mode swaps the datasets its choices name in one change.
  const swapSlugs = (remove, add) => (add.length ? addSlugs(add, withoutSlugs(remove)) : removeSlugs(remove));
  const isOn = slugs => slugs.every(slug => items.some(i => i.slug === slug));
  const landing = slugs => {
    const lane = laneFor(lanes, slugs[0], bySlug);
    return lane ? { text: `→ lane ${lanes.indexOf(lane) + 1}` } : { text: '→ new lane', isNew: true };
  };
  const toggleRow = row => (isOn(row.slugs) ? removeSlugs(row.slugs) : addSlugs(row.slugs));

  // The lanes as the chart draws them: each series that is on, in dollars where it is in dollars
  // (millions, thousands), with its band.
  const chartLanes = lanes.map((lane, index) => {
    const scales = laneScales(lane, bySlug);
    const sideOf = scale => (lane.items.find(i => scaleOf(bySlug.get(i.slug)) === scale)?.axis === 'right' ? 'right' : 'left');
    const lines = lane.items.filter(i => i.on && seriesData.has(i.slug)).map(item => {
      const s = seriesData.get(item.slug);
      const scale = DOLLAR_UNITS[s.unit];
      const spec = bandFor(item.slug);
      const lower = spec && seriesData.get(spec.lower), upper = spec && seriesData.get(spec.upper);
      return {
        slug: s.slug, name: s.name, color: colorOf(s.slug), axis: item.axis,
        unit: scale ? '$' : s.unit, frequency: shownFrequency(s),
        observations: scale && scale !== 1 ? s.observations.map(o => ({ ...o, value: o.value * scale })) : s.observations,
        band: lower && upper ? { name: spec.label, lower: lower.observations, upper: upper.observations } : null,
      };
    });
    return {
      key: lane.id,
      title: `Lane ${index + 1} · ${scales.length > 1 ? scales.map(sc => `${scaleName(sc)} (${sideOf(sc)})`).join(', ') : scaleName(scales[0])}`,
      lines,
      loading: lane.items.some(i => i.on && seriesLoading.has(i.slug)),
    };
  });

  // Counts within the selected years, for the context list and About the data.
  const counts = {};
  for (const e of allEvents) {
    const year = yearOf(e.date);
    if (year >= activeStart && year <= activeEnd) counts[e.kind] = (counts[e.kind] || 0) + 1;
  }
  const inView = (start, end) => start <= `${activeEnd}-12-31` && (!end || end >= `${activeStart}-01-01`);
  const presidentsInView = new Set((termData?.presidentialTerms ?? []).filter(t => inView(t.start, t.end)).map(t => t.personId)).size;
  const periodsInView = kind => (periodData?.periods ?? []).filter(p => (kind === 'recession') === (p.kind === 'recession') && inView(p.start, p.end)).length;
  const countOf = key => (key === 'terms' ? presidentsInView : key === 'recessions' ? periodsInView('recession') : key === 'emergencies' ? periodsInView('emergency') : counts[key] ?? 0);
  const context = CONTEXT.map(([key, label, swatch]) => ({ key, label, swatch, on: shown[key], count: countOf(key).toLocaleString() }));

  // "About the data shown": one block per layer that is on, in the order drawn.
  const layer = (key, meta) => ({ key, ...LAYERS[key], meta });
  const aboutItems = [
    ...KINDS.filter(kind => shown[kind]).map(kind => layer(kind, `${countOf(kind).toLocaleString()} in ${activeStart}–${activeEnd}`)),
    ...(terms ? [layer('terms', `${presidentsInView} presidents in view`)] : []),
    ...(shown.recessions ? [layer('recessions', `${periodsInView('recession')} in view`)] : []),
    ...(shown.emergencies ? [layer('emergencies', `${periodsInView('emergency')} in view`)] : []),
    ...items.filter(i => i.on && seriesData.has(i.slug)).flatMap(i => {
      const s = seriesData.get(i.slug);
      const spec = bandFor(i.slug);
      const lower = spec && seriesData.get(spec.lower);
      return [
        { ...seriesAbout(s, `${s.frequency}${shownFrequency(s) !== s.frequency ? ', shown as weekly averages' : ''}, ${s.firstDate.slice(0, 4)}–${s.lastDate.slice(0, 4)}`), swatchColor: colorOf(s.slug) },
        ...(lower ? [{ ...seriesAbout({ ...lower, name: spec.label }, `drawn as a band with the ${s.name}`), key: `band-${s.slug}` }] : []),
      ];
    }),
  ];

  return (
    <div className="timeline-page">
      <div className="page-head">
        <h1 className="page-title">Historical Timeline <small>{activeStart} – {activeEnd}</small></h1>
      </div>
      <p className="lede">
        What the President, Congress, the Supreme Court and the Fed did, against presidential terms, recessions and emergencies, and the economic data you choose. What each layer is and where it comes from is set out below the chart.
      </p>

      <DatasetSearch bySlug={bySlug} isOn={isOn} landing={landing} onToggle={toggleRow} onSwap={swapSlugs} />

      <div className="timeline-body">
        <div className="timeline-main">
          <div data-testid="timeline-card" className="timeline-card">
            {allEvents.length > 0 && (
              <YearRange minYear={minYear} maxYear={maxYear} start={activeStart} end={activeEnd}
                presets={PRESETS} preset={period} onPreset={handlePreset} onChange={handleRange} />
            )}
            {error ? (
              <div className="error">Failed to load the timeline: {error.message}</div>
            ) : loading ? (
              <Loading />
            ) : (
              <TimelineChart events={visibleEvents} rangeStart={activeStart} rangeEnd={activeEnd} terms={terms} periods={periods}
                lanes={chartLanes} loading={seriesLoading} />
            )}
          </div>
          <p className="note">Scroll up or down over the timeline to zoom in, then sideways to explore. Quarterly and yearly values are drawn as a level across the period they stand for.</p>
          <AboutData items={aboutItems} />
        </div>

        <LanePanel lanes={lanes} bySlug={bySlug} colorOf={colorOf} startYear={activeStart} endYear={activeEnd}
          onLanes={commit} onRemove={slug => removeSlugs([slug])} context={context} newLaneId={newLaneId}
          onContext={key => setShown(prev => ({ ...prev, [key]: !prev[key] }))} />
      </div>
    </div>
  );
}
