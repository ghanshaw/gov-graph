import SeriesPage from '../components/SeriesPage';
import { ECONOMY_TABS } from '../economy';

// Long periods of a daily series are averaged per week, so a chart of decades stays a few
// thousand points; weekly and monthly series are shown as published.
const PERIODS = [
  { label: 'Last year', value: '1y', years: 1 },
  { label: 'Last 5 years', value: '5y', years: 5 },
  { label: 'Last 10 years', value: '10y', years: 10, resample: 'week' },
  { label: 'Everything', value: 'all', resample: 'week' },
];

export default function Economy() {
  return <SeriesPage title="Economic Data" tabs={ECONOMY_TABS} base="/economy" periods={PERIODS} defaultPeriod="10y" />;
}
