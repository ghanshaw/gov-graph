# The navy design — reference before redesign

A record of how the GovLens app looked and was built on **2026-10-02**, taken before
moving to a new design. It covers the look (colours, type, components), the structure of
each page, and how the styling is implemented.

- `screenshots/` — every page type, most captured full length (22 images, about 17 MB)
- `source/` — copies of the stylesheet and the key components as they were
- `capture.sh` — re-takes the screenshots with headless Chrome (app must be running)

Nothing in the app was committed to git when this was written (the repo has only its
initial commit), so `source/` and this file are the only fixed record. **Commit the
working tree before starting the redesign.**

## Contents

1. [Screenshots](#screenshots)
2. [Palette](#palette)
3. [Typography](#typography)
4. [Layout](#layout)
5. [Components](#components)
6. [Pages](#pages)
7. [Executive order text](#executive-order-text)
8. [How the styling is implemented](#how-the-styling-is-implemented)
9. [Problems found while capturing](#problems-found-while-capturing)
10. [What a redesign has to touch](#what-a-redesign-has-to-touch)

## Screenshots

Desktop captures are 1440 px wide. "Full" means the whole page, top to bottom.

| File | Page | URL | Notes |
|---|---|---|---|
| `01-presidents.png` | Presidents | `/` | first screen |
| `02-president-profile.png` | President profile | `/barack-obama` | first screen |
| `03-eo-list-president.png` | Orders for one president, grid | `/barack-obama/executive-orders` | full |
| `04-eo-list-all.png` | Orders, all presidents | `/executive-orders` | full |
| `05-eo-detail-collapsed.png` | Order page, text hidden | `/barack-obama/executive-orders/eo/13636` | first screen |
| `06-eo-detail-full-text.png` | Order page, text shown | `…/eo/13636#sec-1` | full, 10,242 px tall |
| `07-eo-detail-quoted-text.png` | Order page with quoted amendments | `…/eo/13764#sec-1` | full, 23,871 px tall |
| `08-eo-full-text-page.png` | Older "Full Text" page | `…/eo/13636/text` | full |
| `09-timeline.jpg` | Historical timeline | `/timeline` | first screen, taken by hand |
| `10-supreme-court.png` | Natural courts list | `/supreme-court` | full |
| `11-natural-court.png` | One court's cases | `/supreme-court/roberts-8` | full |
| `13-congress.png` | Congresses list | `/congress` | full |
| `14-congress-session.png` | One Congress's bills | `/congress/118` | full |
| `15-bill-detail.png` | Bill page | `/congress/118/hjres/124` | full |
| `16-corpus.png` | Document corpus tree | `/corpus` | first screen |
| `17-case-graph.png` | Case citation graph | `/case-graph` | first screen |
| `18-sources.png` | Data sources | `/sources` | full |
| `19-tags.png` | Tags index | `/tags` | empty state |
| `20-narrow-eo-list.png` | Orders list, 500 px wide | `/barack-obama/executive-orders` | full |
| `21-narrow-eo-detail-full-text.png` | Order page with text, 500 px wide | `…/eo/13636#sec-1` | full |
| `22-eo-list-timeline-view.jpg` | Orders list, Timeline view | `/barack-obama/executive-orders` | first screen, taken by hand |
| `23-eo-detail-pdf-viewer.jpg` | Order page, PDF viewer open | `…/eo/13636` | taken by hand; the PDF had not painted yet |

There is no `12`: the case page crashes (see [Problems](#problems-found-while-capturing)).
Not captured: a tag page with results (`/tags/:word`; no tags exist yet), and hover states.

## Palette

Defined as CSS variables in `client/src/index.css`.

| Variable | Value | Used for |
|---|---|---|
| `--navy` | `#0a1628` | page background; text on gold buttons |
| `--navy-mid` | `#112040` | card and input fill, always translucent (see below) |
| `--navy-light` | `#1a3060` | defined, barely used |
| `--gold` | `#c9a84c` | the accent: labels, numbers, active controls, links, rules |
| `--gold-light` | `#e8c97a` | hover on gold; deadlines and emphasis in order text |
| `--cream` | `#f5f0e8` | headings and body text |
| `--cream-dark` | `#e8e0cc` | text inside quoted blocks |
| `--text-primary` | `#f5f0e8` | same as cream |
| `--text-muted` | `#8899bb` | secondary text, inactive controls, dates |

Two colours do almost all the work, at different opacities, written inline:

- **Gold lines and tints** — `rgba(201,168,76, α)`: 0.15 for card borders and hairlines
  (most common), 0.25 for control borders and the header rule, 0.4–0.5 for hovered borders
  and the preamble rule, 0.1–0.12 for tinted backgrounds (active nav item, number badge).
- **Navy panels** — `rgba(17,32,64, α)`: 0.5–0.6 for cards at rest, 0.8 for inputs and
  hovered cards, 0.9 for the strongest hover.

Colours outside the palette, each tied to a meaning:

| Colour | Meaning | Where |
|---|---|---|
| `#93c5fd` blue, `#fca5a5` red, `#86efac` green | Democratic, Republican, Independent | Congress, bill cards, bill page |
| `#86efac` green | "Enacted laws" filter | Congress session |
| blue / gold / purple badges (`#93c5fd`, gold, `#c4b5fd`) | legislative, executive, judicial branch | Corpus tree |
| `#818cf8` indigo, `#34d399` green | judicial and legislative source accents | Data sources |
| green / rose / gold status chips | no key needed / token needed / API key needed | Data sources |
| `#e88` on `rgba(192,57,43,0.1)` | error messages | every page |

## Typography

Three families from Google Fonts, loaded in `index.css`.

| Family | Role | Typical settings |
|---|---|---|
| **Playfair Display** (serif) | page titles, big counts, card titles on list-of-lists pages, the logo | weight 900 for titles, 700 for names; `clamp(2rem, 5vw, 3.5rem)` on list pages |
| **IBM Plex Sans** | body text, order and bill titles, descriptions | 300 for intro paragraphs and long text, 500–600 for titles |
| **IBM Plex Mono** | everything small: nav, eyebrow labels, order numbers, dates, buttons, filters, pagination, counts | 0.6–0.75 rem, letter-spacing 0.05–0.15 em, usually uppercase |

Mono is the most used family by far (168 inline uses, against 44 for Sans and 31 for
Playfair). The recurring "label" is mono, about 0.7 rem, uppercase, wide letter-spacing,
in gold.

Order detail pages use a sans-serif title (IBM Plex Sans, bold), not Playfair; that was a
deliberate later change, as were sans-serif titles on order cards.

## Layout

- **Header:** sticky, 64 px tall, translucent navy with a blur, gold hairline beneath.
  Content is capped at 1200 px. Logo left, nine nav links right.
- **Page container:** a centred `<main>` with a max width chosen per page:

  | Width | Pages |
  |---|---|
  | 1400 px | Timeline |
  | 1200 px | order lists, court's cases, Congress session |
  | 960 px | Data sources |
  | 900 px | Presidents, Supreme Court, Congress (lists of lists) |
  | 820 px | order page, full-text page, bill page, case page, president profile |
  | 800 px | Tags |

  Padding is `3rem 2rem` on working pages and `5rem 2rem` on the landing-style lists.
- **Card grids:** `repeat(auto-fill, minmax(480px, 1fr))`, 1 rem gap, equal-height rows.
  Two columns at desktop width, one below about 1000 px.
- **Corners:** small. 3 px on buttons, chips and controls; 4 px on cards and inputs; 6 px
  on the large list cards.
- **No shadows.** Depth comes from translucent navy fills and gold borders.

## Components

| Component | Appearance | Source |
|---|---|---|
| **Logo** | gold ring with a star, "GovLens" in Playfair, "PUBLIC RECORDS" in gold mono | `Header.jsx` |
| **Nav link** | mono 0.7 rem, muted; active link is gold on a faint gold fill | `Header.jsx` |
| **Back link** | "← Barack Obama", mono, muted, turns gold on hover | each page |
| **Eyebrow** | gold mono uppercase line above the title ("BARACK OBAMA · FEDERAL REGISTER") | each page |
| **Page title + count** | Playfair 900 title left; gold Playfair number right with a tiny mono label ("TOTAL") | list pages |
| **Search box** | translucent navy fill, gold border at 0.25 that brightens on focus, magnifier glyph | list pages |
| **Segmented toggle** | joined mono buttons; the active one is solid gold with navy text (Grid / Timeline) | `Home.jsx` |
| **Filter chip** | bordered mono button; active is solid gold (years, sort, presidents) | list pages |
| **Order card** | navy panel, gold hairline border, 3 px gold gradient bar down the left edge, mono "E.O. 13764" in gold, sans title clamped to two lines, mono date top right, small gold arrow bottom right; lifts 1 px and brightens on hover | `ExecutiveOrderCard.jsx` |
| **List-of-lists card** | wide panel with a large faint gold Playfair numeral on the left (44th, 118, court number), a divider, then name, years and description, arrow on the right | `Presidents.jsx`, `SupremeCourt.jsx`, `Congress.jsx` |
| **Number badge** | "EXECUTIVE ORDER 13636": gold mono on a faint gold fill with a gold border | `Detail.jsx` |
| **Fact pair** | tiny gold mono label over a cream value (Signed, President) | detail pages |
| **Primary button** | solid gold, navy mono text, 3 px radius ("View on Federal Register ↗") | `Detail.jsx` |
| **Secondary button** | transparent, gold border and gold mono text (Show full text, Show PDF, PDF ↗) | `Detail.jsx` |
| **Pagination** | centred row of bordered mono buttons, current page solid gold | `Pagination.jsx` |
| **Tag box** | small input with a gold "Tag" button | `TagPanel.jsx` |
| **Error box** | red-tinted panel with pale red mono text | each page |
| **Loading** | pulsing mono text, "Loading records…" | each page |

## Pages

- **Presidents (`/`)** — eyebrow, Playfair title, intro, then one wide card per
  administration with a faint ordinal numeral.
- **President profile (`/:slug`)** — back link, name, then cards for each document type
  (Executive Orders, Presidential Memoranda).
- **Order list (`/:slug/executive-orders`)** — back link, eyebrow, title with total count,
  intro, then a control row (search, Grid/Timeline toggle, year chips), a second row
  (result count, sort), a two-column card grid, and pagination (20 per page).
  The Timeline view replaces the grid with a vertical gold rail, year headings in Playfair
  and full-width rows.
- **All orders (`/executive-orders`)** — same as above with president chips added and the
  president shown on each card.
- **Order page (`…/eo/:number`)** — back link, number badge, title, Signed and President,
  a rule, the four buttons, then (when shown) the PDF viewer and the formatted text, then
  the tag box. See [Executive order text](#executive-order-text).
- **Older full-text page (`…/eo/:number/text`)** — the Federal Register's HTML injected as
  is and styled by `.eo-full-text`. Still reachable; the order page links to it only when
  an order has no stored text.
- **Supreme Court, Congress** — list-of-lists pages like Presidents, then a card grid for
  one court or one Congress with search and filter chips. Bill cards carry party-coloured
  sponsor chips; the bill page has a progress tracker and an action history.
- **Timeline** — the widest page: toggles for presidential actions and court cases, a
  range slider, and a horizontally scrolling dot timeline in a panel.
- **Corpus** — a tree diagram of federal document types, colour-coded by branch.
- **Case graph** — a full-width citation graph on a lighter navy panel with a legend.
- **Sources** — one card per data source, grouped by branch, with status chips.
- **Tags** — a plain list; currently an empty state.

## Executive order text

Rendered by `OrderText.jsx` from the stored structure and styled by the `.eo-doc` rules in
`index.css` (the only substantial block of real CSS in the app).

- **Contents rail:** at 1300 px and wider it sits in the left gutter, outside the 820 px
  column, sticky below the header. It is a list on a thin gold-tinted vertical rule; the
  section being read turns gold and bold with a gold segment on the rule. No filled
  highlight. Narrower than 1300 px it becomes a collapsed "Contents +" toggle above the text.
- **Preamble:** slightly larger text with a 3 px gold rule down the left.
- **Section:** a gold mono "SECTION 1" label, then the title in bold sans (1.4 rem). No
  boxes or rules.
- **Items:** the marker, (a) or 1., in gold mono in a narrow left column; the text beside
  it. Sub-items are indented 1.75 rem per level.
- **Quoted provisions:** a block with a gold left rule and a slightly lighter navy fill;
  the opening quotation mark hangs in the margin.
- **Deadlines:** gold-light text, medium weight. No background.
- **Citations:** gold links with a faint underline.
- **Signature:** right-aligned, name in spaced capitals.
- **Cited in this order:** a navy panel of gold pill links, grouped by type.
- **Source note:** small muted text with links to the Federal Register and govinfo.

## How the styling is implemented

This matters more than the colours for anyone changing the design.

- **Almost everything is inline.** There are 513 `style={{…}}` props across pages and
  components and only 26 `className` uses. Colours, font families, sizes and spacing are
  repeated literally in each file.
- **Hover is done in JavaScript.** 39 `onMouseEnter` / `onMouseLeave` handlers set
  `style` properties directly, because inline styles cannot express `:hover`.
- **The CSS variables are only partly used.** `var(--gold)` and friends appear in inline
  styles, but the translucent versions are hardcoded as `rgba(201,168,76,…)` and
  `rgba(17,32,64,…)` in about 200 places, so changing `--gold` alone would not re-theme
  the borders and tints.
- **Tailwind is installed and imported but not used:** no utility classes appear anywhere.
  Every class name in the app belongs to the order-text rules.
- **One media query in the whole app** (the contents rail at 1300 px). Responsiveness
  otherwise comes from `clamp()` on titles, `auto-fill` grids and wrapping flex rows. The
  header does not adapt: at 500 px the nine nav links run off the right edge (see
  `20-narrow-eo-list.png`).
- **Shared look, not shared code.** The eyebrow, title block, chips, search box and cards
  are re-written on each page with the same values; only `ExecutiveOrderCard`, `BillCard`,
  `CaseCard`, `Pagination`, `TagPanel`, `Header`, `OrderText` and `OrderOutline` are
  components.

## Problems found while capturing

- **The case page crashes.** `/supreme-court/:courtSlug/:caseId` renders a blank page:
  `ReferenceError: scotusCase is not defined` in `CaseDetail.jsx`. The API returns the case
  correctly. There is no error boundary, so the header disappears too.
- **The timeline is slow.** It loads every Supreme Court case for the period; one court's
  cases took 48 seconds to fetch when not cached.
- **The header overflows on narrow windows**, as noted above.
- **The all-orders count (1,570) and the Obama count (294) include correction notices**
  and unnumbered documents, not only executive orders.

## What a redesign has to touch

1. `client/src/index.css` — the variables, the fonts import, `.eo-full-text` and `.eo-doc`.
2. `Header.jsx` — logo and nav, all inline.
3. Every file in `client/src/pages/` and the card components — their inline colours,
   fonts and hover handlers. Searching for `rgba(201,168,76`, `rgba(17,32,64`,
   `Playfair Display` and `IBM Plex Mono` finds nearly all of it.
4. The semantic colours (party, branch, status) are independent of the navy theme and can
   stay or be re-mapped separately.

Moving the repeated inline values into shared classes or components first would make the
change of design, and any later one, far smaller.
