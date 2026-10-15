import { gql } from '@apollo/client/core';

export const GET_EXECUTIVE_ORDERS = gql`
  query GetExecutiveOrders($president: String, $documentType: String, $page: Int, $perPage: Int, $search: String, $year: Int, $order: String) {
    executiveOrders(president: $president, documentType: $documentType, page: $page, perPage: $perPage, search: $search, year: $year, order: $order) {
      orders {
        number
        documentNumber
        citation
        title
        dateSigned
        abstract
        url
        topics
        year
        president
      }
      totalCount
      currentPage
      totalPages
    }
  }
`;

export const GET_EXECUTIVE_ORDER_YEAR_COUNTS = gql`
  query GetExecutiveOrderYearCounts($president: String, $documentType: String, $search: String, $years: [Int!]!) {
    executiveOrderYearCounts(president: $president, documentType: $documentType, search: $search, years: $years) {
      year
      count
    }
  }
`;

export const GET_EXECUTIVE_ORDER_TEXT = gql`
  query GetExecutiveOrderText($number: String!) {
    executiveOrderText(number: $number)
  }
`;

export const GET_EXECUTIVE_ORDER = gql`
  query GetExecutiveOrder($number: String!) {
    executiveOrder(number: $number) {
      documentNumber
      number
      title
      dateSigned
      abstract
      url
      fullTextUrl
      bodyHtmlUrl
      pdfUrl
      topics
      year
      body
      structure
    }
  }
`;

// A document with no order number (a memorandum), by Federal Register document number.
export const GET_PRESIDENTIAL_DOCUMENT = gql`
  query GetPresidentialDocument($documentNumber: String!) {
    presidentialDocument(documentNumber: $documentNumber) {
      documentNumber
      number
      title
      dateSigned
      abstract
      url
      fullTextUrl
      bodyHtmlUrl
      pdfUrl
      topics
      year
      body
      structure
    }
  }
`;

export const GET_NATURAL_COURTS = gql`
  query GetNaturalCourts {
    naturalCourts {
      slug
      name
      chiefJustice
      startDate
      endDate
      justices
      description
    }
  }
`;

export const GET_SCOTUS_CASES = gql`
  query GetScotusCases($courtSlug: String!, $page: Int, $perPage: Int, $search: String, $orderBy: String, $year: Int) {
    scotusCases(courtSlug: $courtSlug, page: $page, perPage: $perPage, search: $search, orderBy: $orderBy, year: $year) {
      cases {
        id
        caseName
        dateFiled
        citation
        docketNumber
        year
        kind
        disposition
        votesMajority
        votesMinority
        decisionDirection
      }
      totalCount
      currentPage
      totalPages
      loaded
    }
  }
`;

// Every economic series stored, without values: the name each is shown by, and what the timeline's
// catalogue and lanes need to place it (unit, frequency, years covered).
export const GET_SERIES_LIST = gql`
  query GetSeriesList {
    economicSeriesList { slug name description unit frequency category source firstDate lastDate }
  }
`;

// The same list with each series' dimensions, and the vocabulary they are labelled in (SeriesBuilder).
export const GET_SERIES_DIMENSIONS = gql`
  query GetSeriesDimensions {
    seriesDimensionVocabulary
    economicSeriesList { slug dimensions }
  }
`;

// An economic series (oil and fuel prices) with its values, averaged per week when resample is "week".
export const GET_ECONOMIC_SERIES = gql`
  query GetEconomicSeries($slug: String!, $from: String, $to: String, $resample: String) {
    economicSeries(slug: $slug) {
      slug
      source
      name
      description
      sourceId
      unit
      frequency
      firstDate
      lastDate
      publisherTitle
      publisherTitleFrom
      observations(from: $from, to: $to, resample: $resample) {
        date
        value
      }
      breakdowns { slug sex race age education ages }
    }
  }
`;

