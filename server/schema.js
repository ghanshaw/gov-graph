export const typeDefs = `#graphql
  type ExecutiveOrder {
    number: String
    title: String
    dateSigned: String
    abstract: String
    url: String
    fullTextUrl: String
    bodyHtmlUrl: String
    topics: [String]
    year: Int
    president: String
  }

  type Tag {
    id: Int!
    word: String!
    source: String!
    createdAt: String
  }

  type TagSummary {
    word: String!
    count: Int!
  }

  type TaggedExecutiveOrder {
    entityId: String!
    order: ExecutiveOrder
  }

  type TaggedScotusCase {
    entityId: String!
    case: ScotusCase
  }

  type TaggedLegislation {
    entityId: String!
    bill: Bill
  }

  type TagPageResult {
    tag: Tag
    executiveOrders: [TaggedExecutiveOrder!]!
    scotusCases: [TaggedScotusCase!]!
    legislation: [TaggedLegislation!]!
  }

  type ExecutiveOrderPage {
    orders: [ExecutiveOrder!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
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

  type ScotusOpinion {
    id: String!
    type: String
    author: String
    perCuriam: Boolean
    url: String
  }

  type ScotusCase {
    id: String!
    caseName: String!
    dateFiled: String
    citation: String
    docketNumber: String
    url: String
    year: Int
    syllabus: String
    votesMajority: Int
    votesMinority: Int
    decisionDirection: String
    opinions: [ScotusOpinion!]
  }

  type ScotusCasePage {
    cases: [ScotusCase!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
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
  }

  type BillPage {
    bills: [Bill!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
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
    ): ExecutiveOrderPage!

    executiveOrder(number: String!): ExecutiveOrder
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

    scotusCase(id: String!): ScotusCase

    allScotusCases(courtSlug: String!): [ScotusCase!]!

    congresses: [Congress!]!

    bills(
      congress: Int!
      billType: String
      page: Int
      perPage: Int
      search: String
      year: Int
    ): BillPage!

    laws(
      congress: Int!
      lawType: String
      page: Int
      perPage: Int
    ): BillPage!

    bill(congress: Int!, billType: String!, billNumber: String!): Bill

    caseGraph(caseId: Int!): CaseGraph!
    caseInGraph(clusterId: Int!): Int

    allTags: [TagSummary!]!
    tagPage(word: String!): TagPageResult
    tagsForEntity(entityType: String!, entityId: String!): [Tag!]!
  }

  type Mutation {
    applyTag(word: String!, entityType: String!, entityId: String!): Tag!
    removeTag(word: String!, entityType: String!, entityId: String!): Boolean!
  }
`;
