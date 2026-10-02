import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import PageLayout from '../components/PageLayout';
import { RailGroup, RadioOptions, Fact } from '../components/Rail';
import DAGGraph from "../components/DAGGraph";
import { GET_CASE_GRAPH } from "../queries";

// Same colours as TREATMENT_COLOR in components/DAGGraph.jsx.
const LEGEND = [
  { label: "Affirmed", color: "var(--ok)" },
  { label: "Overruled / Reversed", color: "var(--danger)" },
  { label: "Distinguished", color: "var(--warn)" },
  { label: "Unknown", color: "var(--muted)" },
  { label: "Skip-level", color: "var(--muted)", dashed: true },
];

const VIEWS = [
  { label: 'Simplified', value: true },
  { label: 'Full', value: false },
];

// Roe v. Wade DB id
const DEFAULT_SEED_ID = 263;

export default function CaseGraph() {
  const [simplified, setSimplified] = useState(true);
  const [searchParams] = useSearchParams();
  const seedId = parseInt(searchParams.get('caseId'), 10) || DEFAULT_SEED_ID;
  const { data, loading, error } = useQuery(GET_CASE_GRAPH, {
    variables: { caseId: seedId },
  });

  const edges = data
    ? (simplified ? data.caseGraph.edges.filter(e => e.isDirect !== false) : data.caseGraph.edges)
    : [];

  // Only include nodes referenced by visible edges (plus the seed)
  const visibleNodeIds = new Set([String(seedId)]);
  edges.forEach(e => { visibleNodeIds.add(e.source); visibleNodeIds.add(e.target); });
  const nodes = data ? data.caseGraph.nodes.filter(n => visibleNodeIds.has(n.id)) : [];
  const seed = data?.caseGraph.nodes.find(n => n.isSeed);

  const rail = (
    <>
      <RailGroup title="Citations">
        {LEGEND.map(({ label, color, dashed }) => (
          <div key={label} className="legend-row">
            <svg width={28} height={12} style={{ color }}>
              <line x1={0} y1={6} x2={22} y2={6} stroke="currentColor" strokeWidth={2} strokeDasharray={dashed ? '4 3' : undefined} />
              <polygon points="22,2 28,6 22,10" fill="currentColor" />
            </svg>
            {label}
          </div>
        ))}
      </RailGroup>
      <div>
        <RailGroup title="View">
          <RadioOptions label="View" options={VIEWS} value={simplified} onChange={setSimplified} />
        </RailGroup>
        <RailGroup title="In this graph">
          <Fact label="Cases">{data ? nodes.length : '…'}</Fact>
          <Fact label="Citations">{data ? edges.length : '…'}</Fact>
        </RailGroup>
      </div>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <div className="page-head">
        <h1 className="page-title">
          Case Citation Graph
          {seed && <small>{seed.name}</small>}
        </h1>
      </div>

      <div className="graph-frame">
        {loading && <div className="state">Loading graph…</div>}
        {error && <div className="error">{error.message}</div>}
        {data && <DAGGraph nodes={nodes} edges={edges} />}
      </div>
      <p className="note">Scroll to zoom · Drag to pan · Click a case to open its source</p>
    </PageLayout>
  );
}