// Breakdowns of a series drawn together (unemployment for Black women, White men, …).
export const GET_ECONOMIC_SERIES_SET = gql`
  query GetEconomicSeriesSet($slugs: [String!]!, $resample: String) {
    economicSeriesSet(slugs: $slugs) {
      slug source name description sourceId unit frequency firstDate lastDate publisherTitle publisherTitleFrom
      observations(resample: $resample) { date value }
    }
  }
`;

// Every place a demographic measure is published for (the place picker on Demographic Data).
export const GET_SERIES_PLACES = gql`
  query GetSeriesPlaces($measure: String!) {
    seriesPlaces(measure: $measure) { slug place level label firstDate lastDate }
  }
`;

// Several series over one period (the Economy page, when more than one is chosen).
export const GET_ECONOMIC_SERIES_RANGE = gql`
  query GetEconomicSeriesRange($slugs: [String!]!, $from: String, $to: String, $resample: String) {
    economicSeriesSet(slugs: $slugs) {
      slug source name description sourceId unit frequency firstDate lastDate
      observations(from: $from, to: $to, resample: $resample) { date value }
    }
  }
`;

// The two bounds of a band (the FOMC target range), whole: few values, and the first needed may
// come before the period shown.
export const GET_ECONOMIC_BAND = gql`
  query GetEconomicBand($lower: String!, $upper: String!) {
    lower: economicSeries(slug: $lower) {
      slug source sourceId name description frequency firstDate publisherTitle publisherTitleFrom
      observations { date value }
    }
    upper: economicSeries(slug: $upper) { observations { date value } }
  }
`;

// Recessions and emergencies drawn on the timeline, with who determined each end and the document.
export const GET_PERIODS = gql`
  query GetPeriods {
    periods {
      slug
      kind
      name
      start
      end
      startBy
      startSource
      startUrl
      startHref
      endBy
      endSource
      endUrl
      endHref
      notes
    }
  }
`;

// Every presidential term, for the timeline's presidencies strip.
export const GET_PRESIDENTIAL_TERMS = gql`
  query GetPresidentialTerms {
    presidentialTerms {
      personId
      name
      lastName
      party
      how
      start
      end
      href
    }
  }
`;

export const GET_TIMELINE_EVENTS = gql`
  query GetTimelineEvents($kinds: [String!]!) {
    timelineEvents(kinds: $kinds) {
      id
      kind
      date
      title
      label
      href
    }
  }
`;

export const GET_CONGRESSES = gql`
  query GetCongresses {
    congresses {
      number
      name
      startYear
      endYear
      senate
      house
      description
    }
  }
`;

export const GET_BILLS = gql`
  query GetBills($congress: Int!, $billType: String, $page: Int, $perPage: Int, $search: String, $year: Int, $order: String) {
    bills(congress: $congress, billType: $billType, page: $page, perPage: $perPage, search: $search, year: $year, order: $order) {
      bills {
        id
        number
        type
        congress
        title
        introducedDate
        latestActionDate
        latestActionText
        sponsor { fullName party state personId }
        policyArea
        url
        year
        companions { id number type congress title latestActionDate latestActionText sponsor { fullName party state personId } }
      }
      totalCount
      billCount
      currentPage
      totalPages
      order
    }
  }
`;

// Bills by number ("H.R. 1", "P.L. 119-21") or by any title they have been known by; every
// Congress loaded unless one is given.
export const GET_BILL_SEARCH = gql`
  query GetBillSearch($query: String!, $congress: Int, $billType: String, $year: Int, $page: Int, $perPage: Int) {
    billSearch(query: $query, congress: $congress, billType: $billType, year: $year, page: $page, perPage: $perPage) {
      bills {
        id
        number
        type
        congress
        title
        matchedTitle
        matchedTitleType
        introducedDate
        latestActionDate
        latestActionText
        sponsor { fullName party state personId }
        policyArea
        companions { id number type congress title latestActionDate latestActionText sponsor { fullName party state personId } }
      }
      totalCount
      billCount
      currentPage
      totalPages
      identifier
      congressCounts { congress count }
    }
  }
`;

