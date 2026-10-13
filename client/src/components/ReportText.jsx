import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_REPORT_PART } from '../queries';
import { SectionItems } from './OrderText';
import Loading from './Loading';

// The text of a report (ReportDetail.jsx), part by part. Every part and section heading is laid out
// from the outline straight away, so the contents list and links have somewhere to point; a part's
// text is fetched when it comes within reach. Endnotes are printed after their chapter.

// Boxed passages (the report's sidebars) are runs of items with the same `box` number.
function Items({ items, sectionId }) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    if (!items[i].box) {
      const start = i;
      while (i + 1 < items.length && !items[i + 1].box) i++;
      out.push(<SectionItems key={start} items={items.slice(start, i + 1)} sectionId={sectionId} />);
      continue;
    }
    const start = i;
    while (items[i + 1]?.box === items[start].box) i++;
    out.push(
      <aside key={start} className="report-box">
        <SectionItems items={items.slice(start, i + 1)} sectionId={`${sectionId}-box${items[start].box}`} />
      </aside>
    );
  }
  return out;
}

/** True once the element has come within a few screens of the viewport. */
function useNear(ref) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near || !ref.current) return undefined;
    const observer = new IntersectionObserver(found => {
      if (found.some(e => e.isIntersecting)) setNear(true);
    }, { rootMargin: '1500px 0px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near, ref]);
  return near;
}

function Part({ slug, part, onLoaded }) {
  const ref = useRef(null);
  const near = useNear(ref);
  // A link to somewhere in this part (a recommendation, a note) loads it at once.
  const wanted = typeof window !== 'undefined' && window.location.hash.slice(1).startsWith(`${part.id}-`);
  const { data, error } = useQuery(GET_REPORT_PART, { variables: { slug, partId: part.id }, skip: !near && !wanted });
  const text = data?.reportPart;

  useEffect(() => {
    if (!text) return;
    onLoaded?.(part.id);
    const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (target && ref.current?.contains(target)) target.scrollIntoView();
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = new Map((text?.sections ?? []).map(s => [s.id, s.items]));
  return (
    <div className="writing report-part" id={part.id} ref={ref}>
      <div className="writing-heading">
        <span>{part.label}</span>
        {part.kind === 'chapter' || part.kind === 'appendix' ? part.title : null}
      </div>
      {part.note && <p className="byline">{part.note}</p>}
      {error && <p className="error">Could not load this part: {error.message}</p>}

      {part.sections.map(section => (
        <section key={section.id} id={section.id} className="report-section">
          {section.heading && (
            <h2>
              {section.number && <span className="sec-num">{section.number}</span>}
              {section.heading}
            </h2>
          )}
          {text
            ? <Items items={items.get(section.id) ?? []} sectionId={section.id} />
            : <div className="pending"><Loading small /></div>}
        </section>
      ))}

      {text?.notes?.length > 0 && (
        <div className="footnotes">
          <p className="sec-label">Notes to {part.label.toLowerCase()}</p>
          {text.notes.map(note => (
            <div key={note.id} id={note.id} className="footnote">
              <a className="marker" href={`#${note.id}-ref`} title="Back to the text">{note.number}</a>
              <div><SectionItems items={note.items} sectionId={note.id} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Keeps the place a link points to (#ch12-rec-1) in view while the parts around it load and change
 * the page's height, until the reader scrolls themselves.
 */
function useHoldTarget(box) {
  useEffect(() => {
    if (!box.current) return undefined;
    let held = Boolean(window.location.hash);
    const hold = () => {
      const target = held && document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView();
    };
    const release = () => { held = false; };
    const onHash = () => { held = true; hold(); };
    const observer = new ResizeObserver(hold);
    observer.observe(box.current);
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    events.forEach(e => window.addEventListener(e, release, { passive: true }));
    window.addEventListener('hashchange', onHash);
    return () => {
      observer.disconnect();
      events.forEach(e => window.removeEventListener(e, release));
      window.removeEventListener('hashchange', onHash);
    };
  }, [box]);
}

export default function ReportText({ slug, structure, onLoaded }) {
  const { source } = structure;
  const box = useRef(null);
  useHoldTarget(box);
  return (
    <div className="eo-doc opinion-doc report-doc" ref={box}>
      {structure.parts.map(part => <Part key={part.id} slug={slug} part={part} onLoaded={onLoaded} />)}
      <footer className="source">
        Text read from {source.text_url ? <a href={source.text_url} target="_blank" rel="noopener noreferrer">{source.text_from}</a> : source.text_from};
        the printed pages are {source.pdf_url ? <a href={source.pdf_url} target="_blank" rel="noopener noreferrer">{source.pdf_from}</a> : source.pdf_from}.
        The wording is as the HTML prints it, including its slips (hyphens where the book has dashes). Endnotes are printed
        after their chapter, boxed passages are set apart, and section numbers, links and the numbering of the
        recommendations (the Commission did not number them) were added for reading.
      </footer>
    </div>
  );
}
