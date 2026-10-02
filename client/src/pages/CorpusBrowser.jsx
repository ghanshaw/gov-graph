import { useState, useCallback } from 'react';

const BRANCH_COLORS = {
  legislative: {
    header: 'rgba(59,130,246,0.85)',
    border: 'rgba(59,130,246,0.4)',
    connector: 'rgba(59,130,246,0.35)',
    badgeBg: 'rgba(59,130,246,0.12)',
    badgeText: '#93c5fd',
  },
  executive: {
    header: 'rgba(201,168,76,0.85)',
    border: 'rgba(201,168,76,0.4)',
    connector: 'rgba(201,168,76,0.35)',
    badgeBg: 'rgba(201,168,76,0.12)',
    badgeText: 'var(--gold)',
  },
  judicial: {
    header: 'rgba(168,85,247,0.85)',
    border: 'rgba(168,85,247,0.4)',
    connector: 'rgba(168,85,247,0.35)',
    badgeBg: 'rgba(168,85,247,0.12)',
    badgeText: '#c4b5fd',
  },
  default: {
    header: 'rgba(26,48,96,0.95)',
    border: 'rgba(201,168,76,0.3)',
    connector: 'rgba(201,168,76,0.3)',
    badgeBg: 'rgba(201,168,76,0.08)',
    badgeText: 'var(--gold)',
  },
};

