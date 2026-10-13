// What each layer of data on a page is and where it comes from (Timeline.jsx). One block per
// layer shown: its description (always written by GovGraph, and labelled so), the publisher's own
// title where its files carry one (quoted verbatim, with the file and field it was read from), and
// the source of the data. Colours are in index.css (.about-data).

function Source({ source }) {
  if (!source) return null;
  return (
    <div className="about-line">
      <span className="about-label">Data</span>
      <span>
        {source.href ? <a href={source.href} target="_blank" rel="noreferrer">{source.label} ↗</a> : source.label}
        {source.note && <span className="about-note"> · {source.note}</span>}
      </span>
    </div>
  );
}

/**
 * items: [{ key, name, meta, swatch, swatchColor (a line's colour, var(--cat-n)), description, publisherTitle, publisherTitleFrom, source: { label, href, note } }]
 */
export function AboutItem({ item }) {
  return (
    <div className="about-item" data-testid={`about-${item.key}`}>
      <div className="about-head">
        {item.swatchColor ? <i className="swatch group" style={{ '--c': item.swatchColor }} />
          : item.swatch && <i className={`swatch ${item.swatch}`} />}
        <b>{item.name}</b>
        {item.meta && <span className="about-meta">{item.meta}</span>}
      </div>
      {item.description && (
        <div className="about-line">
          <span className="about-label">Description</span>
          <span>{item.description} <span className="about-by">Written by GovGraph</span></span>
        </div>
      )}
      {item.publisherTitle && (
        <div className="about-line">
          <span className="about-label">Publisher’s title</span>
          <span>“{item.publisherTitle}” <span className="about-by">Verbatim, from {item.publisherTitleFrom}</span></span>
        </div>
      )}
      <Source source={item.source} />
    </div>
  );
}

export default function AboutData({ items, title = 'About the data shown' }) {
  if (!items.length) return null;
  return (
    <section className="about-data" data-testid="about-data">
      <h2 className="section-title">{title}</h2>
      {items.map(item => <AboutItem key={item.key} item={item} />)}
    </section>
  );
}
