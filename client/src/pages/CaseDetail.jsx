import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_SCOTUS_CASE, GET_CASE_IN_GRAPH } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, Fact } from '../components/Rail';
import TagPanel from '../components/TagPanel';

const DIRECTION_LABEL = {
  'liberal': 'Liberal',
  'conservative': 'Conservative',
};

const OPINION_TYPE_ORDER = [
  'Majority Opinion', 'Plurality Opinion', 'Concurrence',
  'Concurrence in Part / Dissent in Part', 'Dissent',
];

export default function CaseDetail() {
  const { courtSlug, caseId } = useParams();
  const { data, loading, error } = useQuery(GET_SCOTUS_CASE, {
    variables: { id: caseId },
  });
  const { data: graphData } = useQuery(GET_CASE_IN_GRAPH, {
    variables: { clusterId: parseInt(caseId, 10) },
  });
  const graphCaseId = graphData?.caseInGraph ?? null;

  const c = data?.scotusCase;
  const courtName = data?.naturalCourts?.find(nc => nc.slug === courtSlug)?.name || courtSlug;

  const crumbs = (
    <Crumbs items={[
      { label: 'Supreme Court', to: '/supreme-court' },
      { label: courtName, to: `/supreme-court/${courtSlug}` },
      { label: c?.citation || 'Case' },
    ]} />
  );

  if (!c) {
    return (
      <PageLayout head={crumbs}>
        {loading && <div className="state">Loading…</div>}
        {error && <div className="error">Failed to load case: {error.message}</div>}
        {!loading && !error && <div className="state">Case not found.</div>}
      </PageLayout>
    );
  }

  const formattedDate = c.dateFiled
    ? new Date(c.dateFiled + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  const voteDisplay = c.votesMajority != null && c.votesMinority != null
    ? `${c.votesMajority}–${c.votesMinority}`
    : null;

  const direction = DIRECTION_LABEL[c.decisionDirection] || null;

  const opinions = c.opinions || [];
  const groupedOpinions = OPINION_TYPE_ORDER.reduce((acc, type) => {
    const group = opinions.filter(o => o.type === type);
    if (group.length) acc.push({ type, opinions: group });
    return acc;
  }, []);

  const otherOpinions = opinions.filter(o => !OPINION_TYPE_ORDER.includes(o.type));
  if (otherOpinions.length) groupedOpinions.push({ type: 'Other', opinions: otherOpinions });

  const head = (
    <>
      {crumbs}
      <span className="eyebrow">Supreme Court · {courtName}</span>
      <h1 className="doc-title">{c.caseName}</h1>

      <dl className="facts">
        {formattedDate && <div><dt>Decided</dt><dd>{formattedDate}</dd></div>}
        {c.citation && <div><dt>Citation</dt><dd className="mono">{c.citation}</dd></div>}
        {c.docketNumber && <div><dt>Docket</dt><dd className="mono">{c.docketNumber}</dd></div>}
        {voteDisplay && (
          <div>
            <dt>Decision</dt>
            <dd>{voteDisplay}{direction && <small>{direction}</small>}</dd>
          </div>
        )}
      </dl>

      <div className="actions">
        {c.url && (
          <a className="btn primary" href={c.url} target="_blank" rel="noopener noreferrer">
            View on CourtListener ↗
          </a>
        )}
        {graphCaseId != null && (
          <Link className="btn" to={`/case-graph?caseId=${graphCaseId}`}>View in Case Graph →</Link>
        )}
      </div>
    </>
  );

  const rail = groupedOpinions.length > 0 && (
    <RailGroup title="Opinions">
      {groupedOpinions.map(({ type, opinions: group }) => (
        <Fact key={type} label={type}>{group.length}</Fact>
      ))}
    </RailGroup>
  );

  return (
    <PageLayout head={head} rail={rail}>
      {groupedOpinions.length > 0 && (
        <div className="page-section">
          <h2 className="section-title">Opinions</h2>
          <table className="records">
            <tbody>
              {groupedOpinions.flatMap(({ opinions: group }) => group).map(op => (
                <tr key={op.id}>
                  <td className="meta nowrap">{op.type}</td>
                  <td className="title">
                    <a href={op.url} target="_blank" rel="noopener noreferrer">
                      {op.perCuriam ? 'Per Curiam' : op.author || 'Unknown'} ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {c.syllabus && (
        <div className="page-section">
          <h2 className="section-title">Syllabus</h2>
          <p className="long-text">{c.syllabus}</p>
        </div>
      )}

      <TagPanel entityType="scotus_case" entityId={c.id} />
    </PageLayout>
  );
}
