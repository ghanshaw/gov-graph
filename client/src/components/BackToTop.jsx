import { useEffect, useState } from 'react';

// A round button at the bottom right that scrolls back to the top of the page. It appears once the
// reader is two screens down, so it shows only on long pages (a bill's text, an opinion, a title of
// the Code).
export default function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setShown(window.scrollY > window.innerHeight * 2));
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      cancelAnimationFrame(frame);
    };
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' });
  };

  return (
    <button type="button" className={shown ? 'back-to-top shown' : 'back-to-top'} data-testid="back-to-top"
      aria-label="Back to top" title="Back to top" tabIndex={shown ? 0 : -1} aria-hidden={!shown} onClick={toTop}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3 L12.5 11 H1.5 Z" /></svg>
    </button>
  );
}
