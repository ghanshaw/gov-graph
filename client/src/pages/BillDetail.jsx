import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_BILL, GET_BILL_TEXT } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, RadioOptions, Fact } from '../components/Rail';
import TagPanel from '../components/TagPanel';
import BillText from '../components/BillText';
import BillOutline from '../components/BillOutline';
import BillVotes from '../components/BillVotes';
import Loading from '../components/Loading';

const TYPE_CODE = {
  HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.',
  HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.', HRES: 'H.Res.', SRES: 'S.Res.',
};

const TYPE_FULL = {
  HR: 'House Bill',
  S: 'Senate Bill',
  HJRES: 'House Joint Resolution',
  SJRES: 'Senate Joint Resolution',
  HCONRES: 'House Concurrent Resolution',
  SCONRES: 'Senate Concurrent Resolution',
  HRES: 'House Resolution',
  SRES: 'Senate Resolution',
};

const PARTY_CLASS = { D: 'party-dem', R: 'party-rep', I: 'party-ind' };

// Bill type → the path segment congress.gov uses for it.
const CONGRESS_GOV_TYPE = {
  HR: 'house-bill',
  S: 'senate-bill',
  HJRES: 'house-joint-resolution',
  SJRES: 'senate-joint-resolution',
  HCONRES: 'house-concurrent-resolution',
  SCONRES: 'senate-concurrent-resolution',
  HRES: 'house-resolution',
  SRES: 'senate-resolution',
};

function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

// The most recent text version that has a PDF. Its file name (BILLS-119s3018rs) is also
// the govinfo package id, which the server's PDF pass-through takes (see server/pdf.js).
// `packageId` picks that version (the one whose text is being shown); without it, the most
// recent bill print. A public law's own print (PLAW-…) is a different package and is skipped.
function latestPdf(textVersions = [], packageId = null) {
  const versions = textVersions
    .map(v => {
      const url = v.formats?.find(f => f.type === 'PDF' && f.url)?.url;
      const id = /(BILLS-[0-9a-z]+)\.pdf$/.exec(url ?? '')?.[1];
      return id ? { url, packageId: id, type: v.type, date: v.date?.slice(0, 10) ?? null } : null;
    })
    .filter(Boolean)
    // The enrolled bill has no date of its own and is the final text.
    .sort((a, b) => (b.date ?? '9999').localeCompare(a.date ?? '9999'));
  return versions.find(v => v.packageId === packageId) ?? versions[0] ?? null;
}

// Map congress.gov text version type strings to canonical stages
const VERSION_STAGE = {
  'Introduced in Senate': 'introduced',
  'Introduced in House': 'introduced',
  'Reported in Senate': 'committee',
  'Reported in House': 'committee',
  'Placed on Calendar Senate': 'floor',
  'Placed on Calendar House': 'floor',
  'Engrossed in Senate': 'passed-origin',
  'Engrossed in House': 'passed-origin',
  'Engrossed Amendment Senate': 'other-chamber',
  'Engrossed Amendment House': 'other-chamber',
  'Referred in Senate': 'other-chamber',
  'Referred in House': 'other-chamber',
  'Reported in Senate without Amendment': 'other-chamber',
  'Considered and Passed Senate': 'passed-origin',
  'Considered and Passed House': 'passed-origin',
  'Enrolled Bill': 'enacted',
};

// Map congress.gov action type strings to canonical stages
const ACTION_TYPE_STAGE = {
  'IntroReferral': 'introduced',
  'Committee': 'committee',
  'Floor': 'floor',
  'Calendars': 'floor',
  'BecameLaw': 'enacted',
  'President': 'enacted',
};

const STAGES = [
  { key: 'introduced',    label: 'Introduced' },
  { key: 'committee',     label: 'Committee' },
  { key: 'floor',         label: 'Floor' },
  { key: 'passed-origin', label: 'Passed Chamber' },
  { key: 'other-chamber', label: 'Other Chamber' },
  { key: 'enacted',       label: 'Enacted' },
];

