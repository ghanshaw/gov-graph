import { renderSpans } from './spans';

const CITATION_GROUPS = [
  { label: 'Executive orders', types: ['executive_order'] },
  { label: 'Statutes', types: ['usc', 'public_law', 'statute'] },
  { label: 'Regulations', types: ['cfr'] },
  { label: 'Federal Register', types: ['federal_register'] },
  { label: 'Other', types: ['link'] },
];

// A table printed in the document (bills): header rows, then body rows.
function ItemTable({ item }) {
  return (
    <table className="doc-table" style={item.level > 0 ? { '--level': item.level + 1 } : undefined}>
      {item.head?.length > 0 && (
        <thead>{item.head.map((row, r) => <tr key={r}>{row.map((cell, c) => <th key={c}>{cell}</th>)}</tr>)}</thead>
      )}
      <tbody>{item.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}</tbody>
    </table>
  );
}

// A table of contents printed in the document (bills). Entries link to the headings they name.
function ItemToc({ item }) {
  return (
    <ol className="doc-toc">
      {item.entries.map((entry, i) => (
        <li key={i} className={entry.kind === 'section' ? undefined : 'container'} style={{ '--depth': entry.depth }}>
          {entry.target ? <a href={`#${entry.target}`}>{entry.text}</a> : entry.text}
        </li>
      ))}
    </ol>
  );
}

function Item({ item, sectionId }) {
  if (item.type === 'table') return <ItemTable item={item} />;
  if (item.type === 'toc') return <ItemToc item={item} />;
  if (item.bullet) return <p className="bullet">{renderSpans(item.text, item.spans)}</p>;
  // A heading printed inside a note or quotation (U.S. Code): a section of another law set out in full.
  if (item.subheading) return <p className="sub-heading">{renderSpans(item.text, item.spans)}</p>;
  // `changed` (bills): text a reported version strikes out or inserts.
  const changed = item.changed ? ` changed-${item.changed}` : '';
  // Reports: one of the body's recommendations, set apart as the report prints it in bold.
  if (item.recommendation) {
    return (
      <p className="recommendation" id={item.anchor}>
        <span className="item-heading">Recommendation:</span> {renderSpans(item.text, item.spans)}
      </p>
    );
  }
  // Reports: a heading that opens the paragraph ("Boston: American 11 and United 175. Atta and …").
  if (item.run_in) {
    return <p><span className="item-heading">{item.run_in}</span> {renderSpans(item.text, item.spans)}</p>;
  }
  // Reports: a paragraph printed as lines (lists of witnesses).
  if (item.lines) return <p className="lines">{renderSpans(item.text, item.spans)}</p>;
  if (!item.marker) {
    // Text that resumes after sub-items sits at the depth of the provision it continues.
    return (
      <p
        // `align` (court opinions): a closing line set to the right, "It is so ordered."
        className={`${item.continuation ? 'continuation' : ''}${item.align === 'right' ? ' closing-line' : ''}${changed}`.trim() || undefined}
        style={item.continuation && item.level > 0 ? { '--level': item.level } : undefined}
      >
        {renderSpans(item.text, item.spans)}
      </p>
    );
  }
  return (
    <div
      className={`item${changed}`}
      // The U.S. Code gives every provision its own address ("b-1"); elsewhere only
      // first-level markers are unique within a section.
      id={item.anchor ?? (item.level === 1 ? `${sectionId}-${item.marker.replace(/\.$/, '')}` : undefined)}
      // Indentation per level is set in index.css (.eo-doc .item).
      style={item.level > 1 ? { '--level': item.level } : undefined}
    >
      {/* Numbered lists keep their period ("1."); every other marker is printed in parentheses. */}
      <span className="marker">{item.marker.endsWith('.') ? item.marker : `(${item.marker})`}</span>
      {/* "(c)(i) …" in the source: (c) has no text of its own */}
      <p>
        {/* Bills give sub-items their own headings: "(a) In general.—The Secretary…". The
            U.S. Code prints the heading as a line of its own (`heading_break`). */}
        {item.heading && (item.heading_break
          ? <span className="item-heading line">{item.heading}</span>
          : <span className="item-heading">{item.heading}.{item.text ? '—' : ''}</span>)}
        {renderSpans(item.text, item.spans)}
      </p>
    </div>
  );
}

