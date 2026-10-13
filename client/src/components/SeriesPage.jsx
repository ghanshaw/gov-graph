import { useState } from 'react';
import { useParams, useSearchParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_ECONOMIC_SERIES, GET_ECONOMIC_SERIES_RANGE, GET_ECONOMIC_BAND, GET_SERIES_PLACES } from '../queries';
import PageLayout from './PageLayout';
import { RailGroup, RadioOptions } from './Rail';
import SeriesPicker from './SeriesPicker';
import PriceChart, { LinesChart, CHART_INSET } from './PriceChart';
import RangeSlider from './RangeSlider';
import Loading from './Loading';
import useSeriesList from '../hooks/useSeriesList';
import { formatValue, formatChange, periodLabel, SOURCES, sourceLink, isPrice, bandFor, asPublished, chartGroups, assignSlots } from '../economy';

// A custom range longer than this is shown as weekly averages, like the long presets.
const DAILY_YEARS = 5;

function yearsBefore(iso, years) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

// The slider counts months: "2014-03-…" ↔ 2014 * 12 + 2.
const toMonth = iso => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
const monthKey = m => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
const monthLabel = m => new Date(Date.UTC(Math.floor(m / 12), m % 12, 1))
  .toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const yearLabel = m => String(Math.floor(m / 12));
const MONTH = /^\d{4}-\d{2}$/;
// The last day of a month, "2019-02" → "2019-02-28".
const monthEnd = key => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).toISOString().slice(0, 10);

// The change shown beside the latest value is over a year, or, for figures published less often
// than yearly (a census every ten years), since the one before.
function changeSince(facts, frequency) {
  if (!facts?.before) return 'Over a year';
  const days = (Date.parse(facts.latest.date) - Date.parse(facts.before.date)) / 864e5;
  return days > 400 ? `Since ${periodLabel(facts.before.date, frequency)}` : 'Over a year';
}

// Facts about the period shown: latest value, its change over a year, the high and low.
function summarize(obs) {
  if (!obs.length) return null;
  const latest = obs.at(-1);
  const yearAgo = yearsBefore(latest.date, 1);
  const before = obs.findLast(o => o.date <= yearAgo);
  let high = obs[0], low = obs[0];
  for (const o of obs) {
    if (o.value > high.value) high = o;
    if (o.value < low.value) low = o;
  }
  return { latest, before, high, low };
}

/**
 * A page of series by tab, as Economic Data and Demographic Data show them: `tabs` (slug, label, lede,
 * series, note), `base` the path the tabs sit under, `periods` the presets (`years` back from the
 * latest value, or `since` a year; `resample` for long ones), `defaultPeriod` the preset's value
 * shown first, `navTabs` the tabs listed (other pages may sit among them). With `places`, each series
 * is a measure published per place (demographic series): a place picker in the rail (?place=ca)
 * switches every chosen series to that place's.
 */
