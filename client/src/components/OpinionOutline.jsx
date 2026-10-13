import { useEffect, useMemo, useRef, useState } from 'react';

// The contents list for the rail of the case page: the syllabus and each opinion, with the
// opinion's parts (II, A, 1, a) indented beneath it. Every entry is a link. The parts have
// no titles, so each shows its opening words. It must be rendered together with the text
// (OpinionText), whose parts it watches; `watch` changes when more of the text has loaded.
// With `onPick` (the PDF is shown without the text), an entry opens its printed page instead.
export default function OpinionOutline({ structure, watch, onPick }) {
  const [active, setActive] = useState(null);
  const [picked, setPicked] = useState(null);
  // Only matters on narrow windows, where the rail sits above the text (index.css).
  const [open, setOpen] = useState(false);

  const entries = useMemo(() => [
    ...(structure.syllabus ? [{ id: 'syllabus', depth: 0, text: 'Syllabus', pdfPage: structure.syllabus.pdf_page }] : []),
    ...structure.opinions.flatMap(opinion => [
      // Links to the opinion's heading; watches the text under it (what comes before part I).
      {
        id: opinion.outline[0]?.path.length === 0 ? opinion.outline[0].id : `${opinion.id}-writing`,
        to: `${opinion.id}-writing`,
        depth: 0,
        text: opinion.label,
        pdfPage: opinion.pdf_page,
      },
      ...opinion.outline
        .filter((part, i) => i > 0 || part.path.length > 0)
        .map(part => ({ id: part.id, depth: part.level, number: part.path.at(-1) ?? '*', text: part.opening, pdfPage: part.pdf_page })),
    ]),
  ], [structure]);

  // The − and + beside "Contents" step the list one level at a time: at 0 only the
  // writings show, at `levels` every part does.
  const levels = useMemo(() => Math.max(...entries.map(e => e.depth)), [entries]);
  const [level, setLevel] = useState(null);
  const shown = level ?? levels;
  const scroller = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(found => {
      for (const entry of found) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    }, { rootMargin: '-10% 0px -75% 0px' });
    entries.forEach(e => {
      const el = document.getElementById(e.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [entries, watch]);

  // With the list stepped in, the part being read may be hidden; mark the entry above it.
  const visible = entries.filter(e => e.depth <= shown);
  const at = entries.findIndex(e => e.id === (onPick ? picked : active));
  const pick = onPick && ((event, entry) => {
    event.preventDefault();
    setPicked(entry.id);
    onPick(entry);
  });
  const current = at === -1 ? visible[0] : entries.slice(0, at + 1).findLast(e => e.depth <= shown);

  // Keep the entry being read in view inside the list's own scroll area.
  useEffect(() => {
    const box = scroller.current;
    const link = box?.querySelector('a.on');
    if (!link) return;
    const offset = link.getBoundingClientRect().top - box.getBoundingClientRect().top;
    if (offset < 0 || offset > box.clientHeight - 60) box.scrollTop += offset - box.clientHeight / 3;
  }, [current?.id, shown]);

  return (
    <nav className="group rail-outline" aria-label="Contents">
      <div className="toc-head">
        <button type="button" className="toc-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          Contents
        </button>
        {levels > 0 && (
          <span className="toc-levels">
            <button type="button" aria-label="Show one level less" title="Show one level less" disabled={shown === 0} onClick={() => setLevel(shown - 1)}>−</button>
            <button type="button" aria-label="Show one level more" title="Show one level more" disabled={shown === levels} onClick={() => setLevel(shown + 1)}>+</button>
          </span>
        )}
      </div>
      <div ref={scroller} className={open ? 'toc-scroll' : 'toc-scroll collapsed'}>
        <ol className="toc tree">
          {visible.map(entry => {
            const on = entry.id === current?.id ? ' on' : '';
            return (
              <li key={entry.id} style={{ '--depth': Math.max(0, entry.depth - 1) }}>
                {entry.depth === 0 ? (
                  <a href={`#${entry.to ?? entry.id}`} className={`toc-writing${on}`} onClick={pick && (e => pick(e, entry))}>{entry.text}</a>
                ) : (
                  <a href={`#${entry.id}`} className={on.trim() || undefined} onClick={pick && (e => pick(e, entry))}>
                    <span className="toc-num">{entry.number}</span>
                    <span className="toc-opening">{entry.text}</span>
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