// Amending orders set out replacement text as a run of paragraphs that each open with a
// quotation mark. A run is shown as one block, lined up with the text that introduces it.
function QuotedBlock({ items, after }) {
  const afterItem = Boolean(after?.marker);
  return (
    <blockquote className={afterItem ? 'quoted after-item' : 'quoted'} style={afterItem ? { '--level': after.level } : undefined}>
      {items.map((item, i) => {
        if (item.type === 'table') return <ItemTable key={i} item={{ ...item, level: 0 }} />;
        if (item.type === 'toc') return <ItemToc key={i} item={item} />;
        const style = item.quote_level > 1 ? { marginLeft: `${(item.quote_level - 1) * 24}px` } : undefined;
        // The marker is part of the quoted text ("“(i) Open …", "1. The contractor …");
        // it is set in its own column so the lines of the item align.
        const markerEnd = item.quote_marker ? item.text.indexOf(item.quote_marker) : -1;
        if (markerEnd === -1 || markerEnd > 2) return <p key={i} style={style}>{renderSpans(item.text, item.spans)}</p>;
        const bodyStart = markerEnd + item.quote_marker.length;
        const rest = item.text.slice(bodyStart);
        return (
          <div key={i} className="quoted-item" style={style}>
            <span className="marker">{item.text.slice(0, bodyStart)}</span>
            <p>{renderSpans(item.text, item.spans, bodyStart + (rest.length - rest.trimStart().length))}</p>
          </div>
        );
      })}
    </blockquote>
  );
}

export function SectionItems({ items, sectionId }) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    if (!items[i].quoted) {
      out.push(<Item key={i} item={items[i]} sectionId={sectionId} />);
      continue;
    }
    const start = i;
    while (items[i + 1]?.quoted) i++;
    out.push(<QuotedBlock key={start} items={items.slice(start, i + 1)} after={items[start - 1]} />);
  }
  return out;
}

export default function OrderText({ structure }) {
  const {
    preamble = [], sections = [], signature, citations = [],
    publication, source, govinfo, end_matter: endMatter, attachments = [],
  } = structure;
  // "order" in the labels below, unless this is another kind of document.
  const kind = structure.doc_type === 'memorandum' ? 'memorandum' : 'order';

  const citationGroups = CITATION_GROUPS
    .map(group => ({ ...group, items: citations.filter(c => group.types.includes(c.type)) }))
    .filter(group => group.items.length > 0);

  return (
    <div className="eo-doc">
      {preamble.length > 0 && (
        <div className="preamble">
          {preamble.map((p, i) => <p key={i}>{renderSpans(p.text, p.spans)}</p>)}
        </div>
      )}

      {sections.map(section => (
        <section key={section.id} id={section.id}>
          {section.part && <p className="part-heading">{section.part}</p>}
          {section.number != null && <p className="sec-label">Section {section.number}</p>}
          {section.title && <h2>{section.title}</h2>}
          <SectionItems items={section.items} sectionId={section.id} />
        </section>
      ))}

      {signature && (
        <div className="signature">
          <p className="name">{signature.name}</p>
          {signature.place && <p className="place">{signature.place.toLowerCase()}</p>}
          {signature.date && <p>{signature.date}</p>}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="attachments">
          <p className="sec-label">Annexes and printed tables</p>
          {attachments.map((a, i) => (
            <img key={i} src={a.src} alt={`Printed page image ${i + 1} of ${attachments.length}`} loading="lazy" />
          ))}
        </div>
      )}

      {citationGroups.length > 0 && (
        <div className="panel">
          <h3>Cited in this {kind}</h3>
          {citationGroups.map(group => (
            <div key={group.label}>
              <h4>{group.label}</h4>
              <div className="chips">
                {group.items.map(c => (
                  <a key={c.href} className="chip" href={c.href} target="_blank" rel="noopener noreferrer">{c.labels[0]}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {source?.html_url && (
        <footer className="source">
          {source.name === 'govinfo'
            ? 'Text from the Compilation of Presidential Documents (the Federal Register has no structured text for this document); see Federal Register document'
            : 'Text from the Federal Register, document'}{' '}
          <a href={source.html_url} target="_blank" rel="noopener noreferrer">
            {publication?.document_number ?? 'source'}
          </a>
          {publication?.citation && ` (${[publication.citation, endMatter?.filed?.replace(/^Filed/, 'filed')].filter(Boolean).join('; ')})`}.
          {govinfo?.details_url && (
            <>
              {' '}Also available in the{' '}
              <a href={govinfo.details_url} target="_blank" rel="noopener noreferrer">Compilation of Presidential Documents</a>
              {' '}on govinfo.
            </>
          )}
          {' '}The wording is unchanged; headings, indentation and highlighted deadlines were added for readability.
        </footer>
      )}
    </div>
  );
}
