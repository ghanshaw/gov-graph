import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_USC_SECTION } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import Loading from '../components/Loading';
import TagPanel from '../components/TagPanel';
import { RailGroup } from '../components/Rail';
import { SectionItems } from '../components/OrderText';
import { renderSpans } from '../components/spans';
import { titleCase, containerName, sectionName, STATUS_LABEL, olrcUrl } from '../usc';

const BILL_LABEL = { hr: 'H.R.', s: 'S.', hjres: 'H.J.Res.', sjres: 'S.J.Res.', hconres: 'H.Con.Res.', sconres: 'S.Con.Res.', hres: 'H.Res.', sres: 'S.Res.' };

// Editorial and statutory notes, as the Code prints them after the section: "Editorial Notes"
// and "Statutory Notes and Related Subsidiaries" head groups of notes (amendments, effective
// dates, short titles, …).
function Notes({ notes }) {
  return (
    <div className="usc-notes">
      {notes.map((note, i) => (note.cross_heading ? (
        <h3 key={i} className="usc-notes-group">{note.heading}</h3>
      ) : (
        <div key={i} className="usc-note">
          {note.heading && <h4>{note.heading}</h4>}
          <SectionItems items={note.items} sectionId={`note-${i}`} />
        </div>
      )))}
    </div>
  );
}

