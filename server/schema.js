export const typeDefs = `#graphql
  scalar JSON

  type ExecutiveOrder {
    number: String
    # Federal Register document number; the only identifier a memorandum has.
    documentNumber: String
    # Federal Register citation, e.g. "82 FR 7629".
    citation: String
    title: String
    dateSigned: String
    abstract: String
    url: String
    fullTextUrl: String
    bodyHtmlUrl: String
    pdfUrl: String
    topics: [String]
    year: Int
    president: String
    body: String
    structure: JSON
  }

  # A word applied by hand to any item (server/tags.js). count: items carrying it.
  type Tag {
    id: Int!
    word: String!
    description: String
    count: Int
    createdAt: String
  }

  # An item a tag is on, by ref ("fr:2025-06063", "bill:119-HR-1", "scotus:25-332",
  # "usc:/us/usc/t19/s1862", "report:9-11-commission"). kind is null if the item is not stored.
  type TaggedItem {
    ref: String!
    kind: String
    label: String
    title: String
    date: String
    href: String
    note: String
  }

  type TagPageResult {
    tag: Tag!
    items: [TaggedItem!]!
  }

  type ExecutiveOrderPage {
    orders: [ExecutiveOrder!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type YearCount {
    year: Int!
    count: Int!
  }

  type NaturalCourt {
    slug: String!
    name: String!
    chiefJustice: String!
    startDate: String!
    endDate: String
    justices: [String!]!
    description: String
  }

  # A decision in a list. \`id\` is its address within the court (the docket: "25-332").
  type ScotusCase {
    id: String!
    caseName: String!
    dateFiled: String
    citation: String
    docketNumber: String
    year: Int
    kind: String
    disposition: String
    votesMajority: Int
    votesMinority: Int
    # Not stored yet (the Supreme Court Database is not linked); always null.
    decisionDirection: String
  }

  type ScotusCasePage {
    cases: [ScotusCase!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
    # False when no decisions of this natural court have been loaded yet.
    loaded: Boolean!
  }

  # One decision of a court (court_decisions), with its stored text.
  type CourtDecision {
    id: String!
    court: String!
    slug: String!            # address within the court: "25-332"
    naturalCourt: String     # slug of the natural court: "roberts-8"
    name: String!
    docketNumbers: [String!]!
    dateArgued: String
    dateDecided: String!
    kind: String!            # "argued" | "per_curiam" | "original"
    citation: String         # "592 U.S. 261" once paginated
    slipCitation: String     # "609 U. S. ___ (2026)"
    disposition: String
    voteMajority: Int
    voteMinority: Int
    voteInferred: Boolean
    pdfUrl: String
    # Everything but the opinions' text: caption, outcome, syllabus, citations, opinions' outlines.
    structure: JSON
    votes: [CourtVote!]!
    # A CourtListener record of the decision, for an outbound link (not fetched).
    courtListenerUrl: String
    # The decision's node in the case graph, if it is in it.
    caseGraphId: Int
  }

  type CourtVote {
    personId: String!
    name: String!            # surname, as the outcome names the Justice
    side: String!
    wrote: [String!]!
    joined: JSON
  }

  type Congress {
    number: Int!
    name: String!
    startYear: Int!
    endYear: Int!
    senate: String
    house: String
    description: String
  }

  type BillSponsor {
    fullName: String
    party: String
    state: String
    bioguideId: String
    # The sponsor as a person (/people/:id), where the Bioguide id is known.
    personId: String
  }

  # One term in office as published, or part of one when the party changed during it.
  type PersonRole {
    roleType: String!
    start: String
    end: String
    party: String
    caucus: String
    state: String
    district: Int
    senateClass: Int
    chamber: String
  }

  type PartySpell {
    party: String
    start: String
    end: String
  }

  # How much is stored for a stint (votes and bills only for the Congresses loaded).
  type StintCounts {
    votes: Int!
    sponsored: Int!
    cosponsored: Int!
    signed: Int!
    vetoed: Int!
    orders: Int!
    memoranda: Int!
  }

  # Consecutive terms in the same office for the same state: "Representative, Florida, 2007 – present".
  type PersonStint {
    key: String!
    roleType: String!
    chamber: String
    state: String
    start: String
    end: String
    current: Boolean!
    terms: Int!
    districts: [Int!]!
    parties: [PartySpell!]!
    # For a Justice: the president who made the appointment.
    appointedBy: String
    # Congresses with votes or bills stored for this stint, newest first.
    congresses: [Int!]!
    counts: StintCounts!
    # For a presidency: the slug of its existing page (/barack-obama), where there is one.
    presidentSlug: String
  }

  type Person {
    id: String!
    name: String!
    sortName: String
    gender: String
    birthDate: String
    deathDate: String
    bioguideId: String
    lisId: String
    wikidataId: String
    # govtrack, icpsr, opensecrets, fec, wikipedia, ballotpedia, …
    otherIds: JSON
    roles: [PersonRole!]!
    # Newest first.
    stints: [PersonStint!]!
  }

  type BillRef {
    congress: Int!
    type: String!
    number: String!
    title: String
  }

  # One member's answer in one roll call.
  type PersonVote {
    rollCallId: String!
    date: String
    chamber: String!
    congress: Int!
    session: Int!
    rollNumber: Int!
    question: String
    result: String
    amendment: String
    position: String!
    party: String
    bill: BillRef
  }

  type PersonVotePage {
    votes: [PersonVote!]!
    totalCount: Int!
    # Count of each position across all pages: [{ position, count }]
    positions: JSON
  }

  type PersonBill {
    bill: BillRef!
    introducedDate: String
    sponsorshipDate: String
    isOriginal: Boolean
    withdrawnDate: String
    latestAction: String
    latestActionDate: String
  }

  type PersonBillPage {
    bills: [PersonBill!]!
    totalCount: Int!
  }

  type PresidentialAction {
    date: String
    # 'signed' | 'vetoed' | 'pocket vetoed'
    action: String!
    bill: BillRef!
    law: String
  }

  type PersonSummary {
    id: String!
    name: String!
    sortName: String
    # The latest role
    roleType: String
    state: String
    party: String
    start: String
    end: String
    current: Boolean!
    # Kinds of office held, e.g. ["representative", "senator"]
    roleTypes: [String!]!
  }

  type PeoplePage {
    people: [PersonSummary!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type BillAction {
    actionDate: String
    text: String
    type: String
    actionCode: String
  }

  type BillTextFormat {
    type: String
    url: String
  }

  type BillTextVersion {
    type: String
    date: String
    formats: [BillTextFormat!]
  }

  # One enacted law. The statute citation and slip law exist once GPO has published it on govinfo.
  type TimelineEvent {
    id: String!
    kind: String!     # eo | memo | law | report | scotus | fomc
    date: String!
    title: String!
    label: String     # "EO 14160", "Pub. L. 119-21", "25-332"
    href: String      # the page in this app; null where there is none (Bush orders)
  }

  # An economic time series (economic_series): oil and fuel prices (EIA), unemployment (BLS), GDP (BEA), federal debt (Treasury), as each publisher prints them.
  type EconomicSeries {
    slug: String!         # "wti-spot"
    source: String!       # "eia"
    sourceId: String!     # the publisher's series id: "RWTC"
    frequency: String!    # daily | weekly | monthly | annual
    name: String!         # "WTI crude oil"
    description: String   # written by GovGraph
    publisherTitle: String     # the publisher's own title, verbatim from its files: "Cushing, OK WTI Spot Price FOB (Dollars per Barrel)"
    publisherTitleFrom: String # the file and field it was read from: "EIA API v2, series-description"
    category: String      # crude | retail | unemployment | gdp | debt | inflation | housing | …
    unit: String!         # "$/bbl", "$/gal", "%", "thousands", "$bn"
    firstDate: String
    lastDate: String
    # Oldest first, between from and to (YYYY-MM-DD, either optional). resample: week | month | year
    # averages each period, dated by its first day; ignored for a series that coarse already.
    observations(from: String, to: String, resample: String): [EconomicObservation!]!
    # The same measure for groups of people, as the publisher breaks it down (unemployment by sex,
    # race and ethnicity, age, education): one published series each. Empty for most series.
    breakdowns: [EconomicBreakdown!]!
    # Demographic series (lib/population/series.js): the national series' slug the series belongs to,
    # and its place ('ca', 'ca-12-l113'; null for the nation). Both null for economic series.
    measure: String
    place: String
    # What the series is, as dimensions (lib/series-dimensions.js): { measure, form, frequency, publisher,
    # and the breakdowns that apply: revenue_source, flow, sex, … }. Null for demographic series.
    dimensions: JSON
  }

  # One place a demographic measure is published for (seriesPlaces).
  type SeriesPlace {
    slug: String!         # the series: "median-age--ca-12-l113"
    place: String         # null for the nation
    level: String!        # nation | state | district
    name: String!         # the series' name
    label: String!        # the place: "United States", "California", "California District 12 (113th–117th Congress Lines)"
    firstDate: String
    lastDate: String
  }

  # One published breakdown of a series: its slug and the group, by dimension (null = not split by it).
  type EconomicBreakdown {
    slug: String!
    sex: String         # men | women
    race: String        # white | black | asian | hispanic (Hispanic or Latino, of any race)
    age: String         # 16-19 | 20-24 | 25-34 | 35-44 | 45-54 | 55-over
    education: String   # no-diploma | high-school | some-college | bachelors (25 and over)
    ages: String        # the ages covered where not 16 and over: "20 years and over"
  }

  type EconomicObservation {
    date: String!
    value: Float!
  }

  # Where the data comes from (seed/data/sources.json; server/sources.js). An organization publishes
  # programs; a program's files are what was downloaded into the data folder.
  type SourceOrganization {
    slug: String!
    name: String!
    shortName: String!
    kind: String!          # federal | federal-reserve-bank | government-sponsored | international | academic | …
    kindLabel: String!
    branch: String         # federal bodies: executive | legislative | judicial
    parent: String
    parentName: String
    url: String
    notes: String
  }

  type ProgramOrganization {
    role: String!          # publisher | producer | distributor | former-publisher
    organization: SourceOrganization!
  }

  # A predecessor body and its successor (to is null when it was abolished); href once the document is loaded.
  type SourceLineage {
    from: String!
    fromName: String!
    to: String
    toName: String
    date: String!
    kind: String!          # renamed | merged | transferred | split | abolished
    citation: String
    document: String
    href: String
    notes: String
  }

  type SourceFolder {
    path: String!
    count: Int!
    bytes: Float!
    lastModified: String
  }

  type SourceFile {
    path: String!          # in the data folder
    size: Float!
    sha256: String!
    modifiedAt: String!
    url: String
    urlInferred: Boolean!  # guessed from the path, not recorded when fetched
    archive: String        # Internet Archive capture it came from
    fetchedAt: String
  }

  type ProgramSeries {
    slug: String!
    name: String!
    frequency: String!
    unit: String!
    firstDate: String
    lastDate: String
  }

  # A table of the 2012 Statistical Abstract and how much of what it prints GovGraph holds
  # (seed/data/statistical-abstract-coverage.json; lib/abstract-coverage.js). Read from the files, not the database.
  type AbstractTable {
    id: String!            # the table number, "724"
    section: Int!
    category: String!      # its subsection in taxonomies/statistical-abstract.json
    categoryName: String
    page: Int
    title: String!
    online: Boolean!
    url: String
    coverage: String       # have | partly | wanted | licensed | discontinued | unpublished | compiled
    shape: String          # time-series | by-place | snapshot
    inHand: Boolean!       # the publisher's file is in the data folder, not yet loaded
    note: String
    programs: [AbstractTableProgram!]!
  }

  type AbstractTableProgram {
    slug: String!
    name: String!
    licence: String
    collected: Boolean!
  }

  type AbstractSection {
    number: Int!
    id: String!
    name: String!
  }

  type AbstractCoverage {
    sections: [AbstractSection!]!
    tables: [AbstractTable!]!
  }

  type SourceProgram {
    slug: String!
    name: String!
    kind: String!          # statistics | documents
    kindLabel: String!
    description: String!
    homepage: String!
    licence: String!       # public-domain | open-licence | free-with-terms | licensed | unchecked
    licenceLabel: String!
    licenceDetail: JSON    # { name, url, checked, attribution, limits, note }
    accessUsed: [String!]! # bulk | file | api | api-key | page | archive
    accessBest: String
    accessKey: String
    accessContact: Boolean!
    accessNote: String
    status: String!        # active | final | discontinued | moved
    statusLabel: String!
    ended: String
    successor: String
    successorName: String
    collected: Boolean!
    inAbstract: Boolean    # cited in the 2012 Statistical Abstract; null until compared
    outsideAbstract: String
    paths: [String!]!
    notes: String
    organizations: [ProgramOrganization!]!
    lineage: [SourceLineage!]
    fileCount: Int!
    fileBytes: Float!
    lastModified: String
    seriesCount: Int!
    abstractTableCount: Int!
    abstractTables: [AbstractTable!]!
    folders(limit: Int): [SourceFolder!]!
    series(limit: Int): [ProgramSeries!]!
  }

  # A report of an investigation (reports; seed/data/reports.json): a commission's, a congressional
  # inquiry's, a special counsel's. The text is read once into parts (reportPart).
  type Report {
    slug: String!
    kind: String!          # commission | congressional | special_counsel
    kindLabel: String!
    title: String!         # as published
    shortTitle: String
    issuer: String!
    issuerShort: String
    dateIssued: String!
    sourceId: String       # govinfo package id: "GPO-911REPORT"
    sourceUrl: String      # where the text was read from
    govinfoUrl: String
    # What created the body that wrote it, and the laws that followed: [{ relation: created_by | followed_by,
    # citation, title, date, document, url, notes, href }]; href is the page in this app once loaded.
    related: JSON
    # parts: [{ id, kind, number, title, label, note, pdf_url, sections: [{ id, number, heading, opening }],
    # note_count }], recommendations: [{ id, part, section, text }], counts, source
    structure: JSON
    counts: JSON           # in the list only: { chapters, notes, recommendations }
  }

  # A dated period drawn on the timeline (periods; seed/data/periods.json): a recession or an emergency.
  # Each end names who determined it and the document; *Href is its page in this app once loaded.
  type Period {
    slug: String!
    kind: String!          # recession | public_health_emergency | national_emergency
    name: String!
    start: String!
    end: String            # null while ongoing
    startBy: String
    startSource: String
    startUrl: String
    startHref: String
    endBy: String
    endSource: String
    endUrl: String
    endHref: String
    notes: String
  }

  # One presidential term as published (a re-elected president has one per term).
  type PresidentialTerm {
    personId: String!
    name: String!         # "Joseph R. Biden, Jr."
    lastName: String      # "Biden"
    party: String         # "Democrat" | "Republican" | …
    how: String           # "election" | "succession"
    start: String!
    end: String           # the scheduled end for the sitting president
    href: String!         # the person's page in this app
  }

  type EnactedLaw {
    number: String!          # "119-117"
    lawType: String!         # "pub" | "priv"
    statuteCitation: String  # "140 Stat. 1061"
    slipLawUrl: String       # the slip law PDF on govinfo
    detailsUrl: String
    date: String             # the date it became law
    bill: EnactedLawBill!
  }

  type EnactedLawBill {
    congress: Int!
    type: String!
    number: String!
    title: String
  }

  type Bill {
    id: String!
    number: String!
    type: String!
    congress: Int!
    title: String
    introducedDate: String
    latestActionDate: String
    latestActionText: String
    sponsor: BillSponsor
    policyArea: String
    url: String
    year: Int
    actions: [BillAction!]
    textVersions: [BillTextVersion!]
    # Text versions that have been parsed and stored (see seed/load-bill-text.js), newest first.
    textDocuments: [BillTextDocument!]
    # Recorded votes taken on the bill and its amendments (see seed/load-roll-calls.js).
    rollCalls: [RollCall!]
    # The other bills of its proposal: an identical bill in the other chamber (lib/proposals.js).
    companions: [Bill!]
    # In search results: the title the search matched, where it is not the bill's own title
    # (e.g. a popular or short title), and its type in Congress.gov's wording.
    matchedTitle: String
    matchedTitleType: String
    # Bills related to it, from Congress.gov's bill status files or added by us.
    relatedBills: [BillRelationship!]
  }

  type BillRelationship {
    congress: Int!
    type: String!          # upper case, e.g. "HR"
    number: String!
    title: String
    relationship: String!  # Congress.gov's wording ("Identical bill", "Related bill", …) or ours
    identifiedBy: String   # "CRS" | "House" | "Senate" | GPO | "manual"
    source: String!        # "congress.gov" | "govgraph"
    note: String           # ours: why the link exists
    loaded: Boolean!       # the related bill is in the database (has a page here)
  }

  # One question put to a chamber. Members' individual votes come from rollCallMembers.
  type RollCall {
    id: String!
    chamber: String!
    congress: Int!
    session: Int!
    rollNumber: Int!
    date: String
    question: String
    description: String
    result: String
    yea: Int!
    nay: Int!
    present: Int!
    notVoting: Int!
    tieBreaker: JSON
    amendment: String
    sourceUrl: String
    # Counts by party and position: [{ party, position, count }]
    breakdown: JSON
  }

  type BillTextDocument {
    # govinfo package id, e.g. BILLS-119hr1enr
    packageId: String!
    code: String
    label: String
    date: String
    sectionCount: Int
  }

  type BillPage {
    bills: [Bill!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
    # The order used: "introduced" | "introduced-oldest" (from the database, where the
    # Congress's bill history is loaded) or "newest" | "oldest" (Congress.gov, by record update).
    order: String
    # Bills matching, where rows are proposals (identical House and Senate bills share a row,
    # so totalCount counts rows); null from Congress.gov.
    billCount: Int
  }

  # Search results (billSearch): rows are proposals where they are built, as in BillPage.
  type BillSearchPage {
    bills: [Bill!]!
    totalCount: Int!
    billCount: Int!
    currentPage: Int!
    totalPages: Int!
    # The bill or law number the search was read as, or null for a search by words:
    # { kind: "bill", congress?, type, number } | { kind: "law", lawType, congress, number }
    identifier: JSON
    # Bills matching in each Congress, newest first (filters other than congress applied).
    congressCounts: [CongressCount!]!
  }

  type CongressCount {
    congress: Int!
    count: Int!
  }

  type CaseGraphNode {
    id: String!
    name: String!
    court: String
    year: Int
    url: String
    isSeed: Boolean
  }

  type CaseGraphEdge {
    source: String!
    target: String!
    treatment: String
    isDirect: Boolean
  }

  type CaseGraph {
    nodes: [CaseGraphNode!]!
    edges: [CaseGraphEdge!]!
  }

  type Query {
    executiveOrders(
      president: String
      documentType: String
      page: Int
      perPage: Int
      search: String
      year: Int
      order: String
    ): ExecutiveOrderPage!

    # How many documents the same filters return for each of the given signing years.
    executiveOrderYearCounts(
      president: String
      documentType: String
      search: String
      years: [Int!]!
    ): [YearCount!]!

    executiveOrder(number: String!): ExecutiveOrder
    # Any presidential document (e.g. a memorandum) by Federal Register document number.
    presidentialDocument(documentNumber: String!): ExecutiveOrder
    executiveOrderText(number: String!): String

    naturalCourts: [NaturalCourt!]!
    naturalCourt(slug: String!): NaturalCourt

    scotusCases(
      courtSlug: String!
      page: Int
      perPage: Int
      search: String
      orderBy: String
      year: Int
    ): ScotusCasePage!

    # A decision by court and address ("scotus", "25-332").
    courtDecision(court: String!, slug: String!): CourtDecision
    # The decision a CourtListener record belongs to (old links used CourtListener ids).
    courtDecisionByCourtListenerId(id: String!): CourtDecision
    # One opinion of a decision (its sections and footnotes), by its id in the structure.
    decisionOpinion(decisionId: String!, opinionId: String!): JSON

    allScotusCases(courtSlug: String!): [ScotusCase!]!

    # Every stored executive order, memorandum, enacted law, Supreme Court decision and FOMC target
    # change and report of the given kinds ("eo", "memo", "law", "scotus", "fomc", "report"), oldest first.
    timelineEvents(kinds: [String!]!): [TimelineEvent!]!

    presidentialTerms: [PresidentialTerm!]!
    periods: [Period!]!

    # Reports of investigations (server/reports.js), newest first; one with its outline; one part's
    # text ({ sections: [{ id, number, heading, items }], notes: [{ id, number, items }] }).
    reports: [Report!]!
    report(slug: String!): Report
    reportPart(slug: String!, partId: String!): JSON

    # Where the data comes from: every program (in the order of sources.json), one program, and the
    # labels of the sources' values ({ organizationKinds, programKinds, licences, access, statuses }).
    sourcePrograms: [SourceProgram!]!
    sourceProgram(slug: String!): SourceProgram
    # A program's files, in path order; with folder, only those directly in it.
    sourceFiles(program: String!, folder: String, limit: Int): [SourceFile!]!
    sourceVocabulary: JSON
    abstractCoverage: AbstractCoverage!

    economicSeriesList: [EconomicSeries!]!
    economicSeries(slug: String!): EconomicSeries
    economicSeriesSet(slugs: [String!]!): [EconomicSeries!]!   # several at once, in the order asked
    # The dimensions series are labelled with and their values, and the measures with their breakdowns:
    # { dimensions: { form: { label, values: { level: { label, parent? } } } }, measures: { … } }
    seriesDimensionVocabulary: JSON
    # Every place a demographic measure is published for: the nation, states, then districts by state.
    seriesPlaces(measure: String!): [SeriesPlace!]!

    congresses: [Congress!]!

    # Population (server/population.js): Census Bureau files as published, read from the data
    # directory. Collections with their files on disk; one file a page at a time.
    populationCollections: JSON
    populationFile(path: String!, offset: Int, limit: Int, sheet: Int): JSON
    # The American Community Survey: years and tables on disk, a year's places, one table for one place.
    acsYears: JSON
    acsGeographies(year: Int!): JSON
    acsTable(year: Int!, geoid: String!, table: String!): JSON

    # The U.S. Code (server/usc.js). Titles in reading order: [{ number, label, name,
    # positiveLaw, appendix, sectionCount, release }]
    uscTitles: JSON
    # A title and its outline of containers, each with its count and range of sections.
    uscTitle(number: String!): JSON
    # The units directly under a container or title, by USLM identifier ("/us/usc/t10/stA/ptII/ch55").
    uscChildren(identifier: String!): JSON
    # One section by address (/code/10/1074c): text, source credit, notes, place in the outline.
    uscSection(title: String!, section: String!): JSON

    # Every member's vote in one roll call: [{ name, party, state, position, bioguideId }]
    rollCallMembers(id: String!): JSON

    # One stored text version without its section text: title, version, outline,
    # citations and an index of sections (position, id, length).
    billText(packageId: String!): JSON
    # Section text for a stored version, \`count\` sections in reading order starting at \`from\`.
    billTextSections(packageId: String!, from: Int!, count: Int!): JSON

    bills(
      congress: Int!
      billType: String
      page: Int
      perPage: Int
      search: String
      year: Int
      order: String
    ): BillPage!

    # Bills by number ("H.R. 1", "P.L. 119-21") or by any title they have been known by,
    # best match first; every Congress loaded unless one is given.
    billSearch(query: String!, congress: Int, billType: String, year: Int, page: Int, perPage: Int): BillSearchPage!

    laws(
      congress: Int!
      lawType: String
      page: Int
      perPage: Int
    ): BillPage!

    # Every law a Congress enacted, as Congress.gov lists them under "Statutes at Large and
    # Public Laws". \`lawType\`: "pub" (default) or "priv". Newest law first.
    enactedLaws(congress: Int!, lawType: String): [EnactedLaw!]!

    bill(congress: Int!, billType: String!, billNumber: String!): Bill

    person(id: String!): Person
    # sort: name (default) | start_desc | start_asc | end_desc | end_asc, by the latest office's dates
    people(search: String, roleType: String, current: Boolean, party: String, state: String, sort: String, page: Int, perPage: Int): PeoplePage!
    # A person's votes, newest first; from/to bound the dates (a stint), position filters.
    personVotes(id: String!, from: String, to: String, congress: Int, position: String, page: Int, perPage: Int): PersonVotePage!
    # Bills a person sponsored (role 'sponsor') or cosponsored ('cosponsor'), newest first.
    personBills(id: String!, role: String!, from: String, to: String, congress: Int, page: Int, perPage: Int): PersonBillPage!
    # Bills signed or vetoed by a president between the dates.
    personPresidentialActions(id: String!, from: String, to: String): [PresidentialAction!]!

    caseGraph(caseId: Int!): CaseGraph!

    tags: [Tag!]!
    tagPage(word: String!): TagPageResult
    tagsForItem(ref: String!): [Tag!]!
  }

  type Mutation {
    # Tags (server/tags.js). applyTag applies an existing tag only; createTag makes one.
    createTag(word: String!, description: String): Tag!
    applyTag(word: String!, ref: String!): Tag!
    removeTag(word: String!, ref: String!): Boolean!
    describeTag(word: String!, description: String): Tag!
    mergeTag(from: String!, into: String!): Tag!
    deleteTag(word: String!): Boolean!
  }
`;