export default function SeriesPage({ title, tabs, navTabs = tabs, base, periods, defaultPeriod, places = false }) {
  const { tab: tabSlug } = useParams();
  const [params, setParams] = useSearchParams();
  // Each series is shown by its stored name; a pair by its tab entry's.
  const { nameOf, bySlug } = useSeriesList();
  // A tab lists only the series stored: a measure whose files have not been read yet (ACS years
  // still downloading) has no name to show, so it is counted in the picker instead of listed.
  const tabListed = tabs.find(t => t.slug === tabSlug);
  const stored = item => !bySlug.size || item.label || item.compare || bySlug.has(item.value);
  const tab = tabListed && { ...tabListed, series: tabListed.series.filter(stored) };
  const waiting = tabListed ? tabListed.series.length - tab.series.length : 0;

  // The series chosen, in the order they were added (?series=a,b,c); the tab's first by default.
  const requested = (params.get('series') ?? '').split(',').filter(Boolean);
  const picked = tab ? requested.map(v => tab.series.find(s => s.value === v)).filter(Boolean) : [];
  const chosen = picked.length ? picked : tab?.series.length ? [tab.series[0]] : [];
  // One choice is drawn as before (with its band, or as a pair); several as lines, chart by chart.
  const multi = chosen.length > 1;
  const choice = chosen[0];
  // A pair (inflows against outflows) is drawn as its first series with the second against it.
  const pair = !multi ? choice?.compare ?? null : null;
  // A place's series of a measure is "<measure>--<place>" (lib/population/series.js).
  const place = places ? params.get('place') : null;
  const atPlace = slug => (place && slug ? `${slug}--${place}` : slug);
  const seriesSlug = multi ? null : pair ? pair.inflow : atPlace(choice?.value);
  // Every place the first chosen measure is published for (the place picker).
  const { data: placesData } = useQuery(GET_SERIES_PLACES, { variables: { measure: chosen[0]?.value }, skip: !places || !chosen[0] });
  // Each line drawn when several are chosen: a pair gives two.
  const lineSpecs = multi ? chosen.flatMap(item => {
    if (!item.compare) return [{ key: item.value, slug: atPlace(item.value), label: nameOf(item.value), item }];
    return [
      { key: `${item.value}|in`, slug: item.compare.inflow, label: nameOf(item.compare.inflow), item },
      { key: `${item.value}|out`, slug: item.compare.outflow, label: nameOf(item.compare.outflow), item },
    ];
  }) : [];
  const [slots, setSlots] = useState(new Map());
  const colorSlots = assignSlots(slots, lineSpecs.map(l => l.key));
  // The range shown is either a preset (?period=10y) or months picked on the slider
  // (?from=2012-03&to=2019-08), in which case no preset is ticked.
  const custom = MONTH.test(params.get('from') ?? '') && MONTH.test(params.get('to') ?? '') && params.get('from') < params.get('to')
    ? { from: params.get('from'), to: params.get('to') }
    : null;
  const period = custom ? null : periods.find(p => p.value === params.get('period')) ?? periods.find(p => p.value === defaultPeriod);
  const customYears = custom ? (toMonth(`${custom.to}-01`) - toMonth(`${custom.from}-01`)) / 12 : 0;
  // Daily tax deposits are never averaged: a week's average of daily flows is not a published figure.
  const resample = asPublished(seriesSlug) ? null : custom ? (customYears > DAILY_YEARS ? 'week' : null) : period.resample ?? null;

  // The year-ago change needs a year before the period starts.
  const from = custom
    ? yearsBefore(`${custom.from}-01`, 1)
    : period.years ? yearsBefore(new Date().toISOString().slice(0, 10), period.years + 1)
      : period.since ? `${period.since - 1}-01-01` : null;
  const to = custom ? monthEnd(custom.to) : null;
  const { data: current, previousData, loading, error } = useQuery(GET_ECONOMIC_SERIES, {
    variables: { slug: seriesSlug, from, to, resample },
    skip: !tab || multi,
  });

  // Several series: daily deposits as published, the rest averaged by week over long periods.
  const lineResample = custom ? (customYears > DAILY_YEARS ? 'week' : null) : period.resample ?? null;
  const averagedSlugs = [...new Set(lineSpecs.filter(l => !asPublished(l.slug)).map(l => l.slug))];
  const publishedSlugs = [...new Set(lineSpecs.filter(l => asPublished(l.slug)).map(l => l.slug))];
  const setA = useQuery(GET_ECONOMIC_SERIES_RANGE, { variables: { slugs: averagedSlugs, from, to, resample: lineResample }, skip: !averagedSlugs.length });
  const setB = useQuery(GET_ECONOMIC_SERIES_RANGE, { variables: { slugs: publishedSlugs, from, to, resample: null }, skip: !publishedSlugs.length });
  const loadedSeries = new Map([
    ...(averagedSlugs.length ? (setA.data ?? setA.previousData)?.economicSeriesSet ?? [] : []),
    ...(publishedSlugs.length ? (setB.data ?? setB.previousData)?.economicSeriesSet ?? [] : []),
  ].map(s => [s.slug, s]));
  const linesLoading = (averagedSlugs.length && setA.loading) || (publishedSlugs.length && setB.loading);
  const linesError = setA.error ?? setB.error;

  const { data: outflowData, previousData: previousOutflow } = useQuery(GET_ECONOMIC_SERIES, {
    variables: { slug: pair?.outflow, from, to, resample },
    skip: !pair,
  });
  const outflow = pair ? (outflowData ?? previousOutflow)?.economicSeries ?? null : null;

  const bandSpec = bandFor(seriesSlug);
  const { data: bandData } = useQuery(GET_ECONOMIC_BAND, {
    variables: { lower: bandSpec?.lower, upper: bandSpec?.upper },
    skip: !bandSpec,
  });
  const band = bandSpec && bandData?.lower && bandData?.upper
    ? { label: bandSpec.label, lower: bandData.lower.observations, upper: bandData.upper.observations }
    : null;

  // While another series or period loads, the chart keeps showing the last one.
  const data = current ?? previousData;

  if (!tab) return <Navigate to={`${base}/${tabs[0].slug}`} replace />;

  // Each change replaces the keys given; null removes one.
  const set = changes => setParams(prev => {
    const next = new URLSearchParams(prev);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    return next;
  }, { replace: true });

  // Adding or removing a series from the chart; at least one stays chosen.
  const toggle = (value) => {
    const values = chosen.map(c => c.value);
    const next = values.includes(value) ? values.filter(v => v !== value) : [...values, value];
    if (!next.length) return;
    const nextLines = next.flatMap(v => (tab.series.find(s => s.value === v)?.compare ? [`${v}|in`, `${v}|out`] : [v]));
    setSlots(assignSlots(colorSlots, nextLines));
    set({ series: next.join(',') });
  };
  const picker = (
    <SeriesPicker tab={tab} chosen={chosen} nameOf={nameOf} waiting={waiting} onToggle={toggle} onOnly={v => set({ series: v })}
      colors={new Map(lineSpecs.map(l => [l.item.value, `var(--cat-${colorSlots.get(l.key)})`]))} />
  );

  const placeList = placesData?.seriesPlaces ?? [];
  const placeLabel = place ? placeList.find(p => p.place === place)?.label ?? null : null;
  const placePicker = places
    ? <PlacePicker list={placeList} value={place} onChange={v => set({ place: v })} />
    : null;

  if (multi) {
    const lines = lineSpecs.map(l => ({ ...l, series: loadedSeries.get(l.slug) })).filter(l => l.series);
    return (
      <SeriesLines title={title} tabs={navTabs} base={base} periods={periods} placePicker={placePicker} placeLabel={placeLabel} tab={tab} picker={picker} lines={lines} colorSlots={colorSlots}
        loading={linesLoading && !lines.length} error={linesError}
        custom={custom} period={period} resample={lineResample} set={set} />
    );
  }

  const series = data?.economicSeries;
  const all = series?.observations ?? [];

  // The slider spans the series' own dates; a preset counts back from its latest value.
  const firstMonth = series ? toMonth(series.firstDate) : null;
  const lastMonth = series ? toMonth(series.lastDate) : null;
  let shownFrom = null;
  let shownTo = null;
  if (custom) {
    shownFrom = `${custom.from}-01`;
    shownTo = monthEnd(custom.to);
  } else if (period.years && all.length) {
    shownFrom = yearsBefore(all.at(-1).date, period.years);
  } else if (period.since) {
    shownFrom = `${period.since}-01-01`;
  }
  const inRange = (o, start) => (!start || o.date >= start) && (!shownTo || o.date <= shownTo);
  const shown = all.filter(o => inRange(o, shownFrom));
  const summary = summarize(all.filter(o => inRange(o, shownFrom && yearsBefore(shownFrom, 1))));
  // One day's tax deposits against a single day a year before says nothing, so daily flows have no year's change.
  const facts = summary && asPublished(seriesSlug) ? { ...summary, before: null } : summary;
  const slider = series && lastMonth > firstMonth ? {
    start: Math.max(firstMonth, Math.min(shownFrom ? toMonth(shownFrom) : firstMonth, lastMonth - 1)),
    end: Math.min(lastMonth, Math.max(shownTo ? toMonth(shownTo) : lastMonth, firstMonth + 1)),
  } : null;
  // How the values are shown: a daily series over a long period is weekly averages.
  const shownFrequency = series?.frequency === 'daily' && resample ? 'weekly' : series?.frequency;
  const averaged = series?.frequency === 'daily' && Boolean(resample);
  const at = o => periodLabel(o.date, shownFrequency);
  const range = shown.length ? summarize(shown) : null;
  const outflowShown = (outflow?.observations ?? []).filter(o => inRange(o, shownFrom));
  const outflowFacts = outflow ? summarize(outflow.observations.filter(o => inRange(o, shownFrom && yearsBefore(shownFrom, 1)))) : null;
  const yearChange = f => (f?.before ? formatChange(f.before.value, f.latest.value, series.unit) : '—');
  // Up and down are coloured for single series as before; in a pair (receipts against outlays) a colour
  // would read as a judgment on either side, so neither is coloured.
  const changeClass = () => undefined;

  const rail = (
    <>
      {placePicker}
      <RailGroup title="Period">
        <RadioOptions label="Period" options={periods} value={period?.value ?? null} onChange={v => set({ period: v, from: null, to: null })} />
      </RailGroup>
      {series && [series, ...(outflow ? [outflow] : [])].map(s => (
        <RailGroup key={s.slug} title={outflow ? `Source: ${s === series ? pair.inflowLabel : pair.outflowLabel}` : 'Source'}>
          <p>{s.description}</p>
          <p className="source-note">
            {`${SOURCES[s.source] ?? s.source}, series ${s.sourceId}, ${s.frequency}`}
            {averaged ? ' (shown as weekly averages)' : ''}.
            {isPrice(s.unit) ? ' Nominal dollars, not adjusted for inflation.' : ''}
            {' '}{periodLabel(s.firstDate, s.frequency)} – {periodLabel(s.lastDate, s.frequency)}.
          </p>
          {sourceLink(s) && <p><a href={sourceLink(s).href} target="_blank" rel="noreferrer">{sourceLink(s).label} ↗</a></p>}
        </RailGroup>
      ))}
    </>
  );

  return (
    <PageLayout rail={rail}>
      <SeriesHead title={title} tabs={navTabs} base={base} tab={tab} picker={picker} placeLabel={placeLabel} />

      {error ? (
        <div className="error">Failed to load the series: {error.message}</div>
      ) : loading && !series ? (
        <Loading />
      ) : !series ? (
        place && <p className="note">{choice?.label ?? nameOf(choice?.value)} is not published for this place. Choose another place or series.</p>
      ) : (
        <>
          <h2 className="chart-title">{pair ? choice.label : series.name} <small>{series.unit}</small></h2>
          {pair && facts && outflowFacts ? (
            <dl className="facts">
              <div><dt>{pair.inflowLabel}, latest</dt><dd>{formatValue(facts.latest.value, series.unit)} <small>{at(facts.latest)}</small></dd></div>
              <div><dt>Over a year</dt><dd className={changeClass(facts)}>{yearChange(facts)}</dd></div>
              <div><dt>{pair.outflowLabel}, latest</dt><dd>{formatValue(outflowFacts.latest.value, outflow.unit)} <small>{at(outflowFacts.latest)}</small></dd></div>
              <div><dt>Over a year</dt><dd className={changeClass(outflowFacts)}>{yearChange(outflowFacts)}</dd></div>
            </dl>
          ) : facts && range && !pair && (
            <dl className="facts">
              <div><dt>Latest</dt><dd>{formatValue(facts.latest.value, series.unit)} <small>{at(facts.latest)}</small></dd></div>
              <div>
                <dt>{changeSince(facts, shownFrequency)}</dt>
                <dd className={!facts.before ? undefined : facts.latest.value > facts.before.value ? 'up' : facts.latest.value < facts.before.value ? 'down' : undefined}>
                  {facts.before ? formatChange(facts.before.value, facts.latest.value, series.unit) : '—'}
                </dd>
              </div>
              <div><dt>High in period</dt><dd>{formatValue(range.high.value, series.unit)} <small>{at(range.high)}</small></dd></div>
              <div><dt>Low in period</dt><dd>{formatValue(range.low.value, series.unit)} <small>{at(range.low)}</small></dd></div>
            </dl>
          )}
          {slider && (
            <RangeSlider
              className="period-slider"
              inset={CHART_INSET}
              label="Period"
              min={firstMonth}
              max={lastMonth}
              start={slider.start}
              end={slider.end}
              format={series.frequency === 'annual' ? yearLabel : monthLabel}
              onChange={({ start, end }) => set({ period: null, from: monthKey(start), to: monthKey(end) })}
            />
          )}
          <PriceChart observations={shown} unit={series.unit} frequency={shownFrequency} band={band}
            label={pair ? nameOf(pair.inflow) : null} compare={pair && outflow ? { label: nameOf(pair.outflow), observations: outflowShown } : null} />
          {averaged && (
            <p className="note">Weekly averages of daily prices; the latest value and the year's change use the same averages. Choose a shorter period for daily prices.</p>
          )}
          {tab.note && <p className="note">{tab.note}</p>}
        </>
      )}
    </PageLayout>
  );
}

