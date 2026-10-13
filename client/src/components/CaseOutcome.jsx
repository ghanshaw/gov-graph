import { Link } from 'react-router-dom';

// How the case came out: the judgment, the vote, and what each Justice did, as the
// syllabus's closing line-up states it (structure.outcome, from parse-slip-opinion.js).

const SIDES = [
  { key: 'majority', label: 'For the judgment' },
  { key: 'mixed', label: 'In part' },
  { key: 'dissent', label: 'Dissenting' },
];

const WROTE = {
  majority: 'Wrote the opinion of the Court',
  plurality: 'Announced the judgment and wrote the lead opinion',
  per_curiam: 'Per curiam',
  concurrence: 'Wrote a concurring opinion',
  dissent: 'Wrote a dissenting opinion',
  concurrence_in_part_dissent_in_part: 'Wrote an opinion concurring in part and dissenting in part',
};

export default function CaseOutcome({ structure, votes = [], onJump }) {
  const { outcome, opinions } = structure;
  // Each Justice as a person (people), where the votes have been matched (load-justices.js).
  const personOf = name => votes.find(v => v.name === name)?.personId;
  const opinion = id => opinions.find(o => o.id === id);
  const jump = (id, text) => (
    <a href={`#${id}-writing`} onClick={onJump}>{text}</a>
  );

  // What a Justice did: wrote, then joined.
  const notes = justice => [
    ...justice.wrote.map(id => {
      const o = opinion(id);
      return o && <span key={id}>{jump(id, WROTE[o.kind] ?? 'Wrote an opinion')}</span>;
    }),
    ...justice.joined.map((join, i) => {
      const o = opinion(join.opinion);
      if (!o) return null;
      const what = o.kind === 'majority' ? 'the opinion of the Court'
        : o.kind === 'per_curiam' ? 'the per curiam opinion'
        : `${o.author}’s ${o.kind === 'dissent' ? 'dissent' : o.kind === 'plurality' ? 'plurality opinion' : 'opinion'}`;
      return <span key={`joined-${i}`}>Joined {jump(o.id, what)}{join.qualifier && ` ${join.qualifier}`}</span>;
    }),
  ].filter(Boolean);

  const sides = SIDES
    .map(side => ({ ...side, justices: outcome.justices.filter(j => j.side === side.key) }))
    .filter(side => side.justices.length > 0);
  const tally = [outcome.vote.majority, outcome.vote.dissent].join('–');

  return (
    <div className="page-section outcome" id="case-outcome">
      <h2 className="section-title">Outcome</h2>
      <div className="outcome-head">
        <span className="outcome-judgment">{outcome.disposition ?? (outcome.inferred ? 'Per curiam' : 'Judgment')}</span>
        <span className="outcome-tally">{tally}</span>
      </div>

      {/* One segment per Justice, in the line-up's order */}
      <div className="outcome-bar" role="img" aria-label={`${outcome.vote.majority} for the judgment, ${outcome.vote.dissent} dissenting`}>
        {sides.flatMap(side => side.justices.map(j => <i key={j.name} className={side.key} title={j.name} />))}
      </div>

      <div className="outcome-sides">
        {sides.map(side => (
          <table key={side.key} className={`outcome-side ${side.key}`}>
            <caption>{side.label} · {side.justices.length}</caption>
            <tbody>
              {side.justices.map(j => (
                <tr key={j.name}>
                  <td className="name">
                    {personOf(j.name) ? <Link to={`/people/${personOf(j.name)}`}>{j.name}</Link> : j.name}
                    {j.chief && <small>C. J.</small>}
                  </td>
                  <td className="did">{notes(j)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      {outcome.holding && <p className="outcome-holding">{outcome.holding}</p>}
      {structure.syllabus?.lineup ? (
        <p className="source-note">From the line-up at the end of the syllabus: “{structure.syllabus.lineup}”</p>
      ) : (
        <p className="source-note">
          A per curiam opinion does not say who joined it. Justices who wrote or joined a separate opinion are placed by it;
          the rest are counted with the Court.
        </p>
      )}
    </div>
  );
}
