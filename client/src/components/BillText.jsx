import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApolloClient } from '@apollo/client/react';
import { GET_BILL_TEXT_SECTIONS } from '../queries';
import { SectionItems } from './OrderText';
import { renderSpans } from './spans';
import Loading from './Loading';
import { uscPath } from '../usc';

// Sections are fetched this many at a time, as the reader gets near them.
const BATCH = 15;

const CONTAINER_LABEL = {
  division: 'Division', title: 'Title', subtitle: 'Subtitle', chapter: 'Chapter',
  subchapter: 'Subchapter', part: 'Part', subpart: 'Subpart',
};

const CITATION_GROUPS = [
  { label: 'U.S. Code', types: ['usc'] },
  { label: 'Public laws', types: ['public_law'] },
];

// Sections that start folded: a bill's own table of contents is long and repeats the
// contents tree in the rail.
const startsCollapsed = heading => /^table of contents$/i.test((heading ?? '').trim());

// Room held for a section that has not loaded, so the page keeps roughly its final length
// and a jump from the contents list lands in the right place.
const estimatedHeight = chars => Math.max(48, Math.round(chars / 85) * 26 + 40);

/**
 * The text of one stored bill version. `text` is the version without its section text
 * (outline, section index, citations); the sections themselves are loaded in batches
 * when they come within reach of the window. Render with key={packageId}.
 */
export default function BillText({ packageId, text }) {
  const client = useApolloClient();
  const [loaded, setLoaded] = useState({}); // position → section
  const requested = useRef(new Set()); // batch start positions already asked for
  const [folded, setFolded] = useState({}); // section id → true / false, where the reader chose
  const container = useRef(null);

  const load = useCallback(async (position) => {
    const from = Math.floor(position / BATCH) * BATCH;
    if (requested.current.has(from)) return;
    requested.current.add(from);
    try {
      const { data } = await client.query({ query: GET_BILL_TEXT_SECTIONS, variables: { packageId, from, count: BATCH } });
      setLoaded(prev => ({ ...prev, ...Object.fromEntries(data.billTextSections.map(s => [s.position, s])) }));
    } catch {
      requested.current.delete(from); // try again the next time it scrolls into reach
    }
  }, [client, packageId]);

  // Watch the sections still waiting for their text.
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) load(Number(entry.target.dataset.position));
      }
    }, { rootMargin: '1200px 0px' });
    container.current?.querySelectorAll('section[data-pending]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [loaded, load]);

  const index = Object.fromEntries(text.section_index.map(entry => [entry.id, entry]));

  const renderOutline = (nodes, depth) => nodes.map(node => {
    if (node.type !== 'section') {
      return (
        <div key={node.id} className={node.changed ? `bill-part changed-${node.changed}` : 'bill-part'}>
          <p id={node.id} className={`container-heading depth-${Math.min(depth, 3)}`}>
            <span>{CONTAINER_LABEL[node.type] ?? node.type} {node.number}</span>
            {node.heading}
          </p>
          {renderOutline(node.children, depth + 1)}
        </div>
      );
    }
    const entry = index[node.id];
    const section = loaded[entry.position];
    const collapsed = folded[node.id] ?? startsCollapsed(node.heading);
    return (
      <section
        key={node.id}
        id={node.id}
        data-position={entry.position}
        // A folded section is not fetched until it is opened.
        data-pending={section || collapsed ? undefined : ''}
        className={[entry.changed && `changed-${entry.changed}`, collapsed && 'collapsed'].filter(Boolean).join(' ') || undefined}
      >
        <button
          type="button"
          className="sec-toggle"
          aria-expanded={!collapsed}
          onClick={() => setFolded(prev => ({ ...prev, [node.id]: !collapsed }))}
        >
          {/* A resolution's text is often one unnumbered, untitled section: "Resolved, That …" */}
          <span className="sec-label">{node.number ? `Section ${node.number}` : node.heading ? 'Section' : 'Resolved'}</span>
          {node.heading && <span className="sec-heading">{node.heading}</span>}
        </button>
        {!collapsed && (section
          ? <SectionItems items={section.items} sectionId={node.id} />
          : <div className="pending" style={{ minHeight: estimatedHeight(entry.chars) }}><Loading small /></div>)}
      </section>
    );
  });

  const citationGroups = CITATION_GROUPS
    .map(group => ({ ...group, items: text.citations.filter(c => group.types.includes(c.type) && c.href) }))
    .filter(group => group.items.length > 0);

  return (
    <div className="eo-doc bill-doc" ref={container}>
      {text.version?.amendment_instruction && (
        <p className="amendment-note">Senate amendment: {text.version.amendment_instruction}</p>
      )}

      {/* A resolution's "Whereas …" clauses */}
      {text.preamble?.length > 0 && (
        <div className="preamble">
          {text.preamble.map((p, i) => <p key={i}>{renderSpans(p.text, p.spans)}</p>)}
        </div>
      )}

      {renderOutline(text.outline, 0)}

      {citationGroups.length > 0 && (
        <details className="panel">
          <summary>Cited in this bill ({text.citations.length})</summary>
          {citationGroups.map(group => (
            <div key={group.label}>
              <h4>{group.label}</h4>
              <div className="chips">
                {group.items.map(c => (uscPath(c)
                  // A Code section: its page here
                  ? <Link key={c.href} className="chip" to={uscPath(c)}>{c.labels[0]}</Link>
                  : <a key={c.href} className="chip" href={c.href} target="_blank" rel="noopener noreferrer">{c.labels[0]}</a>
                ))}
              </div>
            </div>
          ))}
        </details>
      )}

      <footer className="source">
        Text from the bill XML published by the Government Publishing Office, package{' '}
        <a href={`https://www.govinfo.gov/app/details/${packageId}`} target="_blank" rel="noopener noreferrer">{packageId}</a>.
        The wording is unchanged; indentation and quotation blocks were added for readability.
      </footer>
    </div>
  );
}