// The places a measure is published for, in the rail: the nation, the states, then each state's
// districts by the lines they were drawn on. `list`: seriesPlaces; `value`: a place key, null for the nation.
function PlacePicker({ list, value, onChange }) {
  const states = list.filter(p => p.level === 'state');
  const districtsOf = abbr => list.filter(p => p.level === 'district' && p.place.startsWith(`${abbr}-`));
  const known = !value || list.some(p => p.place === value);
  return (
    <RailGroup title="Place">
      <select className="rail-select" aria-label="Place" value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">United States</option>
        {!known && <option value={value}>{value} (not published for this series)</option>}
        {states.length > 0 && (
          <optgroup label="States">
            {states.map(p => <option key={p.place} value={p.place}>{p.label}</option>)}
          </optgroup>
        )}
        {states.map(s => districtsOf(s.place).length > 0 && (
          <optgroup key={s.place} label={`${s.label}, congressional districts`}>
            {districtsOf(s.place).map(p => <option key={p.place} value={p.place}>{p.label.replace(`${s.label} `, '')}</option>)}
          </optgroup>
        ))}
      </select>
      <p className="source-note">Districts are kept by the lines they were drawn on: figures for different lines are different places.</p>
    </RailGroup>
  );
}

// The page head shared by both views: title, tabs, the tab's introduction and the series picker.
function SeriesHead({ title, tabs, base, tab, picker, placeLabel = null }) {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{title}</h1>
      </div>
      <nav className="page-tabs" aria-label={title}>
        {tabs.map(t => (
          <Link key={t.slug} to={`${base}/${t.slug}`} className={t.slug === tab.slug ? 'on' : undefined}>{t.label}</Link>
        ))}
      </nav>
      <p className="lede">{tab.lede}</p>
      {placeLabel && <p className="series-place" data-testid="series-place">Figures for <b>{placeLabel}</b></p>}
      {picker}
    </>
  );
}

