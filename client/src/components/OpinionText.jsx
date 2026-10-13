import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_DECISION_OPINION } from '../queries';
import { SectionItems } from './OrderText';
import Loading from './Loading';

// The word printed above each writing's heading.
const KIND_LABEL = {
  majority: 'Majority',
  plurality: 'Plurality',
  per_curiam: 'Per curiam',
  appendix: 'Appendix',
  statement: 'Statement',
  concurrence: 'Concurrence',
  dissent: 'Dissent',
  concurrence_in_part_dissent_in_part: 'Concurrence in part, dissent in part',
  opinion: 'Opinion',
  other: 'Other',
};

// The Court refers to its parts as "Part II–A–1".
const partLabel = section => (section.path.length ? `Part ${section.path.join('–')}` : null);

function Part({ section, items }) {
  return (
    <section id={section.id} className={items && items.length === 0 ? 'opinion-part bare' : 'opinion-part'}>
      {section.heading?.startsWith('*')
        ? <p className="part-break">{section.heading}</p>
        : partLabel(section) && <p className="sec-label">{partLabel(section)}</p>}
      {items ? <SectionItems items={items} sectionId={section.id} /> : <div className="pending"><Loading small /></div>}
    </section>
  );
}

// One opinion. Its heading and parts are laid out from the outline straight away, so the
// contents list has somewhere to point; the text is fetched once per opinion.
function Opinion({ decisionId, opinion, onLoaded }) {
  const { data, error } = useQuery(GET_DECISION_OPINION, { variables: { decisionId, opinionId: opinion.id } });
  const text = data?.decisionOpinion;

  useEffect(() => {
    if (!text) return;
    onLoaded?.(opinion.id);
    // A link to a part or a footnote of this opinion can only be followed now.
    const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (target && document.getElementById(`${opinion.id}-writing`)?.contains(target)) target.scrollIntoView();
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = text?.sections ?? opinion.outline;
  return (
    <div className="writing" id={`${opinion.id}-writing`}>
      <div className="writing-heading">
        <span>{KIND_LABEL[opinion.kind] ?? KIND_LABEL.other}</span>
        {opinion.label}
      </div>
      {opinion.byline && (
        <p className="byline">
          {opinion.byline}
          {opinion.byline_ref && <sup className="fn-ref"><a id={`${opinion.byline_ref.target}-ref`} href={`#${opinion.byline_ref.target}`}>{opinion.byline_ref.number}</a></sup>}
        </p>
      )}
      {error && <p className="error">Could not load this opinion: {error.message}</p>}

      {sections.map(section => <Part key={section.id} section={section} items={text ? section.items : null} />)}

      {text?.footnotes.length > 0 && (
        <div className="footnotes">
          <p className="sec-label">Footnotes</p>
          {text.footnotes.map(note => (
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

// Everything the decision cites by volume and page, with how often each writing cites it.
function Authorities({ structure }) {
  const writings = [
    ...(structure.syllabus ? [{ id: 'syllabus', label: 'Syllabus' }] : []),
    ...structure.opinions.map(o => ({ id: o.id, label: o.kind === 'majority' ? 'Court' : o.author ?? o.label })),
  ];
  const total = c => Object.values(c.mentions).reduce((a, b) => a + b, 0);
  const groups = [
    { label: 'Cases', types: ['case'] },
    { label: 'Statutes', types: ['usc', 'statute'] },
    { label: 'Federal Register', types: ['federal_register'] },
  ].map(group => ({
    ...group,
    items: structure.citations.filter(c => group.types.includes(c.type)).sort((a, b) => total(b) - total(a)),
  })).filter(group => group.items.length > 0);

  return (
    <div className="page-section" id="case-authorities">
      <h2 className="section-title">Cited in this decision</h2>
      <table className="records">
        <thead>
          <tr>
            <th>Authority</th>
            {writings.map(w => <th key={w.id} className="date">{w.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.flatMap(group => [
            <tr key={group.label} className="year-row"><td colSpan={writings.length + 1}>{group.label} · {group.items.length}</td></tr>,
            ...group.items.map(c => (
              <tr key={c.labels[0]}>
                <td className="title">
                  {c.href
                    ? <a href={c.href} target="_blank" rel="noopener noreferrer">{c.labels[0]}</a>
                    : c.labels[0]}
                </td>
                {writings.map(w => <td key={w.id} className="date">{c.mentions[w.id] ?? ''}</td>)}
              </tr>
            )),
          ])}
        </tbody>
      </table>
      <p className="source-note">
        Counted where a citation gives a volume and page (“272 U. S. 52”, “272 U. S., at 164”); a case referred to by name
        alone is not counted. Cases link to CourtListener, statutes to govinfo.
      </p>
    </div>
  );
}

export default function OpinionText({ decisionId, structure, showAuthorities, onLoaded }) {
  const { syllabus, opinions, source } = structure;
  // Loaded opinions are reported upwards so the contents list can watch their parts.
  const [, setLoaded] = useState(0);
  const loaded = id => {
    setLoaded(n => n + 1);
    onLoaded?.(id);
  };

  return (
    <div className="eo-doc opinion-doc">
      {showAuthorities && <Authorities structure={structure} />}

      {syllabus && (
        <div className="writing" id="syllabus-writing">
          <div className="writing-heading" id="syllabus">
            <span>Reporter of Decisions</span>
            Syllabus
          </div>
          <p className="byline">
            {structure.caption}{structure.proceeding && <><br />{structure.proceeding}</>}
          </p>
          <section>
            <SectionItems items={syllabus.items} sectionId="syllabus" />
            {syllabus.disposition && <p><em>{syllabus.disposition}</em></p>}
            {syllabus.lineup && <p>{syllabus.lineup}</p>}
          </section>
        </div>
      )}

      {opinions.map(opinion => <Opinion key={opinion.id} decisionId={decisionId} opinion={opinion} onLoaded={loaded} />)}

      {source?.pdf_url && (
        <footer className="source">
          Text read from the Court’s{' '}
          <a href={source.pdf_url} target="_blank" rel="noopener noreferrer">slip opinion</a>
          {source.pages && ` (${source.pages} pages)`}, which is subject to formal revision before it is printed in the
          United States Reports. The wording is unchanged; paragraphs were rejoined across lines and pages, footnotes
          moved to the end of each opinion, and part labels and links added for readability. The syllabus is prepared by
          the Reporter of Decisions and is not part of the opinion of the Court.
        </footer>
      )}
    </div>
  );
}