// The laws that enacted and amended the section, as printed, with the bill behind each law
// where it is stored here.
function SourceCredit({ credit, credits }) {
  const bills = credits.filter(c => c.billType);
  return (
    <div className="usc-credit">
      <h3>Source credit</h3>
      <p>{renderSpans(credit.text, credit.spans)}</p>
      {bills.length > 0 && (
        <div className="chips">
          {bills.map(c => (
            <Link key={c.position} className="chip accent" to={`/congress/${c.congress}/${c.billType}/${c.billNumber}`}>
              Pub. L. {c.publicLaw} · {BILL_LABEL[c.billType] ?? c.billType.toUpperCase()} {c.billNumber}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UsCodeSection() {
  const { title: titleNumber, section: slug } = useParams();
  const { data, loading, error } = useQuery(GET_USC_SECTION, { variables: { title: titleNumber, section: slug } });
  const [showText, setShowText] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const s = data?.uscSection;
  const { hash } = useLocation();

  // A link to a subsection (/code/5/8335#c) lands on it once the text is in.
  useEffect(() => {
    if (!s || !hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }, [s, hash]);

  const titleCrumb = { label: `Title ${titleNumber.toUpperCase()}`, to: `/code/${titleNumber}` };
  if (!s) {
    return (
      <PageLayout rail={null}>
        <Crumbs items={[{ label: 'U.S. Code', to: '/code' }, titleCrumb, { label: `§ ${slug}` }]} />
        {loading && <Loading />}
        {error && <div className="error">Failed to load the section: {error.message}</div>}
        {!loading && !error && <div className="state">{titleNumber} U.S.C. § {slug} was not found in the loaded Code.</div>}
      </PageLayout>
    );
  }

  const structure = s.structure ?? { items: [], notes: [] };
  const name = s.kind === 'section' ? sectionName(s) : s.label ?? s.number;
  const cite = s.kind === 'section' ? `${s.title.number} U.S.C. ${name}` : `Title ${s.title.number} Appendix · ${name ?? ''}`;
  const chapter = [...s.ancestors].reverse().find(a => a.kind === 'chapter') ?? s.ancestors.at(-1);
  const notes = structure.notes ?? [];
  const noteCount = notes.filter(n => !n.cross_heading).length;
  // First-level provisions with headings make a contents list for a long section.
  const contents = structure.items.filter(i => i.level === 1 && i.anchor && i.heading);

  const head = (
    <>
      <Crumbs items={[
        { label: 'U.S. Code', to: '/code' },
        titleCrumb,
        ...(chapter ? [{ label: containerName(chapter), to: `/code/${titleNumber}` }] : []),
        { label: name },
      ]} />
      <span className="eyebrow">{cite}</span>
      <h1 className="doc-title">{s.heading || name}</h1>

      <dl className="facts">
        <div><dt>Title</dt><dd>{s.title.number.toUpperCase()} · {titleCase(s.title.name)}</dd></div>
        {chapter && <div><dt>{containerName(chapter).split(' ')[0]}</dt><dd>{containerName(chapter).split(' ').slice(1).join(' ')} · {titleCase(chapter.heading)}</dd></div>}
        <div><dt>Status</dt><dd>{s.status ? STATUS_LABEL[s.status] ?? s.status : 'In force'}</dd></div>
        <div><dt>Text as of</dt><dd>Pub. L. {s.version?.to ?? s.title.release}</dd></div>
      </dl>

      <div className="actions">
        {structure.items.length > 0 && (
          <button type="button" className={showText ? 'btn active' : 'btn'} aria-expanded={showText} aria-controls="usc-text" onClick={() => setShowText(v => !v)}>
            {showText ? 'Hide full text' : 'Show full text'}
          </button>
        )}
        {noteCount > 0 && (
          <button type="button" className={showNotes ? 'btn active' : 'btn'} aria-expanded={showNotes} aria-controls="usc-notes" onClick={() => setShowNotes(v => !v)}>
            {showNotes ? 'Hide notes' : `Show notes (${noteCount})`}
          </button>
        )}
        {s.kind === 'section' && (
          <>
            <a className="btn" href={olrcUrl(s.title.number, s.number)} target="_blank" rel="noopener noreferrer">uscode.house.gov ↗</a>
            <a className="btn" href={`https://www.govinfo.gov/link/uscode/${s.title.number}/${s.slug}`} target="_blank" rel="noopener noreferrer">GovInfo ↗</a>
          </>
        )}
      </div>
    </>
  );

  const neighbour = (unit, label) => unit && (
    <Link className="usc-neighbour" to={`/code/${titleNumber}/${encodeURIComponent(unit.slug)}`}>
      <span>{label}</span>
      <b>{sectionName(unit)}</b> {unit.heading ?? STATUS_LABEL[unit.status] ?? ''}
    </Link>
  );

  const rail = (
    <>
      {contents.length >= 3 && showText && (
        <nav className="group" aria-label="Contents">
          <h3>Contents</h3>
          <ol className="toc">
            {contents.map(i => (
              <li key={i.anchor}><a href={`#${i.anchor}`}><span className="toc-num">{i.marker}</span><span>{i.heading}</span></a></li>
            ))}
          </ol>
        </nav>
      )}
      <RailGroup title="In the Code">
        <ol className="usc-place">
          <li><Link to={`/code/${titleNumber}`}>Title {s.title.number.toUpperCase()} · {titleCase(s.title.name)}</Link></li>
          {s.ancestors.map(a => (
            <li key={a.identifier}>{containerName(a)}{a.heading ? ` · ${titleCase(a.heading)}` : ''}</li>
          ))}
        </ol>
      </RailGroup>
      {(s.previous || s.next) && (
        <RailGroup title="Nearby">
          {neighbour(s.previous, 'Previous')}
          {neighbour(s.next, 'Next')}
        </RailGroup>
      )}
    </>
  );

  return (
    <PageLayout head={head} rail={rail}>
      <div className="eo-doc usc-doc">
        {!s.current && (
          <p className="usc-warning">This section is not in the newest release loaded for its title; the text is from Pub. L. {s.version?.to}.</p>
        )}
        {showText && structure.items.length > 0 && (
          <section id="usc-text">
            <SectionItems items={structure.items} sectionId="usc" />
          </section>
        )}
        {structure.footnotes?.length > 0 && showText && (
          <div className="footnotes">
            {structure.footnotes.map(f => (
              <div key={f.id} id={f.id} className="footnote">
                <a className="marker" href={`#${f.id}-ref`}>{f.number}</a>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        )}
        {structure.source_credit && <SourceCredit credit={structure.source_credit} credits={s.credits} />}
        {showNotes && noteCount > 0 && <div id="usc-notes"><Notes notes={notes} /></div>}
      </div>
      <TagPanel itemRef={`usc:${s.identifier}`} />
    </PageLayout>
  );
}
