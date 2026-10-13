import { useParams } from 'react-router-dom';
import SeriesPage from '../components/SeriesPage';
import { DEMOGRAPHY_TABS } from '../demography';
import Population from './Population';

// Annual figures: periods are counted in years, and the estimates reach back to 1900.
const PERIODS = [
  { label: 'Last 10 years', value: '10y', years: 10 },
  { label: 'Last 25 years', value: '25y', years: 25 },
  { label: 'Since 1900', value: '1900', since: 1900 },
  { label: 'Everything', value: 'all' },
];

// Population and demographics charted as Economic Data charts its series, for the nation, a state or
// a congressional district; the Source files tab lists the Census Bureau's files as downloaded.
export default function Demographics() {
  const { tab } = useParams();
  if (tab === 'files') return <Population />;
  return (
    <SeriesPage title="Demographic Data" tabs={DEMOGRAPHY_TABS.filter(t => !t.files)} navTabs={DEMOGRAPHY_TABS}
      base="/demographics" periods={PERIODS} defaultPeriod="all" places />
  );
}