export const GET_BILL = gql`
  query GetBill($congress: Int!, $billType: String!, $billNumber: String!) {
    bill(congress: $congress, billType: $billType, billNumber: $billNumber) {
      id
      number
      type
      congress
      title
      introducedDate
      latestActionDate
      latestActionText
      sponsor { fullName party state personId }
      policyArea
      url
      year
      actions { actionDate text type actionCode }
      textVersions { type date formats { type url } }
      textDocuments { packageId code label date sectionCount }
      rollCalls {
        id chamber congress session rollNumber date question description result
        yea nay present notVoting tieBreaker amendment sourceUrl breakdown
      }
      companions { id number type congress title }
      relatedBills { congress type number title relationship identifiedBy source note loaded }
    }
  }
`;

// Every member's vote in one roll call, fetched when its list is opened.
export const GET_ROLL_CALL_MEMBERS = gql`
  query GetRollCallMembers($id: String!) {
    rollCallMembers(id: $id)
  }
`;

// A stored text version without its section text (outline, citations, section index).
export const GET_BILL_TEXT = gql`
  query GetBillText($packageId: String!) {
    billText(packageId: $packageId)
  }
`;

// Section text, a batch at a time.
export const GET_BILL_TEXT_SECTIONS = gql`
  query GetBillTextSections($packageId: String!, $from: Int!, $count: Int!) {
    billTextSections(packageId: $packageId, from: $from, count: $count)
  }
`;

// Every law a Congress enacted, newest first, with statute citation and slip law once published.
export const GET_ENACTED_LAWS = gql`
  query GetEnactedLaws($congress: Int!, $lawType: String) {
    enactedLaws(congress: $congress, lawType: $lawType) {
      number
      lawType
      statuteCitation
      slipLawUrl
      detailsUrl
      date
      bill { congress type number title }
    }
  }
`;

export const GET_LAWS = gql`
  query GetLaws($congress: Int!, $lawType: String, $page: Int, $perPage: Int) {
    laws(congress: $congress, lawType: $lawType, page: $page, perPage: $perPage) {
      bills {
        id
        number
        type
        congress
        title
        introducedDate
        latestActionDate
        latestActionText
        sponsor { fullName party state personId }
        policyArea
        url
        year
      }
      totalCount
      currentPage
      totalPages
    }
  }
`;

export const GET_CASE_GRAPH = gql`
  query GetCaseGraph($caseId: Int!) {
    caseGraph(caseId: $caseId) {
      nodes { id name court year url isSeed }
      edges { source target treatment isDirect }
    }
  }
`;

// Tags (server/tags.js): words applied by hand to any item, addressed by a ref ("bill:119-HR-1").
export const GET_TAGS = gql`
  query GetTags {
    tags { id word description count }
  }
`;

export const GET_TAGS_FOR_ITEM = gql`
  query GetTagsForItem($ref: String!) {
    tagsForItem(ref: $ref) { id word description count }
  }
`;

export const GET_TAG_PAGE = gql`
  query GetTagPage($word: String!) {
    tagPage(word: $word) {
      tag { id word description count }
      items { ref kind label title date href note }
    }
  }
`;

export const CREATE_TAG = gql`
  mutation CreateTag($word: String!) {
    createTag(word: $word) { id word description count }
  }
`;

export const APPLY_TAG = gql`
  mutation ApplyTag($word: String!, $ref: String!) {
    applyTag(word: $word, ref: $ref) { id word description count }
  }
`;

export const REMOVE_TAG = gql`
  mutation RemoveTag($word: String!, $ref: String!) {
    removeTag(word: $word, ref: $ref)
  }
`;

export const DESCRIBE_TAG = gql`
  mutation DescribeTag($word: String!, $description: String) {
    describeTag(word: $word, description: $description) { id word description count }
  }
`;

export const MERGE_TAG = gql`
  mutation MergeTag($from: String!, $into: String!) {
    mergeTag(from: $from, into: $into) { id word description count }
  }
`;

