import { useEffect, useMemo, useRef, useState } from 'react';

// Every container (title, subtitle, …) above each section, so the tree can open to it.
function ancestors(outline) {
  const map = {};
  const walk = (nodes, path) => nodes.forEach(node => {
    if (node.type === 'section') map[node.id] = path;
    else walk(node.children, [...path, node.id]);
  });
  walk(outline, []);
  return map;
}

// How many levels of containers the outline nests: 0 for a bill of sections only,
// 2 for titles holding subtitles, and so on.
function containerLevels(nodes) {
  return nodes.reduce((max, node) => (node.type === 'section' ? max : Math.max(max, 1 + containerLevels(node.children))), 0);
}

// The contents tree for the rail of the bill page: titles and subtitles fold, sections
// are the leaves. It scrolls in its own box, closed off by a rule so its end is clear. It must be rendered together with the text (BillText), whose sections
// it watches to mark the one being read.
export default function BillOutline({ outline }) {
  const [active, setActive] = useState(null);
  const [opened, setOpened] = useState({}); // container id → true / false, where the reader chose
  // Only matters on narrow windows, where the rail sits above the text (index.css).
  const [open, setOpen] = useState(false);

  const parents = useMemo(() => ancestors(outline), [outline]);
  // The − and + beside "Contents" step the whole tree one level at a time: at 0 only the
  // top entries show, at `levels` everything down to the sections does.
  const levels = useMemo(() => containerLevels(outline), [outline]);
  const [level, setLevel] = useState(null);
  const shown = level ?? levels;
  const step = by => {
    setLevel(Math.min(levels, Math.max(0, shown + by)));
    setOpened({}); // the tree is uniform again after a step
  };
  const scroller = useRef(null);

  // Keep the entry being read in view inside the tree's own scroll area.
  useEffect(() => {
    const box = scroller.current;
    // With the tree stepped in, the section's own entry is hidden; follow its nearest heading.
    const link = box?.querySelector('a.on') ?? [...(box?.querySelectorAll('.toc-branch.on') ?? [])].at(-1);
    if (!link) return;
    const offset = link.getBoundingClientRect().top - box.getBoundingClientRect().top;
    if (offset < 0 || offset > box.clientHeight - 60) box.scrollTop += offset - box.clientHeight / 3;
  }, [active, shown]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    }, { rootMargin: '-10% 0px -75% 0px' });
    Object.keys(parents).forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [parents]);

  // The whole outline is laid out from the start, so it can be scrolled end to end.
  // A title or subtitle is open down to the chosen level, unless the reader folded or
  // opened it by hand.
  const activePath = parents[active] ?? [];
  const isOpen = (id, depth) => opened[id] ?? depth < shown;

  // Depth only sets the indent (index.css); the tree has one rule down its left edge.
  const renderNodes = (nodes, depth = 0) => (
    <ol className="toc tree" style={{ '--depth': depth }}>
      {nodes.map(node => (
        <li key={node.id}>
          {node.type === 'section' ? (
            <a href={`#${node.id}`} className={active === node.id ? 'on' : undefined}>
              <span className="toc-num">{node.number}</span>
              <span>{node.heading ?? (node.number ? `Section ${node.number}` : 'Resolved')}</span>
            </a>
          ) : (
            <>
              <button
                type="button"
                className={activePath.includes(node.id) ? 'toc-branch on' : 'toc-branch'}
                aria-expanded={isOpen(node.id, depth)}
                onClick={() => setOpened(prev => ({ ...prev, [node.id]: !isOpen(node.id, depth) }))}
              >
                <span className="toc-num">{node.number}</span>
                <span>{node.heading ?? node.type}</span>
              </button>
              {isOpen(node.id, depth) && renderNodes(node.children, depth + 1)}
            </>
          )}
        </li>
      ))}
    </ol>
  );

  return (
    <nav className="group rail-outline" aria-label="Contents">
      <div className="toc-head">
        <button type="button" className="toc-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          Contents
        </button>
        {levels > 0 && (
          <span className="toc-levels">
            <button type="button" aria-label="Show one level less" title="Show one level less" disabled={shown === 0} onClick={() => step(-1)}>−</button>
            <button type="button" aria-label="Show one level more" title="Show one level more" disabled={shown === levels} onClick={() => step(1)}>+</button>
          </span>
        )}
      </div>
      <div ref={scroller} className={open ? 'toc-scroll' : 'toc-scroll collapsed'}>{renderNodes(outline)}</div>
    </nav>
  );
}
