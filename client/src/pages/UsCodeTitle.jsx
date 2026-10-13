import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_USC_TITLE, GET_USC_CHILDREN } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import Loading from '../components/Loading';
import { RailGroup, Fact } from '../components/Rail';
import { GoToSection } from './UsCode';
import { titleCase, containerName, sectionName, STATUS_LABEL } from '../usc';

// The sections directly under a container (or the title), fetched when it is opened.
function SectionList({ title, identifier }) {
  const { data, loading, error } = useQuery(GET_USC_CHILDREN, { variables: { identifier } });
  if (loading) return <Loading small />;
  if (error) return <div className="error">Failed to load sections: {error.message}</div>;
  const units = (data?.uscChildren ?? []).filter(u => u.slug);
  return (
    <ol className="usc-sections">
      {units.map(u => (
        <li key={u.identifier} className={u.status ? 'inactive' : undefined}>
          <Link to={`/code/${title}/${encodeURIComponent(u.slug)}`}>
            <span className="usc-num">{sectionName(u)}</span>
            <span>{u.status && !u.heading ? STATUS_LABEL[u.status] ?? u.status : u.heading}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

// "§§ 1 – 46" from the first and last sections under a container; an entry that covers
// several sections ("§§ 71 to 71l") gives its first or last number.
function sectionRange(node) {
  if (!node.sections || !node.firstLabel) return null;
  const bare = label => sectionName({ label }).replace(/^§+\s*/, '');
  const first = bare(node.firstLabel).split(' to ')[0];
  const last = bare(node.lastLabel).split(' to ').at(-1);
  return first === last ? `§ ${first}` : `§§ ${first} – ${last}`;
}

// `startOpen`: the top headings start open when there are few of them (Title 10's subtitles),
// closed when there are many (Title 42's chapters), since an open heading fetches its sections.
function Container({ node, title, open, toggle, startOpen }) {
  const isOpen = open[node.identifier] ?? (startOpen && node.depth === 0);
  const range = sectionRange(node);
  return (
    <li className={`depth-${Math.min(node.depth, 4)}`}>
      <button type="button" className="usc-branch" aria-expanded={isOpen} onClick={() => toggle(node.identifier, !isOpen)}>
        <span className="usc-kind">{containerName(node)}</span>
        <span className="usc-heading">{titleCase(node.heading) ?? ''}</span>
        {range && <span className="usc-range">{range}</span>}
      </button>
      {isOpen && (
        <>
          {node.children.length > 0 && (
            <ol className="usc-outline">
              {node.children.map(c => <Container key={c.identifier} node={c} title={title} open={open} toggle={toggle} startOpen={startOpen} />)}
            </ol>
          )}
          {node.sections > 0 && <SectionList title={title} identifier={node.identifier} />}
        </>
      )}
    </li>
  );
}

export default function UsCodeTitle() {
  const { title: number } = useParams();
  const { data, loading, error } = useQuery(GET_USC_TITLE, { variables: { number } });
  const title = data?.uscTitle;
  const [open, setOpen] = useState({}); // container identifier → open, where the reader chose
  const toggle = (identifier, value) => setOpen(prev => ({ ...prev, [identifier]: value }));

  // The flat list of containers (in reading order, each with its parent) as a tree.
  const tree = useMemo(() => {
    if (!title) return [];
    const byId = new Map(title.containers.map(c => [c.identifier, { ...c, children: [] }]));
    const roots = [];
    for (const c of byId.values()) (byId.get(c.parent)?.children ?? roots).push(c);
    return roots;
  }, [title]);

  const crumbs = <Crumbs items={[{ label: 'U.S. Code', to: '/code' }, { label: `Title ${number.toUpperCase()}` }]} />;
  if (!title) {
    return (
      <PageLayout rail={null}>
        {crumbs}
        {loading && <Loading />}
        {error && <div className="error">Failed to load the title: {error.message}</div>}
        {!loading && !error && <div className="state">Title {number} is not loaded.</div>}
      </PageLayout>
    );
  }

  const rail = (
    <>
      <RailGroup title="Go to a section">
        <GoToSection title={title.number} />
      </RailGroup>
      <RailGroup title="This title">
        <Fact label="Sections in force">{title.sectionCount.toLocaleString()}</Fact>
        <Fact label="Positive law">{title.positiveLaw ? 'Yes' : 'No'}</Fact>
        <Fact label="Current through">Pub. L. {title.release}</Fact>
      </RailGroup>
    </>
  );

  return (
    <PageLayout rail={rail}>
      {crumbs}
      <div className="page-head">
        <h1 className="page-title">
          Title {title.number.toUpperCase()} · {titleCase(title.name)}
          <small>{title.sectionCount.toLocaleString()} sections</small>
        </h1>
      </div>
      <p className="lede">
        {title.positiveLaw
          ? 'This title was enacted as positive law: its text in the Code is the law itself.'
          : 'This title is not positive law: its text is the Law Revision Counsel’s arrangement of the laws as enacted, which remain the authority.'}
        {' '}Open a {title.containers.length ? 'heading' : 'title'} to list its sections.
      </p>

      <ol className="usc-outline">
        {tree.map(node => <Container key={node.identifier} node={node} title={title.number} open={open} toggle={toggle} startOpen={tree.length <= 8} />)}
      </ol>
      {title.directSections > 0 && <SectionList title={title.number} identifier={title.identifier} />}
    </PageLayout>
  );
}