export const DELETE_TAG = gql`
  mutation DeleteTag($word: String!) {
    deleteTag(word: $word)
  }
`;

// People (members of Congress, presidents, vice presidents) and what they did in each role.
export const GET_PEOPLE = gql`
  query GetPeople($search: String, $roleType: String, $current: Boolean, $party: String, $state: String, $sort: String, $page: Int, $perPage: Int) {
    people(search: $search, roleType: $roleType, current: $current, party: $party, state: $state, sort: $sort, page: $page, perPage: $perPage) {
      people { id name sortName roleType state party start end current roleTypes }
      totalCount
      currentPage
      totalPages
    }
  }
`;

export const GET_PERSON = gql`
  query GetPerson($id: String!) {
    person(id: $id) {
      id
      name
      birthDate
      deathDate
      bioguideId
      wikidataId
      otherIds
      stints {
        key roleType chamber state start end current terms districts congresses presidentSlug appointedBy
        parties { party start end }
        counts { votes sponsored cosponsored signed vetoed orders memoranda }
      }
    }
  }
`;

export const GET_PERSON_VOTES = gql`
  query GetPersonVotes($id: String!, $from: String, $to: String, $congress: Int, $position: String, $page: Int, $perPage: Int) {
    personVotes(id: $id, from: $from, to: $to, congress: $congress, position: $position, page: $page, perPage: $perPage) {
      totalCount
      positions
      votes {
        rollCallId date chamber congress session rollNumber question result amendment position party
        bill { congress type number title }
      }
    }
  }
`;

export const GET_PERSON_BILLS = gql`
  query GetPersonBills($id: String!, $role: String!, $from: String, $to: String, $congress: Int, $page: Int, $perPage: Int) {
    personBills(id: $id, role: $role, from: $from, to: $to, congress: $congress, page: $page, perPage: $perPage) {
      totalCount
      bills {
        introducedDate sponsorshipDate isOriginal withdrawnDate latestAction latestActionDate
        bill { congress type number title }
      }
    }
  }
`;

export const GET_PERSON_PRESIDENTIAL_ACTIONS = gql`
  query GetPersonPresidentialActions($id: String!, $from: String, $to: String) {
    personPresidentialActions(id: $id, from: $from, to: $to) {
      date action law
      bill { congress type number title }
    }
  }
`;

// A decision of a court by its address ("scotus", "25-332"): facts, stored text (without the
// opinions), and each Justice's vote.
const COURT_DECISION_FIELDS = `
  id court slug naturalCourt name docketNumbers dateArgued dateDecided kind citation slipCitation
  disposition voteMajority voteMinority voteInferred pdfUrl structure courtListenerUrl caseGraphId
  votes { personId name side wrote joined }
`;

export const GET_COURT_DECISION = gql`
  query GetCourtDecision($court: String!, $slug: String!) {
    courtDecision(court: $court, slug: $slug) { ${COURT_DECISION_FIELDS} }
  }
`;

// Old links addressed cases by CourtListener id; this finds the decision to redirect to.
export const GET_DECISION_BY_COURTLISTENER_ID = gql`
  query GetDecisionByCourtListenerId($id: String!) {
    courtDecisionByCourtListenerId(id: $id) { slug naturalCourt }
  }
`;

// One opinion's sections and footnotes.
export const GET_DECISION_OPINION = gql`
  query GetDecisionOpinion($decisionId: String!, $opinionId: String!) {
    decisionOpinion(decisionId: $decisionId, opinionId: $opinionId)
  }
`;

// The U.S. Code (server/usc.js)
export const GET_USC_TITLES = gql`
  query GetUscTitles {
    uscTitles
  }
`;

// A title and the containers of its outline (no sections).
export const GET_USC_TITLE = gql`
  query GetUscTitle($number: String!) {
    uscTitle(number: $number)
  }
`;

