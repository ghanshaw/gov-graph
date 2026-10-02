import { gql } from '@apollo/client/core';

export const GET_EXECUTIVE_ORDERS = gql`
  query GetExecutiveOrders($president: String, $documentType: String, $page: Int, $perPage: Int, $search: String, $year: Int, $order: String) {
    executiveOrders(president: $president, documentType: $documentType, page: $page, perPage: $perPage, search: $search, year: $year, order: $order) {
      orders {
        number
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
        url
        year
        votesMajority
        votesMinority
        decisionDirection
      }
      totalCount
      currentPage
      totalPages
    }
  }
`;

export const GET_TIMELINE_CASES = gql`
  query GetTimelineCases($courtSlug: String!) {
    allScotusCases(courtSlug: $courtSlug) {
      id
      caseName
      dateFiled
      citation
      url
      year
      decisionDirection
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
  query GetBills($congress: Int!, $billType: String, $page: Int, $perPage: Int, $search: String, $year: Int) {
    bills(congress: $congress, billType: $billType, page: $page, perPage: $perPage, search: $search, year: $year) {
      bills {
        id
        number
        type
        congress
        title
        introducedDate
        latestActionDate
        latestActionText
        sponsor { fullName party state }
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
      sponsor { fullName party state }
      policyArea
      url
      year
      actions { actionDate text type actionCode }
      textVersions { type date formats { type url } }
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
        sponsor { fullName party state }
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

export const GET_CASE_IN_GRAPH = gql`
  query GetCaseInGraph($clusterId: Int!) {
    caseInGraph(clusterId: $clusterId)
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

export const GET_SCOTUS_CASE = gql`
  query GetScotusCase($id: String!) {
    scotusCase(id: $id) {
      id
      caseName
      dateFiled
      citation
      docketNumber
      url
      year
      syllabus
      votesMajority
      votesMinority
      decisionDirection
      opinions {
        id
        type
        author
        perCuriam
        url
      }
    }
    naturalCourts {
      slug
      name
    }
  }
`;

export const GET_TAGS_FOR_ENTITY = gql`
  query GetTagsForEntity($entityType: String!, $entityId: String!) {
    tagsForEntity(entityType: $entityType, entityId: $entityId) {
      id
      word
      source
    }
  }
`;

export const GET_ALL_TAGS = gql`
  query GetAllTags {
    allTags {
      word
      count
    }
  }
`;

export const GET_TAG_PAGE = gql`
  query GetTagPage($word: String!) {
    tagPage(word: $word) {
      tag { id word source }
      executiveOrders {
        entityId
        order { number title dateSigned url president }
      }
      scotusCases {
        entityId
        case { id caseName dateFiled citation url }
      }
      legislation {
        entityId
        bill { id number type congress title introducedDate url }
      }
    }
  }
`;

export const APPLY_TAG = gql`
  mutation ApplyTag($word: String!, $entityType: String!, $entityId: String!) {
    applyTag(word: $word, entityType: $entityType, entityId: $entityId) {
      id
      word
      source
    }
  }
`;

export const REMOVE_TAG = gql`
  mutation RemoveTag($word: String!, $entityType: String!, $entityId: String!) {
    removeTag(word: $word, entityType: $entityType, entityId: $entityId)
  }
`;
