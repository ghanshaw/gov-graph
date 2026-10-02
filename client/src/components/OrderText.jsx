const CITATION_GROUPS = [
  { label: 'Executive orders', types: ['executive_order'] },
  { label: 'Statutes', types: ['usc', 'public_law', 'statute'] },
  { label: 'Regulations', types: ['cfr'] },
  { label: 'Federal Register', types: ['federal_register'] },
  { label: 'Other', types: ['link'] },
];

// Item text is stored plain, with spans marking character ranges (citations, emphasis,
// deadlines, defined terms). Overlapping spans are not expected; a later one is dropped.
// `from` skips a leading part of the text that is rendered separately (a list marker).
function renderSpans(text, spans = [], from = 0) {
  const out = [];
  let pos = from;
  [...spans].sort((a, b) => a.start - b.start).forEach((span, i) => {
    if (span.start < pos) return;
    if (span.start > pos) out.push(text.slice(pos, span.start));
    const inner = text.slice(span.start, span.end);
    if (span.type === 'citation') {
      out.push(
        <a key={i} className="cite" href={span.href} target="_blank" rel="noopener noreferrer">{inner}</a>
      );
    } else if (span.type === 'emphasis') {
      out.push(<em key={i}>{inner}</em>);
    } else if (span.type === 'deadline') {
      out.push(<span key={i} className="deadline">{inner}</span>);
    } else if (span.type === 'defined_term') {
      out.push(<dfn key={i}>{inner}</dfn>);
    } else {
      out.push(inner);
    }
    pos = span.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

function Item({ item, sectionId }) {
  if (!item.marker) return <p>{renderSpans(item.text, item.spans)}</p>;
  return (
    <div
      className="item"
      // Only first-level markers are unique within a section.
      id={item.level === 1 ? `${sectionId}-${item.marker.replace(/\.$/, '')}` : undefined}
      // Indentation per level is set in index.css (.eo-doc .item).
      style={item.level > 1 ? { '--level': item.level } : undefined}
    >
      {/* Numbered lists keep their period ("1."); every other marker is printed in parentheses. */}
      <span className="marker">{item.marker.endsWith('.') ? item.marker : `(${item.marker})`}</span>
      {/* "(c)(i) …" in the source: (c) has no text of its own */}
      <p>{renderSpans(item.text, item.spans)}</p>
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

function SectionItems({ items, sectionId }) {
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
          <h3>Cited in this order</h3>
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
            ? 'Text from the Compilation of Presidential Documents (the Federal Register has no structured text for this order); see Federal Register document'
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