const CORPUS = [
  {
    id: 'root',
    label: 'The Government of the United States',
    desc: 'Established by the Constitution',
    children: [
      // ── LEGISLATIVE ──────────────────────────────────────────────
      {
        id: 'leg',
        label: 'Legislative Branch',
        branch: 'legislative',
        children: [
          {
            id: 'leg-congress',
            label: 'The Congress',
            children: [
              {
                id: 'leg-senate',
                label: 'U.S. Senate',
                children: [
                  { id: 'leg-senate-bills', label: 'Senate Bills', abbr: 'S.' },
                  { id: 'leg-senate-res', label: 'Senate Resolutions', abbr: 'S.Res.' },
                  { id: 'leg-senate-jres', label: 'Joint Resolutions', abbr: 'S.J.Res.' },
                  { id: 'leg-senate-cres', label: 'Concurrent Resolutions', abbr: 'S.Con.Res.' },
                  { id: 'leg-senate-reports', label: 'Committee Reports' },
                  { id: 'leg-senate-treaty', label: 'Treaty Documents' },
                  { id: 'leg-senate-exec-comm', label: 'Executive Communications' },
                ],
              },
              {
                id: 'leg-house',
                label: 'House of Representatives',
                children: [
                  { id: 'leg-house-bills', label: 'House Bills', abbr: 'H.R.' },
                  { id: 'leg-house-res', label: 'House Resolutions', abbr: 'H.Res.' },
                  { id: 'leg-house-jres', label: 'Joint Resolutions', abbr: 'H.J.Res.' },
                  { id: 'leg-house-cres', label: 'Concurrent Resolutions', abbr: 'H.Con.Res.' },
                  { id: 'leg-house-reports', label: 'Committee Reports' },
                ],
              },
              {
                id: 'leg-enacted',
                label: 'Enacted Law',
                desc: 'Joint output of both chambers',
                children: [
                  { id: 'leg-pub-law', label: 'Public Laws', abbr: 'Pub.L.' },
                  { id: 'leg-pvt-law', label: 'Private Laws' },
                  { id: 'leg-stat', label: 'Statutes at Large' },
                  { id: 'leg-usc', label: 'U.S. Code', abbr: 'U.S.C.' },
                  { id: 'leg-record', label: 'Congressional Record' },
                ],
              },
            ],
          },
          {
            id: 'leg-gao',
            label: 'GAO',
            desc: 'Govt. Accountability Office',
            children: [
              { id: 'leg-gao-reports', label: 'GAO Reports' },
              { id: 'leg-gao-decisions', label: 'Decisions & Opinions' },
              { id: 'leg-gao-testimony', label: 'Congressional Testimony' },
            ],
          },
          {
            id: 'leg-cbo',
            label: 'CBO',
            desc: 'Congressional Budget Office',
            children: [
              { id: 'leg-cbo-scorecards', label: 'Cost Estimates' },
              { id: 'leg-cbo-outlook', label: 'Budget & Economic Outlook' },
              { id: 'leg-cbo-analysis', label: 'Policy Analysis' },
            ],
          },
          {
            id: 'leg-loc',
            label: 'Library of Congress',
            children: [
              { id: 'leg-loc-crs', label: 'CRS Reports' },
              { id: 'leg-loc-copyright', label: 'Copyright Office Records' },
            ],
          },
          {
            id: 'leg-gpo',
            label: 'GPO',
            desc: 'Govt. Publishing Office',
            children: [
              { id: 'leg-gpo-docs', label: 'Federal Depository Publications' },
              { id: 'leg-gpo-cfr', label: 'CFR & Federal Register' },
            ],
          },
        ],
      },

      // ── EXECUTIVE ────────────────────────────────────────────────
      {
        id: 'exec',
        label: 'Executive Branch',
        branch: 'executive',
        children: [
          {
            id: 'exec-potus',
            label: 'The President',
            children: [
              { id: 'exec-eo', label: 'Executive Orders', abbr: 'E.O.' },
              { id: 'exec-proc', label: 'Proclamations' },
              { id: 'exec-memo', label: 'Presidential Memoranda' },
              { id: 'exec-nsm', label: 'National Security Memoranda', abbr: 'NSM' },
              { id: 'exec-sap', label: 'Statements of Admin. Policy', abbr: 'SAP' },
              { id: 'exec-veto', label: 'Veto Messages' },
              { id: 'exec-signing', label: 'Signing Statements' },
            ],
          },
          {
            id: 'exec-eop',
            label: 'Executive Office of the President',
            abbr: 'EOP',
            children: [
              {
                id: 'exec-omb',
                label: 'OMB',
                desc: 'Office of Management & Budget',
                children: [
                  { id: 'exec-omb-circ', label: 'OMB Circulars' },
                  { id: 'exec-omb-memo', label: 'OMB Memoranda' },
                  { id: 'exec-budget', label: 'Presidential Budget' },
                ],
              },
              {
                id: 'exec-nsc',
                label: 'NSC',
                desc: 'National Security Council',
                children: [
                  { id: 'exec-ppd', label: 'Presidential Policy Directives', abbr: 'PPD' },
                  { id: 'exec-nsdd', label: 'Natl. Security Directives', abbr: 'NSDD' },
                  { id: 'exec-nsm-nsc', label: 'National Security Memoranda' },
                ],
              },
              {
                id: 'exec-cea',
                label: 'CEA',
                desc: 'Council of Economic Advisers',
                children: [
                  { id: 'exec-cea-report', label: 'Economic Report of the President' },
                  { id: 'exec-cea-analysis', label: 'Economic Analysis' },
                ],
              },
            ],
          },
          {
            id: 'exec-state',
            label: 'Dept. of State',
            abbr: 'DOS',
            children: [
              { id: 'exec-treaties', label: 'Treaties', abbr: 'TIAS' },
              { id: 'exec-exec-agreements', label: 'Executive Agreements' },
              { id: 'exec-diplo', label: 'Diplomatic Cables' },
              { id: 'exec-state-ogc', label: 'OGC Legal Opinions' },
            ],
          },
          {
            id: 'exec-treasury',
            label: 'Dept. of the Treasury',
            abbr: 'USDT',
            children: [
              { id: 'exec-treasury-rules', label: 'Treasury Regulations' },
              { id: 'exec-irs', label: 'IRS Guidance & Rulings' },
              { id: 'exec-ofac', label: 'OFAC Sanctions Lists' },
            ],
          },
          {
            id: 'exec-dod',
            label: 'Dept. of Defense',
            abbr: 'DOD',
            children: [
              { id: 'exec-dod-directives', label: 'DoD Directives' },
              { id: 'exec-dod-instructions', label: 'DoD Instructions' },
              { id: 'exec-dod-ig', label: 'IG Reports' },
            ],
          },
          {
            id: 'exec-doj',
            label: 'Dept. of Justice',
            abbr: 'DOJ',
            children: [
              { id: 'exec-olc', label: 'OLC Opinions' },
              { id: 'exec-ag', label: 'Attorney General Opinions' },
              { id: 'exec-doj-ig', label: 'IG Reports' },
            ],
          },
          {
            id: 'exec-dhs',
            label: 'Dept. of Homeland Security',
            abbr: 'DHS',
            children: [
              { id: 'exec-dhs-rules', label: 'DHS Rules & Guidance' },
              { id: 'exec-dhs-ig', label: 'IG Reports' },
              { id: 'exec-dhs-foia', label: 'FOIA Releases' },
            ],
          },
          {
            id: 'exec-intel',
            label: 'Intelligence Community',
            children: [
              { id: 'exec-nie', label: 'National Intelligence Estimates', abbr: 'NIE' },
              { id: 'exec-odni', label: 'ODNI Reports' },
              { id: 'exec-pclob', label: 'PCLOB Reports' },
              { id: 'exec-fbi', label: 'FBI Vault Releases' },
            ],
          },
          {
            id: 'exec-regulatory',
            label: 'Federal Regulatory System',
            children: [
              { id: 'exec-fr', label: 'Federal Register', abbr: 'Fed. Reg.' },
              { id: 'exec-cfr', label: 'Code of Federal Regulations', abbr: 'C.F.R.' },
              { id: 'exec-nprm', label: 'Proposed Rules', abbr: 'NPRM' },
              { id: 'exec-guidance', label: 'Agency Guidance Documents' },
            ],
          },
          {
            id: 'exec-independent',
            label: 'Independent Agencies',
            children: [
              {
                id: 'exec-fec',
                label: 'FEC',
                desc: 'Federal Election Commission',
                children: [
                  { id: 'exec-fec-opinions', label: 'Advisory Opinions' },
                  { id: 'exec-fec-filings', label: 'Campaign Finance Filings' },
                ],
              },
              {
                id: 'exec-fcc',
                label: 'FCC',
                desc: 'Federal Communications Commission',
                children: [
                  { id: 'exec-fcc-orders', label: 'FCC Orders' },
                  { id: 'exec-fcc-filings', label: 'Public Filings' },
                ],
              },
              {
                id: 'exec-sec',
                label: 'SEC',
                desc: 'Securities & Exchange Commission',
                children: [
                  { id: 'exec-sec-filings', label: 'EDGAR Filings' },
                  { id: 'exec-sec-rules', label: 'Rules & Releases' },
                ],
              },
              {
                id: 'exec-fed',
                label: 'Federal Reserve',
                children: [
                  { id: 'exec-fed-minutes', label: 'FOMC Minutes' },
                  { id: 'exec-fed-reports', label: 'Fed Reports & Speeches' },
                ],
              },
              {
                id: 'exec-ftc',
                label: 'FTC',
                desc: 'Federal Trade Commission',
                children: [
                  { id: 'exec-ftc-opinions', label: 'Advisory Opinions' },
                  { id: 'exec-ftc-orders', label: 'Consent Orders' },
                ],
              },
              {
                id: 'exec-cfpb',
                label: 'CFPB',
                desc: 'Consumer Financial Protection Bureau',
                children: [
                  { id: 'exec-cfpb-rules', label: 'Rules & Guidance' },
                  { id: 'exec-cfpb-enforcement', label: 'Enforcement Actions' },
                ],
              },
            ],
          },
        ],
      },

      // ── JUDICIAL ────────────────────────────────────────────────
      {
        id: 'jud',
        label: 'Judicial Branch',
        branch: 'judicial',
        children: [
          {
            id: 'jud-scotus',
            label: 'Supreme Court of the United States',
            abbr: 'SCOTUS',
            children: [
              { id: 'jud-scotus-majority', label: 'Majority Opinions' },
              { id: 'jud-scotus-concur', label: 'Concurring Opinions' },
              { id: 'jud-scotus-dissent', label: 'Dissenting Opinions' },
              { id: 'jud-scotus-orders', label: 'Orders List' },
              { id: 'jud-scotus-oral', label: 'Oral Argument Transcripts' },
              { id: 'jud-scotus-rules', label: 'Rules of the Court' },
            ],
          },
          {
            id: 'jud-circuit',
            label: 'Courts of Appeals',
            desc: '1st–11th, D.C. & Federal Circuits',
            children: [
              { id: 'jud-circuit-opinions', label: 'Panel Opinions' },
              { id: 'jud-circuit-en-banc', label: 'En Banc Opinions' },
              { id: 'jud-circuit-rules', label: 'Local Circuit Rules' },
            ],
          },
          {
            id: 'jud-district',
            label: 'U.S. District Courts',
            children: [
              { id: 'jud-district-opinions', label: 'Judicial Opinions' },
              { id: 'jud-district-orders', label: 'Court Orders' },
              { id: 'jud-district-consent', label: 'Consent Decrees' },
              { id: 'jud-district-dockets', label: 'Court Dockets' },
            ],
          },
          {
            id: 'jud-special',
            label: 'Specialized Courts',
            children: [
              { id: 'jud-fisc', label: 'FISC Opinions', abbr: 'FISC' },
              { id: 'jud-tax', label: 'U.S. Tax Court' },
              { id: 'jud-claims', label: 'Court of Federal Claims' },
              { id: 'jud-intl-trade', label: 'Court of Intl. Trade' },
              { id: 'jud-bankruptcy', label: 'Bankruptcy Courts' },
            ],
          },
          {
            id: 'jud-admin',
            label: 'Administrative Adjudication',
            children: [
              { id: 'jud-alj', label: 'ALJ Decisions' },
              { id: 'jud-bva', label: 'Board of Veterans Appeals' },
              { id: 'jud-bia', label: 'Board of Immigration Appeals' },
              { id: 'jud-nlrb', label: 'NLRB Decisions' },
            ],
          },
        ],
      },
    ],
  },
];