// The units directly under a container: its sections, as a chapter is opened.
export const GET_USC_CHILDREN = gql`
  query GetUscChildren($identifier: String!) {
    uscChildren(identifier: $identifier)
  }
`;

export const GET_USC_SECTION = gql`
  query GetUscSection($title: String!, $section: String!) {
    uscSection(title: $title, section: $section)
  }
`;

// Reports of investigations (server/reports.js).
const REPORT_FIELDS = `
  slug
  kind
  kindLabel
  title
  shortTitle
  issuer
  issuerShort
  dateIssued
  sourceId
  sourceUrl
  govinfoUrl
`;

export const GET_REPORTS = gql`
  query GetReports {
    reports {
      ${REPORT_FIELDS}
      counts
    }
  }
`;

export const GET_REPORT = gql`
  query GetReport($slug: String!) {
    report(slug: $slug) {
      ${REPORT_FIELDS}
      related
      structure
    }
  }
`;

export const GET_REPORT_PART = gql`
  query GetReportPart($slug: String!, $partId: String!) {
    reportPart(slug: $slug, partId: $partId)
  }
`;

// Population (server/population.js): Census Bureau files as published, from the data directory.
export const GET_POPULATION_COLLECTIONS = gql`
  query GetPopulationCollections {
    populationCollections
  }
`;

export const GET_POPULATION_FILE = gql`
  query GetPopulationFile($path: String!, $offset: Int, $limit: Int, $sheet: Int) {
    populationFile(path: $path, offset: $offset, limit: $limit, sheet: $sheet)
  }
`;

export const GET_ACS_YEARS = gql`
  query GetAcsYears {
    acsYears
  }
`;

export const GET_ACS_GEOGRAPHIES = gql`
  query GetAcsGeographies($year: Int!) {
    acsGeographies(year: $year)
  }
`;

export const GET_ACS_TABLE = gql`
  query GetAcsTable($year: Int!, $geoid: String!, $table: String!) {
    acsTable(year: $year, geoid: $geoid, table: $table)
  }
`;

// Where the data comes from (server/sources.js): every program, and one with its files and series.
const ABSTRACT_TABLE_FIELDS = `
  id section sectionName category categoryName page title online url coverage shape inHand note
  programs { slug name licence collected }
  series { key name national places placesLabel groups frequency firstDate lastDate found }
`;

const SOURCE_PROGRAM_FIELDS = `
  slug name kind kindLabel description homepage licence licenceLabel licenceDetail
  accessUsed accessBest accessKey accessContact accessNote status statusLabel ended successor successorName
  collected inAbstract outsideAbstract notes fileCount fileBytes lastModified seriesCount abstractTableCount
  organizations { role organization { slug name shortName kind kindLabel branch parent parentName url notes } }
`;

export const GET_SOURCE_PROGRAMS = gql`
  query GetSourcePrograms {
    sourcePrograms { ${SOURCE_PROGRAM_FIELDS} }
    sourceVocabulary
  }
`;

export const GET_SOURCE_PROGRAM = gql`
  query GetSourceProgram($slug: String!) {
    sourceProgram(slug: $slug) {
      ${SOURCE_PROGRAM_FIELDS}
      paths
      lineage { from fromName to toName date kind citation document href notes }
      folders(limit: 200) { path count bytes lastModified }
      series(limit: 500) { slug name frequency unit firstDate lastDate }
      abstractTables { ${ABSTRACT_TABLE_FIELDS} }
    }
    sourceVocabulary
  }
`;

export const GET_ABSTRACT_COVERAGE = gql`
  query GetAbstractCoverage {
    abstractCoverage {
      sections { number id name }
      tables { ${ABSTRACT_TABLE_FIELDS} }
    }
    sourceVocabulary
  }
`;

export const GET_SOURCE_FILES = gql`
  query GetSourceFiles($program: String!, $folder: String, $limit: Int) {
    sourceFiles(program: $program, folder: $folder, limit: $limit) { path size sha256 modifiedAt url urlInferred archive fetchedAt }
  }
`;
