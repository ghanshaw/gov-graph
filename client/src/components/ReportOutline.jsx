import { useEffect, useMemo, useRef, useState } from 'react';

// The contents list for the rail of a report page: each part (chapter, appendix), with its
// numbered sections beneath it. It is rendered together with the text (ReportText), whose parts and
// sections it watches; `watch` changes when more of the text has loaded. With `onPick` (the PDF is
// shown without the text), an entry opens its part's PDF instead. Laid out like OpinionOutline.
export default function ReportOutline({ structure, watch, onPick }) {
  const [active, setActive] = useState(null);
  const [picked, setPicked] = useState(null);
  // Only matters on narrow windows, where the rail sits above the text (index.css).
  const [open, setOpen] = useState(false);

  const entries = useMemo(() => structure.parts.flatMap(part => [
    { id: part.id, part, depth: 0, text: part.kind === 'chapter' ? `${part.number}. ${part.title}` : part.label === part.title ? part.title : `${part.label}: ${part.title}` },
    ...part.sections
      .filter(s => s.heading)
      .map(s => ({ id: s.id, part, depth: 1, number: s.number, text: s.heading })),
  ]), [structure]);

  // − and + step the list between parts only and every section.
  const [level, setLevel] = useState(0);
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

  const visible = entries.filter(e => e.depth <= level);
  const at = entries.findIndex(e => e.id === (onPick ? picked : active));
  const current = at === -1 ? visible[0] : entries.slice(0, at + 1).findLast(e => e.depth <= level);
  const pick = onPick && ((event, entry) => {
    event.preventDefault();
    setPicked(entry.part.id);
    onPick(entry.part);
  });

  // Keep the entry being read in view inside the list's own scroll area.
  useEffect(() => {
    const box = scroller.current;
    const link = box?.querySelector('a.on');
    if (!link) return;
    const offset = link.getBoundingClientRect().top - box.getBoundingClientRect().top;
    if (offset < 0 || offset > box.clientHeight - 60) box.scrollTop += offset - box.clientHeight / 3;
  }, [current?.id, level]);

  return (
    <nav className="group rail-outline" aria-label="Contents">
      <div className="toc-head">
        <button type="button" className="toc-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          Contents
        </button>
        <span className="toc-levels">
          <button type="button" aria-label="Show parts only" title="Show parts only" disabled={level === 0} onClick={() => setLevel(0)}>−</button>
          <button type="button" aria-label="Show sections" title="Show sections" disabled={level === 1} onClick={() => setLevel(1)}>+</button>
        </span>
      </div>
      <div ref={scroller} className={open ? 'toc-scroll' : 'toc-scroll collapsed'}>
        <ol className="toc tree">
          {visible.map(entry => {
            const on = entry.id === current?.id ? ' on' : '';
            return (
              <li key={entry.id} style={{ '--depth': Math.max(0, entry.depth - 1) }}>
                {entry.depth === 0 ? (
                  <a href={`#${entry.id}`} className={`toc-writing${on}`} onClick={pick && (e => pick(e, entry))}>{entry.text}</a>
                ) : (
                  <a href={`#${entry.id}`} className={on.trim() || undefined} onClick={pick && (e => pick(e, entry))}>
                    {entry.number && <span className="toc-num">{entry.number}</span>}
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