const CARD_WIDTH = 160;
const CARD_GAP = 20;
// Depth at which children switch from horizontal spread to vertical list
const VERTICAL_DEPTH = 3;

function OrgCard({ node, colors, isLeaf, isExpanded, onToggle, compact }) {
  const [hovered, setHovered] = useState(false);

  if (compact) {
    // Vertical list row style for depth >= VERTICAL_DEPTH
    return (
      <div
        onClick={() => onToggle && onToggle(node.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 10px',
          borderRadius: '3px',
          border: `1px solid ${hovered ? colors.border : 'rgba(255,255,255,0.05)'}`,
          background: hovered ? 'rgba(17,32,64,0.8)' : 'rgba(10,22,40,0.4)',
          cursor: isLeaf ? 'default' : 'pointer',
          transition: 'all 0.12s',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
          <div style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: isLeaf ? 'var(--text-muted)' : colors.badgeText,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: '0.72rem',
            color: isLeaf ? 'var(--text-muted)' : 'var(--cream-dark)',
            lineHeight: 1.3,
          }}>
            {node.label}
          </span>
          {node.abbr && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.58rem',
              color: colors.badgeText,
              background: colors.badgeBg,
              padding: '1px 4px',
              borderRadius: '2px',
              flexShrink: 0,
            }}>
              {node.abbr}
            </span>
          )}
        </div>
        {!isLeaf && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.55rem',
            color: colors.badgeText,
            opacity: 0.6,
            flexShrink: 0,
          }}>
            {isExpanded ? '▾' : '▸'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={isLeaf ? undefined : () => onToggle(node.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: `${CARD_WIDTH}px`,
        borderRadius: '5px',
        border: `1px solid ${colors.border}`,
        background: hovered && !isLeaf ? 'rgba(17,32,64,0.9)' : 'rgba(17,32,64,0.7)',
        cursor: isLeaf ? 'default' : 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        flexShrink: 0,
        transform: hovered && !isLeaf ? 'translateY(-1px)' : 'none',
        boxShadow: hovered && !isLeaf ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <div style={{
        background: isLeaf ? 'rgba(255,255,255,0.04)' : colors.header,
        padding: '8px 10px',
        borderRadius: '4px 4px 0 0',
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '0.78rem',
          fontWeight: 600,
          color: isLeaf ? 'var(--text-muted)' : 'var(--cream)',
          lineHeight: 1.25,
          wordBreak: 'break-word',
          paddingRight: '14px',
        }}>
          {node.label}
        </div>
      </div>

      {(node.abbr || node.desc) && (
        <div style={{ padding: '5px 10px 8px' }}>
          {node.abbr && (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.6rem',
              color: colors.badgeText,
              background: colors.badgeBg,
              display: 'inline-block',
              padding: '2px 5px',
              borderRadius: '2px',
              marginBottom: node.desc ? '4px' : 0,
            }}>
              {node.abbr}
            </div>
          )}
          {node.desc && (
            <div style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              marginTop: node.abbr ? '2px' : 0,
            }}>
              {node.desc}
            </div>
          )}
        </div>
      )}

      {!isLeaf && (
        <div style={{
          position: 'absolute',
          bottom: '6px',
          right: '8px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.6rem',
          color: colors.badgeText,
          opacity: 0.7,
        }}>
          {isExpanded ? '▾' : '▸'}
        </div>
      )}
    </div>
  );
}

