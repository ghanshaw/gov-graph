import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_BILL } from '../queries';
import PageLayout from '../components/PageLayout';
import Crumbs from '../components/Crumbs';
import { RailGroup, Fact } from '../components/Rail';
import TagPanel from '../components/TagPanel';

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
  '36000': 'Presented to President',
  'E20000': 'Enrolled Bill Signed',
  'E30000': 'Signed by President',
  'E40000': 'Vetoed by President',
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
        {loading && <div className="state">Loading…</div>}
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

  const head = (
    <>
      {crumbs}
      <span className="eyebrow">{typeFull} {bill.number} · {typeCode} {bill.number}</span>
      <h1 className="doc-title">{bill.title || 'Untitled Bill'}</h1>

      <dl className="facts">
        {introducedDate && <div><dt>Introduced</dt><dd>{introducedDate}</dd></div>}
        {bill.sponsor && (
          <div>
            <dt>Sponsor</dt>
            <dd>
              {bill.sponsor.fullName}
              {bill.sponsor.party && (
                <small className={PARTY_CLASS[bill.sponsor.party]}>({bill.sponsor.party}-{bill.sponsor.state})</small>
              )}
            </dd>
          </div>
        )}
        {bill.policyArea && <div><dt>Policy area</dt><dd>{bill.policyArea}</dd></div>}
        <div><dt>Congress</dt><dd>{bill.congress}th Congress</dd></div>
      </dl>

      <div className="actions">
        {bill.url && (
          <a className="btn primary" href={bill.url} target="_blank" rel="noopener noreferrer">
            View on Congress.gov ↗
          </a>
        )}
      </div>
    </>
  );

  const rail = (
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
  );

  return (
    <PageLayout head={head} rail={rail}>
      <BillStepper stageInfo={stageInfo} />

      <ActionsLog actions={bill.actions} />

      <TagPanel entityType="legislation" entityId={bill.id} />
    </PageLayout>
  );
}
