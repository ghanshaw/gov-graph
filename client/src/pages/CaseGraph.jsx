import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import DAGGraph from "../components/DAGGraph";
import { GET_CASE_GRAPH } from "../queries";

const LEGEND = [
  { label: "Affirmed", color: "#22c55e" },
  { label: "Overruled / Reversed", color: "#ef4444" },
  { label: "Distinguished", color: "#f59e0b" },
  { label: "Unknown", color: "#6b7280" },
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", background: "#112040" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid #1e3a5f",
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', serif",
              fontSize: 20,
              color: "#f5f0e8",
              fontWeight: 600,
            }}
          >
            Case Citation Graph
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(136,153,187,0.8)", fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Scroll to zoom · Drag to pan · Click node to open source
          </p>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {LEGEND.map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width={28} height={12}>
                <line x1={0} y1={6} x2={28} y2={6} stroke={color} strokeWidth={2} />
                <polygon points="22,2 28,6 22,10" fill={color} />
              </svg>
              <span style={{ color: "#f5f0e8", fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif" }}>{label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={28} height={12}>
              <line x1={0} y1={6} x2={28} y2={6} stroke="#6b7280" strokeWidth={2} strokeDasharray="4 3" />
              <polygon points="22,2 28,6 22,10" fill="#6b7280" />
            </svg>
            <span style={{ color: "#f5f0e8", fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif" }}>Skip-level</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#1a2f52", borderRadius: 6, border: "1px solid #334e7e", overflow: "hidden" }}>
            {["Simplified", "Full"].map(label => {
              const active = label === "Simplified" ? simplified : !simplified;
              return (
                <button
                  key={label}
                  onClick={() => setSimplified(label === "Simplified")}
                  style={{
                    padding: "4px 12px",
                    fontSize: 12,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    border: "none",
                    cursor: "pointer",
                    background: active ? "#2a4a7f" : "transparent",
                    color: active ? "#f5f0e8" : "rgba(136,153,187,0.7)",
                    transition: "background 0.15s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(136,153,187,0.8)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
            Loading graph…
          </div>
        )}
        {error && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ef4444", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
            {error.message}
          </div>
        )}
        {data && <DAGGraph nodes={nodes} edges={edges} />}
      </div>
    </div>
  );
}