// Compact vertical list rendered at depth >= VERTICAL_DEPTH
function VerticalList({ nodes, branch, expanded, onToggle }) {
  const colors = BRANCH_COLORS[branch || 'default'];
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: `${CARD_WIDTH}px`,
      marginTop: '0px',
    }}>
      {nodes.map((node, i) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expanded.has(node.id);
        const isLast = i === nodes.length - 1;
        return (
          <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {/* vertical spine + horizontal branch */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '18px', flexShrink: 0 }}>
                {/* top half of vertical spine (always shown) */}
                <div style={{ width: '2px', height: '13px', background: colors.connector }} />
                {/* elbow: horizontal branch */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '2px', height: '2px', background: colors.connector }} />
                  <div style={{ width: '14px', height: '2px', background: colors.connector }} />
                </div>
                {/* bottom half of vertical spine (hidden for last item) */}
                <div style={{ width: '2px', flexGrow: 1, background: isLast ? 'transparent' : colors.connector }} />
              </div>

              <div style={{ flex: 1, paddingBottom: '3px' }}>
                <OrgCard
                  node={node}
                  colors={colors}
                  isLeaf={!hasChildren}
                  isExpanded={isExpanded}
                  onToggle={onToggle}
                  compact
                />
              </div>
            </div>

            {hasChildren && isExpanded && (
              <div style={{ display: 'flex' }}>
                {/* continuing spine below the card for nested children */}
                <div style={{ width: '18px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '2px', background: isLast ? 'transparent' : colors.connector }} />
                </div>
                <div style={{ flex: 1, paddingLeft: '4px' }}>
                  <VerticalList
                    nodes={node.children}
                    branch={branch}
                    expanded={expanded}
                    onToggle={onToggle}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrgLevel({ nodes, branch, depth, expanded, onToggle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', display: 'flex', gap: `${CARD_GAP}px`, justifyContent: 'center' }}>
        {nodes.length > 1 && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: `${CARD_WIDTH / 2}px`,
            width: `${(nodes.length - 1) * (CARD_WIDTH + CARD_GAP)}px`,
            height: '2px',
            background: BRANCH_COLORS[branch || 'default'].connector,
          }} />
        )}

        {nodes.map(node => {
          const nodeBranch = node.branch || branch;
          const colors = BRANCH_COLORS[nodeBranch || 'default'];
          const hasChildren = node.children && node.children.length > 0;
          const isExpanded = expanded.has(node.id);
          const nextDepth = depth + 1;
          const childrenAreVertical = nextDepth >= VERTICAL_DEPTH;

          return (
            <div key={node.id} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: `${CARD_WIDTH}px`,
            }}>
              <div style={{ width: '2px', height: '24px', background: colors.connector }} />

              <OrgCard
                node={node}
                colors={colors}
                isLeaf={!hasChildren}
                isExpanded={isExpanded}
                onToggle={onToggle}
              />

              {hasChildren && isExpanded && (
                <>
                  <div style={{ width: '2px', height: '16px', background: colors.connector }} />
                  {childrenAreVertical ? (
                    <VerticalList
                      nodes={node.children}
                      branch={nodeBranch}
                      expanded={expanded}
                      onToggle={onToggle}
                    />
                  ) : (
                    <OrgLevel
                      nodes={node.children}
                      branch={nodeBranch}
                      depth={nextDepth}
                      expanded={expanded}
                      onToggle={onToggle}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RootLevel({ node, expanded, onToggle }) {
  const colors = BRANCH_COLORS.default;
  const isExpanded = expanded.has(node.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <OrgCard
        node={node}
        colors={colors}
        isLeaf={false}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
      {isExpanded && node.children && (
        <>
          <div style={{ width: '2px', height: '24px', background: colors.connector }} />
          <OrgLevel
            nodes={node.children}
            branch={null}
            depth={1}
            expanded={expanded}
            onToggle={onToggle}
          />
        </>
      )}
    </div>
  );
}

export default function CorpusBrowser() {
  const [expanded, setExpanded] = useState(
    () => new Set(['root', 'leg', 'exec', 'jud'])
  );

  const toggle = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => {
    const allIds = [];
    const collect = (nodes) => nodes.forEach(n => {
      allIds.push(n.id);
      if (n.children) collect(n.children);
    });
    collect(CORPUS);
    setExpanded(new Set(allIds));
  };

  const collapseAll = () => setExpanded(new Set(['root']));

  return (
    <main style={{ padding: '5rem 2rem 4rem', minWidth: 0 }}>
      <div style={{ maxWidth: '860px', margin: '0 auto 3rem' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.65rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          marginBottom: '0.75rem',
        }}>
          U.S. Federal Government · Document Taxonomy
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          fontWeight: 700,
          color: 'var(--cream)',
          margin: '0 0 1rem',
          lineHeight: 1.15,
        }}>
          Federal Document Corpus
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '0.95rem',
          color: 'var(--text-muted)',
          lineHeight: 1.65,
          maxWidth: '600px',
          marginBottom: '1.5rem',
        }}>
          A hierarchical map of official document types across all three branches of the U.S. federal government. Click any node to expand or collapse its subtree.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { label: 'Expand All', action: expandAll },
            { label: 'Collapse All', action: collapseAll },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                letterSpacing: '0.06em',
                padding: '5px 12px',
                borderRadius: '3px',
                border: '1px solid rgba(201,168,76,0.25)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--gold)';
                e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'rgba(201,168,76,0.25)';
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '2rem' }}>
        <div style={{ minWidth: 'max-content', display: 'flex', justifyContent: 'center', padding: '0 2rem' }}>
          <RootLevel node={CORPUS[0]} expanded={expanded} onToggle={toggle} />
        </div>
      </div>
    </main>
  );
}
