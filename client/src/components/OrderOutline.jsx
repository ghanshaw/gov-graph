import { useEffect, useState } from 'react';

export default function OrderOutline({ sections }) {
  const [active, setActive] = useState(null);
  // Only matters on narrow windows, where the outline sits above the text and starts
  // collapsed; in the left gutter (index.css, 1300px and up) the list is always shown.
  const [open, setOpen] = useState(false);

  // Highlight the section currently being read.
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    }, { rootMargin: '-15% 0px -70% 0px' });
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="toc-rail">
      <nav className="toc" aria-label="Contents">
        <button type="button" className="toc-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          Contents
        </button>
        <ol className={open ? undefined : 'collapsed'}>
          {sections.map(s => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={active === s.id ? 'active' : undefined}>
                <span className="toc-num">{s.number}</span>
                {s.title ?? `Section ${s.number}`}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
