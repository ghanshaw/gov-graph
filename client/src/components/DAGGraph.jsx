import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import dagre from "dagre";

const TREATMENT_COLOR = {
  affirmed: "#22c55e",
  overruled: "#ef4444",
  reversed: "#ef4444",
  distinguished: "#f59e0b",
  null: "#6b7280",
};

const NODE_W = 180;
const NODE_H = 52;
const MARKER_SIZE = 6;

function treatmentColor(treatment) {
  return TREATMENT_COLOR[treatment] ?? TREATMENT_COLOR.null;
}

function buildLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 90, nodesep: 60, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H, label: n.id }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);
  return g;
}

function nodePath(x, y) {
  const r = 6;
  const w = NODE_W;
  const h = NODE_H;
  const left = x - w / 2;
  const top = y - h / 2;
  return `M${left + r},${top} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${h - 2 * r} a${r},${r} 0 0 1 ${r},-${r} z`;
}

function edgePath(g, edge, sourceRank, targetRank) {
  const { points } = g.edge(edge.source, edge.target);
  const isSkip = Math.abs(targetRank - sourceRank) > 1;

  if (!isSkip) {
    // Straight polyline through dagre waypoints
    const line = d3.line().x((p) => p.x).y((p) => p.y);
    return { d: line(points), curved: false };
  }

  // Skip-level: cubic bezier arcing to the right of the cluster
  const src = points[0];
  const tgt = points[points.length - 1];
  const midX = Math.max(...points.map((p) => p.x)) + 120;
  const midY = (src.y + tgt.y) / 2;
  const d = `M${src.x},${src.y} C${midX},${src.y} ${midX},${tgt.y} ${tgt.x},${tgt.y}`;
  return { d, curved: true };
}

export default function DAGGraph({ nodes, edges }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!nodes?.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = buildLayout(nodes, edges);

    // Compute ranks
    const rankMap = {};
    nodes.forEach((n) => {
      const gn = g.node(n.id);
      if (gn) rankMap[n.id] = gn.rank ?? 0;
    });

    const graphW = g.graph().width || 800;
    const graphH = g.graph().height || 600;

    svg.attr("width", "100%").attr("height", "100%");

    const defs = svg.append("defs");

    // Arrow markers per treatment color
    const treatments = [...new Set(edges.map((e) => e.treatment ?? null))];
    treatments.forEach((t) => {
      const color = treatmentColor(t);
      const id = `arrow-${t ?? "unknown"}`;
      defs
        .append("marker")
        .attr("id", id)
        .attr("viewBox", `0 0 ${MARKER_SIZE * 2} ${MARKER_SIZE * 2}`)
        .attr("refX", MARKER_SIZE * 2)
        .attr("refY", MARKER_SIZE)
        .attr("markerWidth", MARKER_SIZE)
        .attr("markerHeight", MARKER_SIZE)
        .attr("orient", "auto")
        .append("path")
        .attr("d", `M0,0 L${MARKER_SIZE * 2},${MARKER_SIZE} L0,${MARKER_SIZE * 2} z`)
        .attr("fill", color);
    });

    const root = svg.append("g").attr("class", "root");

    svg.call(
      d3
        .zoom()
        .scaleExtent([0.2, 3])
        .on("zoom", (event) => root.attr("transform", event.transform))
    );

    // Center initial view
    const svgEl = svgRef.current;
    const viewW = svgEl.clientWidth || 900;
    const viewH = svgEl.clientHeight || 600;
    root.attr("transform", `translate(${(viewW - graphW) / 2},${(viewH - graphH) / 2})`);

    // Draw edges
    edges.forEach((edge) => {
      const ge = g.edge(edge.source, edge.target);
      if (!ge) return;
      const srcRank = rankMap[edge.source] ?? 0;
      const tgtRank = rankMap[edge.target] ?? 0;
      const { d, curved } = edgePath(g, edge, srcRank, tgtRank);
      const color = treatmentColor(edge.treatment ?? null);
      const markerId = `arrow-${edge.treatment ?? "unknown"}`;

      root
        .append("path")
        .attr("d", d)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 1.8)
        .attr("stroke-dasharray", curved ? "6 4" : null)
        .attr("marker-end", `url(#${markerId})`)
        .attr("opacity", 0.85);
    });

    // Draw nodes
    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
    g.nodes().forEach((id) => {
      const gn = g.node(id);
      const n = nodeMap[id];
      if (!gn || !n) return;

      const grp = root
        .append("g")
        .attr("class", "node")
        .attr("transform", `translate(${gn.x},${gn.y})`)
        .style("cursor", n.url ? "pointer" : "default")
        .on("mouseenter", (event) => {
          setTooltip({ node: n, x: event.clientX, y: event.clientY });
        })
        .on("mousemove", (event) => {
          setTooltip((prev) => prev && { ...prev, x: event.clientX, y: event.clientY });
        })
        .on("mouseleave", () => setTooltip(null))
        .on("mousedown", (event) => { event.stopPropagation(); })
        .on("click", (event) => {
          event.stopPropagation();
          if (n.url) window.open(n.url, "_blank", "noopener");
        });

      // Seed node: gold ring
      if (n.isSeed) {
        grp
          .append("path")
          .attr("d", nodePath(0, 0))
          .attr("fill", "none")
          .attr("stroke", "#c9a84c")
          .attr("stroke-width", 3);
      }

      grp
        .append("path")
        .attr("d", nodePath(0, 0))
        .attr("fill", "#1a2f52")
        .attr("stroke", n.isSeed ? "#c9a84c" : "#334e7e")
        .attr("stroke-width", n.isSeed ? 2 : 1);

      // Case name (truncated)
      const maxChars = 22;
      const label = n.name.length > maxChars ? n.name.slice(0, maxChars - 1) + "…" : n.name;

      grp
        .append("text")
        .attr("y", -7)
        .attr("text-anchor", "middle")
        .attr("fill", n.isSeed ? "#c9a84c" : "#f5f0e8")
        .attr("font-family", "'IBM Plex Sans', sans-serif")
        .attr("font-size", 12)
        .attr("font-weight", n.isSeed ? 600 : 400)
        .text(label);

      grp
        .append("text")
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .attr("fill", "rgba(136,153,187,0.8)")
        .attr("font-family", "'IBM Plex Mono', monospace")
        .attr("font-size", 10)
        .text(`${n.court ?? "SCOTUS"} · ${n.year}`);
    });
  }, [nodes, edges]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%", background: "#112040" }} />
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 14,
            top: tooltip.y - 10,
            background: "#1a2f52",
            border: "1px solid #334e7e",
            borderRadius: 6,
            padding: "8px 12px",
            color: "#f5f0e8",
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 13,
            pointerEvents: "none",
            zIndex: 9999,
            maxWidth: 240,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tooltip.node.name}</div>
          <div style={{ color: "rgba(136,153,187,0.8)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
            {tooltip.node.court ?? "SCOTUS"} · {tooltip.node.year}
          </div>
        </div>
      )}
    </div>
  );
}
