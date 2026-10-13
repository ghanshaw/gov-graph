import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, RadioOptions, CheckOption, Fact } from '../components/Rail';
import { STRUCTURES } from '../structures';

const SHOW_AS = [
  { value: 'categories', label: 'Categories' },
  { value: 'book', label: 'The book' },
];

// Every word typed must appear in the texts given (a name and the names above it).
function matches(words, ...texts) {
  const hay = texts.join(' ').toLowerCase();
  return words.every(w => hay.includes(w));
}

// Keep a category whose name (or code) matches with all its children, and otherwise only the children that match.
function filterTree(categories, words, above = '') {
  return categories
    .map(c => {
      const own = `${above} ${c.code ?? ''} ${c.name}`;
      if (!words.length || matches(words, own)) return c;
      const children = filterTree(c.children, words, own);
      return children.length ? { ...c, children } : null;
    })
    .filter(Boolean);
}

const plural = level => `${level[0].toUpperCase()}${level.slice(1)}s`;

// A structure that prints its own layout (the Statistical Abstract's sections, tables and pages) can also be shown that way.
const hasBook = structure => Boolean(structure.appendices);

// The Statistical Abstract as its contents print it: numbered sections with their tables and pages, subsections, appendices.
function BookView({ structure, words, query }) {
  const shown = filterTree(structure.categories, words);
  const appendixRows = [
    ...structure.appendices.flatMap(a => a.parts.map((part, i) => ({ ...part, num: i === 0 ? `App. ${a.number}` : '' }))),
    { num: '', title: 'Index', page: structure.index_page },
  ];

  return (
    <>
      {shown.length === 0 && <div className="state">No section or subsection matches “{query}”.</div>}
      <ol className="abstract-outline">
        {shown.map(s => (
          <li key={s.id}>
            <div className="abstract-section">
              <span className="abstract-num">Sec. {s.code}</span>
              <span className="abstract-title">{s.name}</span>
              <span className="abstract-tables">Tables {s.tables[0]}–{s.tables[1]}</span>
              <span className="abstract-page">p. {s.page}</span>
            </div>
            {s.children.length > 0 && (
              <ol className="abstract-subsections">
                {s.children.map(sub => (
                  <li key={sub.id}>
                    <span>{sub.name}</span>
                    <span className="abstract-page">p. {sub.page}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>

      {!words.length && (
        <>
          <h2 className="abstract-head">Appendices</h2>
          <ol className="abstract-outline">
            {appendixRows.map(row => (
              <li key={row.title} className="abstract-row">
                <div className="abstract-section">
                  <span className="abstract-num">{row.num}</span>
                  <span className="abstract-title">{row.title}</span>
                  <span />
                  <span className="abstract-page">p. {row.page}</span>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

// A category with its subcategories beneath, folding from its name. While finding, everything matched is open.
function Category({ category, closed, toggle, finding, descriptions, codes }) {
  const hasChildren = category.children?.length > 0;
  const open = finding || !closed.has(category.id);
  const label = (
    <>
      {codes && category.code && <span className="category-code">{category.code}</span>}
      <span>{category.name}</span>
    </>
  );
  return (
    <li>
      {hasChildren ? (
        <button type="button" className="category-name" aria-expanded={open} onClick={() => toggle(category.id)}>
          {label}
          <span className="category-count">{category.children.length}</span>
        </button>
      ) : (
        <span className="category-name leaf">{label}</span>
      )}
      {descriptions && category.description && (
        <div className={codes && category.code ? 'category-description coded' : 'category-description'}>
          {category.description}
          {category.see_also && <> <i>See also</i> {category.see_also}</>}
          {category.note && <> <i>Note:</i> {category.note}</>}
        </div>
      )}
      {hasChildren && open && (
        <ul className="category-tree">
          {category.children.map(c => (
            <Category key={c.id} category={c} closed={closed} toggle={toggle} finding={finding} descriptions={descriptions} codes={codes} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Any structure as nested categories: names, and on request the scheme's codes and descriptions; no tables or pages.
function CategoriesView({ structure, words, query, descriptions, codes }) {
  const [closed, setClosed] = useState(new Set());
  const toggle = id => setClosed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const shown = filterTree(structure.categories, words);
  const all = structure.categories.filter(c => c.children.length).map(c => c.id);

  return (
    <>
      <div className="category-tools">
        <button type="button" className="btn" onClick={() => setClosed(new Set())}>Expand all</button>
        <button type="button" className="btn" onClick={() => setClosed(new Set(all))}>Collapse all</button>
      </div>
      {shown.length === 0 && <div className="state">No category matches “{query}”.</div>}
      <ul className="category-tree top">
        {shown.map(c => (
          <Category key={c.id} category={c} closed={closed} toggle={toggle} finding={words.length > 0} descriptions={descriptions} codes={codes} />
        ))}
      </ul>
    </>
  );
}

// The structures GovGraph's data can be organised by (src/structures.js): the Statistical Abstract, the
// Comparative Agendas Project's topics, and any added later. Each is shown as nested categories; the Abstract
// can also be shown as the book prints it.
export default function Structure() {
  const [params, setParams] = useSearchParams();
  const structure = STRUCTURES.find(s => s.id === params.get('s')) ?? STRUCTURES[0];
  const asBook = hasBook(structure) && params.get('as') === 'book';
  const [query, setQuery] = useState('');
  const [descriptions, setDescriptions] = useState(false);
  const [codes, setCodes] = useState(false); // the scheme's numbers (CAP's 1, 101, …); hidden unless asked for (the Abstract's section numbers too)
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  // Only what differs from the defaults goes in the URL.
  const go = (id, as) => {
    const next = {};
    if (id !== STRUCTURES[0].id) next.s = id;
    if (as === 'book') next.as = as;
    setParams(next, { replace: true });
  };

  const hasDescriptions = structure.categories.some(c => c.description || c.children.some(sub => sub.description));
  const hasCodes = structure.categories.some(c => c.code);
  const counts = structure.levels.map((level, depth) => ({
    level,
    count: depth === 0 ? structure.categories.length : structure.categories.reduce((n, c) => n + c.children.length, 0),
  }));

  const rail = (
    <>
      <RailGroup title="Structure">
        <RadioOptions label="Structure" options={STRUCTURES.map(s => ({ value: s.id, label: s.name }))}
          value={structure.id} onChange={id => go(id, null)} />
      </RailGroup>
      {hasBook(structure) && (
        <RailGroup title="Show as">
          <RadioOptions label="Show as" options={SHOW_AS} value={asBook ? 'book' : 'categories'} onChange={as => go(structure.id, as)} />
        </RailGroup>
      )}
      <RailGroup title="Find">
        <input className="abstract-find" type="search" aria-label="Find"
          placeholder={structure.levels.map(plural).join(' or ').toLowerCase().replace(/^./, c => c.toUpperCase())}
          value={query} onChange={e => setQuery(e.target.value)} />
      </RailGroup>
      {(hasCodes || hasDescriptions) && !asBook && (
        <RailGroup title="Show">
          {hasCodes && <CheckOption label="Codes" checked={codes} onChange={setCodes} />}
          {hasDescriptions && <CheckOption label="Descriptions" checked={descriptions} onChange={setDescriptions} />}
        </RailGroup>
      )}
      <RailGroup title="Counts">
        {counts.map(({ level, count }) => <Fact key={level} label={plural(level)}><b>{count}</b></Fact>)}
        {asBook && (
          <>
            <Fact label="Tables"><b>{structure.categories.at(-1).tables[1].toLocaleString()}</b></Fact>
            <Fact label="Appendices"><b>{structure.appendices.length}</b></Fact>
          </>
        )}
      </RailGroup>
      <p className="source-note">
        {structure.source.title}. <a href={structure.source.url} target="_blank" rel="noreferrer">Source ↗</a>
      </p>
      {structure.source.note && <p className="source-note">{structure.source.note}</p>}
    </>
  );

  return (
    <PageLayout rail={rail}>
      <Crumbs items={[{ label: 'Structure' }]} />
      <div className="page-head">
        <h1 className="page-title">
          Structure
          <small>{structure.name}</small>
        </h1>
      </div>
      <p className="lede">
        Ways of organising GovGraph’s data into subjects, from the general to the particular. {structure.basis}
      </p>

      {asBook
        ? <BookView structure={structure} words={words} query={query} />
        : <CategoriesView key={structure.id} structure={structure} words={words} query={query} descriptions={descriptions} codes={codes} />}
    </PageLayout>
  );
}
