import { useEffect, useState } from 'react';

// The contents list for the rail of the order page. It must be rendered together with
// the text (OrderText), whose sections it watches.
export default function OrderOutline({ sections }) {
  const [active, setActive] = useState(null);
  // Only matters on narrow windows, where the rail sits above the text and the list
  // starts collapsed (index.css, 900px and below); beside the text it is always shown.
  const [open, setOpen] = useState(false);

  // Highlight the section currently being read.
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    }, { rootMargin: '-10% 0px -75% 0px' });
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="group rail-outline" aria-label="Contents">
      <button type="button" className="toc-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        Contents
      </button>
      <ol className={open ? 'toc' : 'toc collapsed'}>
        {sections.map(s => (
          <li key={s.id}>
            {/* Until a section has scrolled into the reading band, the first one is current. */}
            <a href={`#${s.id}`} className={(active ?? sections[0].id) === s.id ? 'on' : undefined}>
              <span className="toc-num">{s.number}</span>
              <span>{s.title ?? `Section ${s.number}`}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
