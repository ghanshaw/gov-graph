import { useState, useCallback } from 'react';
import PageLayout from '../components/PageLayout';
import { RailGroup } from '../components/Rail';

// Colours come from the branch a node belongs to: the class sets --branch and
// --branch-soft (index.css), which the cards, rows and connecting lines use.
const branchClass = branch => `branch-${branch || 'default'}`;

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

function OrgCard({ node, branch, isLeaf, isExpanded, onToggle, compact }) {
  const caret = !isLeaf && <span className="org-caret">{isExpanded ? '▾' : '▸'}</span>;

  if (compact) {
    // Vertical list row style for depth >= VERTICAL_DEPTH
    return (
      <div
        className={`org-row ${branchClass(branch)}${isLeaf ? ' leaf' : ''}`}
        onClick={isLeaf ? undefined : () => onToggle(node.id)}
      >
        <span className="org-dot" />
        <span className="org-label">{node.label}</span>
        {node.abbr && <span className="org-abbr">{node.abbr}</span>}
        {caret}
      </div>
    );
  }

  return (
    <div
      className={`org-card ${branchClass(branch)}${isLeaf ? ' leaf' : ''}`}
      onClick={isLeaf ? undefined : () => onToggle(node.id)}
      style={{ width: `${CARD_WIDTH}px` }}
    >
      <div className="org-card-head">{node.label}</div>

      {(node.abbr || node.desc) && (
        <div className="org-card-body">
          {node.abbr && <span className="org-abbr">{node.abbr}</span>}
          {node.desc && <div className="org-desc">{node.desc}</div>}
        </div>
      )}

      {caret}
    </div>
  );
}

// Compact vertical list rendered at depth >= VERTICAL_DEPTH
function VerticalList({ nodes, branch, expanded, onToggle }) {
  const line = `org-line ${branchClass(branch)}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: `${CARD_WIDTH}px` }}>
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
                <div className={line} style={{ width: '2px', height: '13px' }} />
                {/* elbow: horizontal branch */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className={line} style={{ width: '2px', height: '2px' }} />
                  <div className={line} style={{ width: '14px', height: '2px' }} />
                </div>
                {/* bottom half of vertical spine (hidden for last item) */}
                <div className={isLast ? undefined : line} style={{ width: '2px', flexGrow: 1 }} />
              </div>

              <div style={{ flex: 1, minWidth: 0, paddingBottom: '3px' }}>
                <OrgCard
                  node={node}
                  branch={branch}
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
                  <div className={isLast ? undefined : line} style={{ width: '2px' }} />
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
  const bar = `org-line ${branchClass(branch)}`;
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      {nodes.map((node, i) => {
        const nodeBranch = node.branch || branch;
        const line = `org-line ${branchClass(nodeBranch)}`;
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expanded.has(node.id);
        const nextDepth = depth + 1;
        const childrenAreVertical = nextDepth >= VERTICAL_DEPTH;

        return (
          // A column is as wide as its subtree, so neighbouring subtrees never overlap.
          <div key={node.id} style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: `0 ${CARD_GAP / 2}px`,
          }}>
            {/* The bar joining siblings, drawn as a half above each column so it runs
                from the first column's centre to the last one's. */}
            {i > 0 && <div className={bar} style={{ position: 'absolute', top: 0, left: 0, right: '50%', height: '2px' }} />}
            {i < nodes.length - 1 && <div className={bar} style={{ position: 'absolute', top: 0, left: '50%', right: 0, height: '2px' }} />}

            <div className={line} style={{ width: '2px', height: '24px' }} />

            <OrgCard
              node={node}
              branch={nodeBranch}
              isLeaf={!hasChildren}
              isExpanded={isExpanded}
              onToggle={onToggle}
            />

            {hasChildren && isExpanded && (
              <>
                <div className={line} style={{ width: '2px', height: '16px' }} />
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
  );
}

function RootLevel({ node, expanded, onToggle }) {
  const isExpanded = expanded.has(node.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <OrgCard
        node={node}
        branch={null}
        isLeaf={false}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
      {isExpanded && node.children && (
        <>
          <div className={`org-line ${branchClass(null)}`} style={{ width: '2px', height: '24px' }} />
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

// Document types (the leaves of the tree) under a node.
function countLeaves(node) {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
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

  const root = CORPUS[0];

  const rail = (
    <>
      <RailGroup title="Document types">
        {root.children.map(branch => (
          <div key={branch.id} className="fact">
            <span className={`chip ${branch.branch}`}>{branch.label}</span>
            <b>{countLeaves(branch)}</b>
          </div>
        ))}
      </RailGroup>
      <RailGroup title="Tree">
        <div className="rail-buttons">
          <button type="button" className="btn small" onClick={expandAll}>Expand all</button>
          <button type="button" className="btn small" onClick={collapseAll}>Collapse all</button>
        </div>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      <div className="crumbs">U.S. Federal Government · Document Taxonomy</div>
      <div className="page-head">
        <h1 className="page-title">Federal Document Corpus <small>{countLeaves(root)} document types</small></h1>
      </div>
      <p className="lede">
        A hierarchical map of official document types across all three branches of the U.S. federal government. Click any node to expand or collapse its subtree.
      </p>

      <div className="org-scroll">
        <div className="org-tree">
          <RootLevel node={root} expanded={expanded} onToggle={toggle} />
        </div>
      </div>
    </PageLayout>
  );
}
