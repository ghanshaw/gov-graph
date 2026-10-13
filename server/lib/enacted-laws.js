// The laws a Congress enacted, listed as Congress.gov lists them under "Statutes at Large and
// Public Laws": statute citation, law number, bill and title, and the date it became law.
//
// A bill appears once the National Archives assigns it a law number (Congress.gov's law list).
// Its slip law text, and with it the Statutes at Large citation, exist only once the Government
// Publishing Office has published it on govinfo (collection PLAW, e.g. PLAW-119publ117). Until
// then the citation is blank and the law number has no link. Public and private laws are
// separate lists.

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { mirrorFile } from './data-dir.js';

const CONGRESS = 'https://api.congress.gov/v3';
const GOVINFO_API = 'https://api.govinfo.gov';
const GOVINFO = 'https://www.govinfo.gov';

const packageId = (congress, lawType, number) => `PLAW-${congress}${lawType === 'priv' ? 'pvtl' : 'publ'}${number}`;

/** Every law of a Congress from Congress.gov's law list (it pages at 250). */
async function lawList(congress, lawType) {
  const bills = [];
  for (let offset = 0; ; offset += 250) {
    const { data } = await axios.get(`${CONGRESS}/law/${congress}/${lawType}`, {
      params: { api_key: process.env.CONGRESS_API_KEY, format: 'json', limit: 250, offset },
    });
    bills.push(...(data.bills ?? []));
    if (bills.length >= (data.pagination?.count ?? 0) || !(data.bills ?? []).length) return bills;
  }
}

/** The packages govinfo has published for a Congress's laws. */
async function publishedPackages(congress) {
  const start = `${2 * congress + 1787}-01-01T00:00:00Z`; // the Congress's first year
  const ids = new Set();
  let offsetMark = '*';
  while (offsetMark) {
    const { data } = await axios.get(`${GOVINFO_API}/collections/PLAW/${start}`, {
      params: { congress, offsetMark, pageSize: 1000, api_key: process.env.GOV_INFO_KEY },
    });
    for (const p of data.packages ?? []) ids.add(p.packageId);
    offsetMark = data.nextPage ? new URL(data.nextPage).searchParams.get('offsetMark') : null;
  }
  return ids;
}

/**
 * A published law's own Statutes at Large citation, from the page marker at the head of its
 * text ("[[Page 140 STAT. 1061]]"). The package's metadata lists the statutes the law cites or
 * amends alongside its own, without saying which is which. Published text does not change, so
 * it is kept in the data directory.
 */
async function statuteCitation(id) {
  const url = `${GOVINFO}/content/pkg/${id}/html/${id}.htm`;
  const file = mirrorFile(url);
  if (!fs.existsSync(file)) {
    const { data } = await axios.get(url, { responseType: 'text', headers: { 'User-Agent': 'Mozilla/5.0 (govgraph)' } });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  }
  const m = /\[\[Page (\d+) STAT\. (\d+)\]\]/.exec(fs.readFileSync(file, 'utf8'));
  return m ? `${m[1]} Stat. ${m[2]}` : null;
}

/** Run `fn` over `items`, `limit` at a time. */
async function inBatches(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  return out;
}

/**
 * @param lawType 'pub' | 'priv'
 * @param becameLawDate (billId) => date, for a bill whose latest action is no longer its enactment
 */
export async function enactedLaws(congress, lawType, becameLawDate) {
  const [bills, published] = await Promise.all([lawList(congress, lawType), publishedPackages(congress)]);
  const laws = bills.flatMap(bill => (bill.laws ?? [])
    .filter(law => (lawType === 'priv' ? /private/i : /public/i).test(law.type))
    .map(law => ({ bill, law })));

  return inBatches(laws, 8, async ({ bill, law }) => {
    const number = law.number.split('-')[1];
    const id = packageId(congress, lawType, number);
    const isPublished = published.has(id);
    const latest = bill.latestAction ?? {};
    const date = /Became (Public|Private) Law/i.test(latest.text ?? '')
      ? latest.actionDate
      : await becameLawDate(`${congress}-${bill.type}-${bill.number}`);
    return {
      number: law.number,
      lawType,
      statuteCitation: isPublished ? await statuteCitation(id).catch(() => null) : null,
      slipLawUrl: isPublished ? `${GOVINFO}/content/pkg/${id}/pdf/${id}.pdf` : null,
      detailsUrl: isPublished ? `${GOVINFO}/app/details/${id}` : null,
      date: date ?? null,
      bill: { congress, type: bill.type, number: String(bill.number), title: bill.title ?? null },
    };
  });
}
