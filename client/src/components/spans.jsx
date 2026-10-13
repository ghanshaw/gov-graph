import { Link } from 'react-router-dom';
import { uscPath } from '../usc';

// Item text is stored plain, with spans marking character ranges (citations, emphasis,
// deadlines, defined terms, footnote calls). Overlapping spans are not expected; a later one is dropped.
// `from` skips a leading part of the text that is rendered separately (a list marker).
export function renderSpans(text, spans = [], from = 0) {
  const out = [];
  let pos = from;
  [...spans].sort((a, b) => a.start - b.start).forEach((span, i) => {
    if (span.start < pos) return;
    if (span.start > pos) out.push(text.slice(pos, span.start));
    const inner = text.slice(span.start, span.end);
    if (span.type === 'citation' && uscPath(span.target)) {
      // A section of the U.S. Code: its page here (/code/10/1074c), not an outside site.
      out.push(<Link key={i} className="cite" to={uscPath(span.target)}>{inner}</Link>);
    } else if (span.type === 'citation') {
      out.push(
        <a key={i} className="cite" href={span.href} target="_blank" rel="noopener noreferrer">{inner}</a>
      );
    } else if (span.type === 'footnote_ref') {
      // Where a footnote is called (court opinions). The span has no length: the number
      // is not part of the text. The footnote links back to this mark.
      out.push(
        <sup key={i} className="fn-ref"><a id={`${span.target}-ref`} href={`#${span.target}`}>{span.number}</a></sup>
      );
    } else if (span.type === 'emphasis') {
      out.push(<em key={i}>{inner}</em>);
    } else if (span.type === 'strong') {
      // Bold the publisher set inside a sentence (names in the 9/11 Commission's notes).
      out.push(<strong key={i}>{inner}</strong>);
    } else if (span.type === 'deadline') {
      out.push(<span key={i} className="deadline">{inner}</span>);
    } else if (span.type === 'defined_term') {
      out.push(<dfn key={i}>{inner}</dfn>);
    } else if (span.type === 'deleted') {
      // Amendment markup inside a sentence (reported bills)
      out.push(<del key={i}>{inner}</del>);
    } else if (span.type === 'inserted') {
      out.push(<ins key={i}>{inner}</ins>);
    } else {
      out.push(inner);
    }
    pos = span.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}
