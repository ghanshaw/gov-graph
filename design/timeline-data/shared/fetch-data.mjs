// Pulls the series the timeline-data mocks use from the local GraphQL server into one data.js.
const SLUGS = `unemployment-rate unemployment-u6 unemployed-persons unemployment-rate--black unemployment-rate--hispanic
unemployment-rate--white unemployment-rate--asian unemployment-rate--women unemployment-rate--men unemployment-rate--16-19
unemployment-rate--bachelors unemployment-rate--black-women
cpi cpi-core pce-price pce-price-core
fed-funds fed-target-lower fed-target-upper treasury-10y treasury-2y mortgage-rate
wti-spot brent-spot gasoline-retail diesel-retail
mts-total-receipts mts-individual-income-taxes mts-corporation-income-taxes omb-receipts omb-receipts-gdp omb-individual-gdp omb-corporate-gdp
irs-top-rate cbo-tax-rate--highest cbo-tax-rate--middle cbo-tax-rate--lowest cbo-tax-share--highest
mts-customs-duties usitc-duties-ratio-total mts-individual-refunds dts-withheld federal-tax-receipts
gdp gdp-real gdp-growth debt-total debt-public mts-deficit mts-total-outlays omb-surplus-gdp omb-outlays-gdp
home-price hoam-share homeownership house-prices sentiment spending trade-balance-monthly`.split(/\s+/).filter(Boolean);
const q = `query($slugs:[String!]!,$from:String){ economicSeriesSet(slugs:$slugs){ slug source frequency name description publisherTitle category unit firstDate lastDate
  week: observations(from:$from, resample:"week"){date value} raw: observations(from:$from){date value} } }`;
const res = await fetch('http://localhost:9001/graphql', { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: q, variables: { slugs: SLUGS, from: '1980-01-01' } }) });
const { data, errors } = await res.json();
if (errors) { console.error(errors); process.exit(1); }
const r = v => Number(v.toPrecision(5));
const series = {};
for (const s of data.economicSeriesSet) {
  const coarse = s.frequency === 'daily' && s.slug !== 'dts-withheld';
  const obs = coarse ? s.week : s.raw;
  series[s.slug] = { name: s.name, source: s.source, frequency: s.frequency, shown: coarse ? 'weekly averages' : null,
    description: s.description, publisherTitle: s.publisherTitle, category: s.category, unit: s.unit, firstDate: s.firstDate, lastDate: s.lastDate,
    d: obs.map(o => o.date).join(','), v: obs.map(o => r(o.value)) };
}
const missing = SLUGS.filter(s => !series[s]);
if (missing.length) console.error('missing', missing);
const out = `// Generated ${new Date().toISOString().slice(0, 10)} from the local GraphQL server (economicSeriesSet), from 1980.
// Daily series other than dts-withheld are weekly averages, as the timeline draws them. Values to 5 significant figures.
window.GG_SERIES = ${JSON.stringify(series)};
`;
(await import('node:fs')).writeFileSync(process.argv[2], out);
console.log(Object.keys(series).length, 'series', (out.length / 1024).toFixed(0), 'KB');