function deriveStageInfo(bill) {
  // Returns a map of stageKey -> { reached: bool, date: string|null, documents: [] }
  const info = {};
  for (const s of STAGES) {
    info[s.key] = { reached: false, date: null, documents: [] };
  }

  // Seed from introducedDate
  if (bill.introducedDate) {
    info['introduced'].reached = true;
    info['introduced'].date = bill.introducedDate;
  }

  // Overlay from text versions (most authoritative for dates + documents)
  for (const v of (bill.textVersions || [])) {
    const stage = VERSION_STAGE[v.type];
    if (!stage || !info[stage]) continue;
    info[stage].reached = true;
    if (!info[stage].date || v.date < info[stage].date) {
      info[stage].date = v.date;
    }
    info[stage].documents.push(v);
  }

  // Fill gaps from actions
  for (const a of (bill.actions || [])) {
    const stage = ACTION_TYPE_STAGE[a.type];
    if (!stage || !info[stage]) continue;
    if (!info[stage].reached) {
      info[stage].reached = true;
      info[stage].date = a.actionDate;
    }
  }

  return info;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function BillStepper({ stageInfo }) {
  const lastReachedIdx = STAGES.reduce((acc, s, i) => stageInfo[s.key].reached ? i : acc, -1);

  return (
    <div className="page-section">
      <h2 className="section-title">Legislative progress</h2>

      <div className="stepper">
        {STAGES.map((stage, i) => {
          const info = stageInfo[stage.key];
          const classes = ['step'];
          if (info.reached) classes.push('reached');
          if (i === lastReachedIdx) classes.push('current');
          // The line to the next step is drawn once this step has been passed or reached.
          if (i <= lastReachedIdx) classes.push('passed');

          return (
            <div key={stage.key} className={classes.join(' ')}>
              <div className="step-mark">
                {info.reached && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              <div className="step-label">{stage.label}</div>
              {info.date && formatDate(info.date) && <div className="step-date">{formatDate(info.date)}</div>}
              {info.documents.length > 0 && (
                <div className="step-docs">
                  {info.documents.map((v, di) => {
                    const pdf = v.formats?.find(f => f.type === 'PDF');
                    const html = v.formats?.find(f => f.type === 'Formatted Text' || f.type === 'HTML');
                    const link = pdf || html;
                    return link ? (
                      <a key={di} className="chip" href={link.url} target="_blank" rel="noopener noreferrer">
                        {pdf ? 'PDF' : 'Text'} ↗
                      </a>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ACTION_CODE_NAME = {
  // Introduction
  '14000': 'Introduced',
  '10000': 'Introduced',
  // Committee referral
  'H11100': 'Referred to Committee',
  'H11200': 'Referred to Subcommittee',
  'S06300': 'Referred to Committee',
  'S06500': 'Referred to Subcommittee',
  // Committee action
  'H12100': 'Committee Consideration',
  'H12200': 'Ordered Reported',
  'H12300': 'Committee Discharged',
  'H12410': 'Reported by Committee',
  'H12420': 'Reported with Amendment',
  'S12100': 'Committee Consideration',
  'S12200': 'Ordered Reported',
  'S12300': 'Committee Discharged',
  'S12410': 'Reported by Committee',
  'S12420': 'Reported with Amendment',
  // Calendar
  'H15000': 'Placed on House Calendar',
  'S15000': 'Placed on Senate Calendar',
  // Floor
  'H17000': 'Floor Consideration',
  'H30000': 'Passed House',
  'H36000': 'Passed House',
  'H37300': 'Failed in House',
  'H8D000': 'Tabled in House',
  'S17000': 'Floor Consideration',
  'S30000': 'Passed Senate',
  'S36000': 'Passed Senate',
  'S37300': 'Failed in Senate',
  // Cross-chamber
  'H14000': 'Received in Senate',
  'S14000': 'Received in House',
  // Conference
  'H42000': 'Conference Report Filed',
  'S42000': 'Conference Report Filed',
  // Presidential
  '28000': 'Presented to President',
  '36000': 'Became Public Law',
  'E20000': 'Presented to President',
  'E30000': 'Signed by President',
  'E40000': 'Became Public Law',
  // Enacted
  'B00100': 'Became Public Law',
  'BF0A00': 'Became Public Law',
};

function ActionRow({ action }) {
  return (
    <div className="action-row">
      <div className="action-when">
        {formatDate(action.actionDate)}
        {/* The raw action code shows on hover (index.css). */}
        {action.actionCode && <span className="action-code">{action.actionCode}</span>}
      </div>
      {ACTION_CODE_NAME[action.actionCode] && (
        <div className="action-name">{ACTION_CODE_NAME[action.actionCode]}</div>
      )}
      <div className="action-text">{action.text}</div>
    </div>
  );
}

function ActionsLog({ actions }) {
  const [expanded, setExpanded] = useState(false);
  if (!actions || actions.length === 0) return null;

  const shown = expanded ? actions : actions.slice(0, 5);

  return (
    <div className="page-section">
      <h2 className="section-title">Action history ({actions.length})</h2>

      <div className="action-log">
        {shown.map((action, i) => (
          <ActionRow key={i} action={action} />
        ))}
      </div>

      {actions.length > 5 && (
        <button type="button" className="btn more" aria-expanded={expanded} onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `Show ${actions.length - 5} more`}
        </button>
      )}
    </div>
  );
}

// The order relationship kinds are listed in: the closest first. Kinds not named here follow.
const RELATIONSHIP_ORDER = [
  'Identical bill', 'Same text', 'Similar text', 'Not identical', 'PrimaryCompanionBillBecameLaw', 'SecondaryCompanionBillBecameLaw',
  'Contained in public law', 'Public law contains the text', 'Procedurally related', 'Related bill',
  'Cross-Congress related bill',
];
const RELATIONSHIP_LABEL = {
  'Same text': 'Same text (compared here, 90% or more)',
  'Similar text': 'Similar text (compared here, 60–90%)',
  PrimaryCompanionBillBecameLaw: 'Companion bill that became law',
  SecondaryCompanionBillBecameLaw: 'Companion of the bill that became law',
};

// Bills related to this one, grouped by kind of relationship, with who identified each:
// Congress.gov's (mostly the Congressional Research Service) and our own, with our note.
function RelatedBills({ relationships, congress }) {
  const rank = type => (RELATIONSHIP_ORDER.includes(type) ? RELATIONSHIP_ORDER.indexOf(type) : RELATIONSHIP_ORDER.length);
  const kinds = [...new Set(relationships.map(r => r.relationship))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const code = r => `${TYPE_CODE[r.type] || r.type} ${r.number}`;
  const href = r => (CONGRESS_GOV_TYPE[r.type]
    ? `https://www.congress.gov/bill/${ordinal(r.congress)}-congress/${CONGRESS_GOV_TYPE[r.type]}/${r.number}`
    : null);

  return (
    <table className="records related-bills">
      {kinds.map(kind => (
        <tbody key={kind}>
          <tr className="year-row"><td colSpan={3}>{RELATIONSHIP_LABEL[kind] ?? kind}</td></tr>
          {relationships.filter(r => r.relationship === kind).map(r => (
            <tr key={`${kind}-${r.congress}-${r.type}-${r.number}-${r.source}`}>
              <td className="no">
                {r.loaded
                  ? <Link to={`/congress/${r.congress}/${r.type.toLowerCase()}/${r.number}`}>{code(r)}</Link>
                  : href(r) ? <a href={href(r)} target="_blank" rel="noopener noreferrer">{code(r)} ↗</a> : code(r)}
              </td>
              <td className="title">
                {r.title || 'Untitled'}
                {r.congress !== congress && <span className="sub">{ordinal(r.congress)} Congress</span>}
                {r.note && <span className="sub">{r.note}</span>}
              </td>
              <td className="date">{r.source === 'govgraph' ? 'GovLens' : r.identifiedBy}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

export default function BillDetail() {
  const { number, billType, billNumber } = useParams();
  const congressNum = parseInt(number);

  const { data, loading, error } = useQuery(GET_BILL, {
    variables: {
      congress: congressNum,
      billType: billType.toUpperCase(),
      billNumber,
    },
  });

  const bill = data?.bill;
  const [showPdf, setShowPdf] = useState(false);

  // Text versions that have been parsed and stored, newest first. The latest is shown
  // unless the reader picks another.
  const documents = bill?.textDocuments ?? [];
  const [chosenVersion, setChosenVersion] = useState(null);
  const packageId = chosenVersion ?? documents[0]?.packageId ?? null;
  const [showText, setShowText] = useState(true);
  // Progress (the stepper and action history) and tags sit behind their own buttons.
  // Progress starts open only where there is no text to read instead.
  const [progressChoice, setProgressChoice] = useState(null);
  const showProgress = progressChoice ?? (Boolean(bill) && documents.length === 0);
  const [showTags, setShowTags] = useState(false);
  // Recorded votes on the bill; most bills have none (voice votes, or never reached the floor).
  const rollCalls = bill?.rollCalls ?? [];
  const [showVotes, setShowVotes] = useState(false);
  // Related bills (bill_relationships); the identical bill of its proposal is named in the heading.
  const relationships = bill?.relatedBills ?? [];
  const relatedCount = new Set(relationships.map(r => `${r.congress}-${r.type}-${r.number}`)).size;
  const companions = bill?.companions ?? [];
  const [showRelated, setShowRelated] = useState(false);
  const { data: textData, loading: textLoading } = useQuery(GET_BILL_TEXT, {
    variables: { packageId },
    skip: !packageId,
  });
  const text = textData?.billText;
  const t = (bill?.type || billType).toUpperCase();
  const typeCode = TYPE_CODE[t] || t;
  const typeFull = TYPE_FULL[t] || t;

  const crumbs = (
    <Crumbs items={[
      { label: 'Congress', to: '/congress' },
      { label: `${number}th Congress`, to: `/congress/${number}` },
      { label: `${typeCode} ${billNumber}` },
    ]} />
  );

  if (!bill) {
    return (
      <PageLayout head={crumbs}>
        {loading && <Loading />}
        {error && <div className="error">Failed to load bill: {error.message}</div>}
        {!loading && !error && <div className="state">Bill not found.</div>}
      </PageLayout>
    );
  }

  const introducedDate = bill.introducedDate
    ? new Date(bill.introducedDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  const stageInfo = deriveStageInfo(bill);
  const pdf = latestPdf(bill.textVersions, packageId);
  const congressGovUrl = CONGRESS_GOV_TYPE[t]
    ? `https://www.congress.gov/bill/${ordinal(bill.congress)}-congress/${CONGRESS_GOV_TYPE[t]}/${bill.number}`
    : null;

  const head = (
    <>
      {crumbs}
      <span className="eyebrow">{typeFull} {bill.number} · {typeCode} {bill.number}</span>
      <h1 className="doc-title">{bill.title || 'Untitled Bill'}</h1>
      {companions.map(c => {
        // Why the two share a proposal: Congress.gov's "Identical bill", or our comparison of the texts.
        const links = relationships.filter(r => r.congress === c.congress && r.type === c.type && r.number === c.number);
        const kind = ['Identical bill', 'Same text', 'Similar text'].find(k => links.some(r => r.relationship === k));
        const percent = links.find(r => r.relationship === kind)?.note?.match(/^\d+%/)?.[0];
        return (
          <p key={c.id} className="companion">
            {kind === 'Similar text' ? 'Companion bill' : kind === 'Same text' ? 'Same text as' : 'Identical bill'}:{' '}
            <Link to={`/congress/${c.congress}/${c.type.toLowerCase()}/${c.number}`}>{TYPE_CODE[c.type] || c.type} {c.number}</Link>
            <span className="muted">
              {' — '}the same proposal in the other chamber
              {kind !== 'Identical bill' && percent && `; ${percent} of the text is the same, compared here`}
            </span>
          </p>
        );
      })}

      <dl className="facts">
        {introducedDate && <div><dt>Introduced</dt><dd>{introducedDate}</dd></div>}
        {bill.sponsor && (
          <div>
            <dt>Sponsor</dt>
            <dd>
              {bill.sponsor.personId
                ? <Link className="person-link" to={`/people/${bill.sponsor.personId}`}>{bill.sponsor.fullName}</Link>
                : bill.sponsor.fullName}
              {bill.sponsor.party && (
                <small className={PARTY_CLASS[bill.sponsor.party]}>({bill.sponsor.party}-{bill.sponsor.state})</small>
              )}
            </dd>
          </div>
        )}
        {bill.policyArea && <div><dt>Policy area</dt><dd>{bill.policyArea}</dd></div>}
        <div><dt>Congress</dt><dd>{bill.congress}th Congress</dd></div>
      </dl>

      {/* Same row of buttons as the executive order page, without the full text for now. */}
      <div className="actions">
        {packageId && (
          <button
            type="button"
            className={showText ? 'btn active' : 'btn'}
            aria-expanded={showText}
            aria-controls="bill-text"
            onClick={() => setShowText(s => !s)}
          >
            {showText ? 'Hide full text' : 'Show full text'}
          </button>
        )}
        {pdf?.packageId && (
          <button
            type="button"
            className={showPdf ? 'btn active' : 'btn'}
            aria-expanded={showPdf}
            aria-controls="bill-pdf"
            onClick={() => setShowPdf(s => !s)}
          >
            {showPdf ? 'Hide PDF' : 'Show PDF'}
          </button>
        )}
        <button
          type="button"
          className={showProgress ? 'btn active' : 'btn'}
          aria-expanded={showProgress}
          aria-controls="bill-progress"
          onClick={() => setProgressChoice(!showProgress)}
        >
          {showProgress ? 'Hide progress' : 'Show progress'}
        </button>
        {rollCalls.length > 0 && (
          <button
            type="button"
            className={showVotes ? 'btn active' : 'btn'}
            aria-expanded={showVotes}
            aria-controls="bill-votes"
            onClick={() => setShowVotes(s => !s)}
          >
            {showVotes ? 'Hide votes' : `Show votes (${rollCalls.length})`}
          </button>
        )}
        {relatedCount > 0 && (
          <button
            type="button"
            className={showRelated ? 'btn active' : 'btn'}
            aria-expanded={showRelated}
            aria-controls="bill-related"
            onClick={() => setShowRelated(s => !s)}
          >
            {showRelated ? 'Hide related bills' : `Show related bills (${relatedCount})`}
          </button>
        )}
        <button
          type="button"
          className={showTags ? 'btn active' : 'btn'}
          aria-expanded={showTags}
          aria-controls="bill-tags"
          onClick={() => setShowTags(s => !s)}
        >
          {showTags ? 'Hide tags' : 'Show tags'}
        </button>
        {pdf && <a className="btn" href={pdf.url} target="_blank" rel="noopener noreferrer">PDF ↗</a>}
        {congressGovUrl && (
          <a className="btn" href={congressGovUrl} target="_blank" rel="noopener noreferrer">Congress.gov ↗</a>
        )}
        {pdf?.packageId && (
          <a className="btn" href={`https://www.govinfo.gov/app/details/${pdf.packageId}`} target="_blank" rel="noopener noreferrer">
            GovInfo ↗
          </a>
        )}
      </div>
    </>
  );

  const rail = (
    <>
      {showText && text && <BillOutline key={packageId} outline={text.outline} />}
      {documents.length > 1 && (
        <RailGroup title="Version">
          <RadioOptions
            label="Version"
            options={documents.map(d => ({
              label: formatDate(d.date) ? `${d.label} · ${formatDate(d.date)}` : d.label,
              value: d.packageId,
            }))}
            value={packageId}
            onChange={setChosenVersion}
          />
        </RailGroup>
      )}
      {/* While the text is being read the rail is left to the contents tree; these facts
          come back with the "Show progress" button. */}
      {(showProgress || !(showText && text)) && (
        <>
          <RailGroup title="Progress">
            {STAGES.map(stage => (
              <Fact key={stage.key} label={stage.label}>
                {stageInfo[stage.key].reached ? formatDate(stageInfo[stage.key].date) ?? '✓' : '—'}
              </Fact>
            ))}
          </RailGroup>
          <RailGroup title="In this bill">
            <Fact label="Actions">{bill.actions?.length ?? 0}</Fact>
            <Fact label="Text versions">{bill.textVersions?.length ?? 0}</Fact>
          </RailGroup>
        </>
      )}
    </>
  );

  return (
    <PageLayout head={head} rail={rail}>
      {/* The latest printed version of the bill, passed through the server (see server/pdf.js) */}
      {pdf?.packageId && showPdf && (
        <div className="page-section">
          <h2 className="section-title">
            Bill text · {pdf.type}{formatDate(pdf.date) ? ` · ${formatDate(pdf.date)}` : ''}
          </h2>
          <iframe
            id="bill-pdf"
            className="pdf-frame"
            title={`${typeCode} ${bill.number}, ${pdf.type} (PDF)`}
            src={`/pdf/bill/${pdf.packageId}#navpanes=0&view=FitH`}
          />
        </div>
      )}

      {showProgress && (
        <div id="bill-progress">
          <BillStepper stageInfo={stageInfo} />
          <ActionsLog actions={bill.actions} />
        </div>
      )}

      {showVotes && rollCalls.length > 0 && (
        <div id="bill-votes" className="page-section">
          <h2 className="section-title">Recorded votes ({rollCalls.length})</h2>
          <BillVotes rollCalls={rollCalls} />
        </div>
      )}

      {showRelated && relatedCount > 0 && (
        <div id="bill-related" className="page-section">
          <h2 className="section-title">Related bills ({relatedCount})</h2>
          <RelatedBills relationships={relationships} congress={bill.congress} />
          <p className="note">
            Relationships as recorded on Congress.gov, with who identified each (mostly the Congressional Research
            Service); “GovLens” marks ones added here. Bills not loaded here link to Congress.gov.
          </p>
        </div>
      )}

      {/* Above the text: a long bill would leave the tags hundreds of sections down. */}
      {showTags && (
        <div id="bill-tags">
          <TagPanel itemRef={`bill:${bill.id}`} />
        </div>
      )}

      {/* Full text of the chosen version, where it has been parsed and stored */}
      {packageId && showText && (
        <div id="bill-text" className="page-section">
          <h2 className="section-title">
            Bill text · {documents.find(d => d.packageId === packageId)?.label}
            {text && ` · ${text.section_index.length} ${text.section_index.length === 1 ? 'section' : 'sections'}`}
          </h2>
          {textLoading && <Loading />}
          {text && <BillText key={packageId} packageId={packageId} text={text} />}
        </div>
      )}
    </PageLayout>
  );
}
