/**
 * The Comparative Agendas Project's Master Topics Codebook page (comparativeagendas.net/pages/master-codebook)
 * → a taxonomy (server/seed/data/taxonomies/, shown on the Taxonomies page): major topics, each with
 * its subtopics, as the page prints them. Licensed CC BY-NC-SA 4.0 (sources.json, `cap-master-codebook`), so the
 * taxonomy file carries the same licence.
 *
 *   { id, name, basis, levels, source, licence, categories: [{ id, code, name, children: [{ id, code, name,
 *     description, see_also?, note? }] }] }
 */

const decode = s => s
  .replace(/<br\s*\/?>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
  .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));

// "Description: …", "See also: …" and "Note: …" run on in one block; 1612 prints "Description;".
function field(text, label) {
  const m = text.match(new RegExp(`${label}[:;]\\s*(.*?)(?=\\s*(?:Description|See also|Note)[:;]|$)`, 'i'));
  return m ? `${m[1].trim().replace(/\.$/, '')}.` : undefined;
}

export function parseCapCodebook(html) {
  const version = html.match(/Master Topics Codebook Version ([\d.]+)/)?.[1];
  const date = html.match(/Master Topics Codebook Version [\d.]+<\/p>\s*<p>([^<]+)<\/p>/)?.[1]?.trim();
  const body = html.slice(html.indexOf('<li><strong>1.'));

  // A major topic is "<li><strong>1. Macroeconomics</strong>" and its list; each subtopic is "<li>101: Interest Rates<br/>
  // <em>Description: …</em></li>". 2300 (Culture) sets its description in a list of its own, after the subtopic.
  const topics = [];
  const parts = body.split(/<li><strong>/).slice(1);
  for (const part of parts) {
    const head = part.match(/^(\d+)\.\s*([^<]+)<\/strong>/);
    if (!head) continue;
    const children = [];
    for (const li of part.match(/<li>(?!<strong>)[\s\S]*?<\/li>/g) ?? []) {
      const text = decode(li).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
      const sub = text.match(/^(\d+):\s*(.*?)(?=\s*(?:Description|See also|Note)[:;]|$)/);
      if (sub) {
        children.push({ id: sub[1], code: sub[1], name: sub[2].trim(), description: field(text, 'Description') });
        const see = field(text, 'See also');
        const note = field(text, 'Note');
        if (see) children.at(-1).see_also = see;
        if (note) children.at(-1).note = note;
      } else if (children.length && !children.at(-1).description) {
        children.at(-1).description = field(text, 'Description');
      }
    }
    for (const c of children) if (!c.description) delete c.description;
    topics.push({ id: head[1], code: head[1], name: decode(head[2]).trim(), children });
  }
  return { version, date, topics };
}

/** The taxonomy file for the Taxonomies page, from a parse and where the page came from. */
export function capTaxonomy({ version, date, topics }, { url, fetched }) {
  const subtopics = topics.reduce((n, t) => n + t.children.length, 0);
  return {
    id: 'comparative-agendas',
    name: 'Comparative Agendas Project',
    basis: 'The topics of the Comparative Agendas Project, a political-science codebook used to code bills, hearings, executive orders, court cases and budgets.',
    levels: ['major topic', 'subtopic'],
    source: {
      title: `CAP Master Topics Codebook, version ${version}${date ? ` (${date})` : ''}`,
      citation: 'Jones, Bryan D., Frank R. Baumgartner, Sean M. Theriault, Derek A. Epp, Shruti Khandekar, Daniel Little. 2025. Policy Agendas Project: Codebook.',
      url,
      read: fetched,
      program: 'cap-master-codebook',
      note: `The codebook says 220 subtopics; the page lists ${subtopics}.`,
    },
    licence: 'CC BY-NC-SA 4.0 (© Comparative Agendas Project). This file is derived from the codebook and shared under the same licence.',
    categories: topics,
  };
}