// Several series chosen: one chart per kind of measure (chartGroups), stacked with their dates lined
// up, and a table of each line's latest value. `lines`: [{ key, slug, label, item, series }].
function SeriesLines({ title, tabs, base, periods, placePicker, placeLabel, tab, picker, lines, colorSlots, loading, error, custom, period, resample, set }) {
  const months = lines.flatMap(l => [toMonth(l.series.firstDate), toMonth(l.series.lastDate)]);
  const firstMonth = months.length ? Math.min(...months) : null;
  const lastMonth = months.length ? Math.max(...months) : null;
  const latestDate = lines.map(l => l.series.observations.at(-1)?.date).filter(Boolean).sort().at(-1);
  let shownFrom = null;
  let shownTo = null;
  if (custom) {
    shownFrom = `${custom.from}-01`;
    shownTo = monthEnd(custom.to);
  } else if (period.years && latestDate) {
    shownFrom = yearsBefore(latestDate, period.years);
  } else if (period.since) {
    shownFrom = `${period.since}-01-01`;
  }
  const inRange = (o, start) => (!start || o.date >= start) && (!shownTo || o.date <= shownTo);
  // Two lines with the same name (excise taxes from BEA and from Treasury) also show their group.
  const named = label => lines.filter(l => l.label === label).length > 1;
  const drawn = lines.map(l => {
    const averaged = l.series.frequency === 'daily' && Boolean(resample) && !asPublished(l.slug);
    return {
      ...l,
      color: `var(--cat-${colorSlots.get(l.key)})`,
      detail: named(l.label) ? l.item.group : null,
      unit: l.series.unit,
      averaged,
      frequency: averaged ? 'weekly' : l.series.frequency,
      observations: l.series.observations.filter(o => inRange(o, shownFrom)),
      facts: summarize(l.series.observations.filter(o => inRange(o, shownFrom && yearsBefore(shownFrom, 1)))),
      range: summarize(l.series.observations.filter(o => inRange(o, shownFrom))),
    };
  });
  const charts = chartGroups(drawn);
  const dates = drawn.flatMap(l => (l.observations.length ? [l.observations[0].date, l.observations.at(-1).date] : [])).sort();
  const domain = dates.length ? [dates[0], dates.at(-1)] : null;
  const slider = lastMonth > firstMonth ? {
    start: Math.max(firstMonth, Math.min(shownFrom ? toMonth(shownFrom) : firstMonth, lastMonth - 1)),
    end: Math.min(lastMonth, Math.max(shownTo ? toMonth(shownTo) : lastMonth, firstMonth + 1)),
  } : null;
  const at = (o, l) => periodLabel(o.date, l.frequency);
  const sources = [...new Map(lines.map(l => [l.slug, l])).values()];

  const rail = (
    <>
      {placePicker}
      <RailGroup title="Period">
        <RadioOptions label="Period" options={periods} value={period?.value ?? null} onChange={v => set({ period: v, from: null, to: null })} />
      </RailGroup>
      {sources.map(({ label, series: s }) => (
        <RailGroup key={s.slug} title={`Source: ${label}`}>
          <p>{s.description}</p>
          <p className="source-note">
            {`${SOURCES[s.source] ?? s.source}, series ${s.sourceId}, ${s.frequency}`}.
            {isPrice(s.unit) ? ' Nominal dollars, not adjusted for inflation.' : ''}
            {' '}{periodLabel(s.firstDate, s.frequency)} – {periodLabel(s.lastDate, s.frequency)}.
          </p>
          {sourceLink(s) && <p><a href={sourceLink(s).href} target="_blank" rel="noreferrer">{sourceLink(s).label} ↗</a></p>}
        </RailGroup>
      ))}
    </>
  );

  return (
    <PageLayout rail={rail}>
      <SeriesHead title={title} tabs={tabs} base={base} tab={tab} picker={picker} placeLabel={placeLabel} />
      {error ? (
        <div className="error">Failed to load the series: {error.message}</div>
      ) : loading ? (
        <Loading />
      ) : domain && (
        <>
          <table className="lines-facts" data-testid="lines-facts">
            <thead>
              <tr><th>Series</th><th>Latest</th><th>Over a year</th><th>High in period</th><th>Low in period</th></tr>
            </thead>
            <tbody>
              {drawn.map(l => (
                <tr key={l.key} style={{ '--c': l.color }}>
                  <th><i className="swatch line" />{l.label}{l.detail && <small>{l.detail}</small>}</th>
                  <td>{l.facts ? <>{formatValue(l.facts.latest.value, l.unit)} <small>{at(l.facts.latest, l)}</small></> : '—'}</td>
                  <td>{l.facts?.before && !asPublished(l.slug) ? formatChange(l.facts.before.value, l.facts.latest.value, l.unit) : '—'}</td>
                  <td>{l.range ? <>{formatValue(l.range.high.value, l.unit)} <small>{at(l.range.high, l)}</small></> : '—'}</td>
                  <td>{l.range ? <>{formatValue(l.range.low.value, l.unit)} <small>{at(l.range.low, l)}</small></> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {slider && (
            <RangeSlider
              className="period-slider"
              inset={CHART_INSET}
              label="Period"
              min={firstMonth}
              max={lastMonth}
              start={slider.start}
              end={slider.end}
              format={lines.every(l => l.series.frequency === 'annual') ? yearLabel : monthLabel}
              onChange={({ start, end }) => set({ period: null, from: monthKey(start), to: monthKey(end) })}
            />
          )}
          {charts.length > 1 && (
            <p className="note">These are measured differently ({charts.map(c => c.title.toLowerCase()).join('; ')}), so each has its own chart, one above the other, with the same dates.</p>
          )}
          {charts.map(chart => (
            <section key={chart.key} className="lines-chart">
              <h2 className="chart-title">{chart.title}</h2>
              <LinesChart lines={chart.lines} unit={chart.unit} domain={domain} height={charts.length > 1 ? 260 : undefined} />
            </section>
          ))}
          {drawn.some(l => l.averaged) && (
            <p className="note">Daily series are shown as weekly averages over this period; choose a shorter period for daily values.</p>
          )}
          {tab.note && <p className="note">{tab.note}</p>}
        </>
      )}
    </PageLayout>
  );
}
