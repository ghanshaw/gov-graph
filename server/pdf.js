import express from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';

// govinfo serves its PDFs with X-Frame-Options: SAMEORIGIN, so the client cannot embed
// them directly. This passes the PDF through from our own origin instead.

const BASE_URL = 'https://www.federalregister.gov/api/v1/documents';
const cache = new NodeCache({ stdTTL: 3600 });

async function executiveOrderPdfUrl(number) {
  const cached = cache.get(number);
  if (cached) return cached;

  const response = await axios.get(BASE_URL, {
    params: {
      'conditions[presidential_document_type]': 'executive_order',
      'conditions[executive_order_numbers][]': number,
      'fields[]': ['document_number', 'pdf_url'],
      per_page: 5,
    },
  });
  // Correction / republication notices (C1-…, R1-…) share the order's number.
  const order = (response.data.results || []).find(r => !/^[CR]\d-/.test(r.document_number));
  if (!order?.pdf_url) return null;

  cache.set(number, order.pdf_url);
  return order.pdf_url;
}

async function documentPdfUrl(documentNumber) {
  const cached = cache.get(`doc:${documentNumber}`);
  if (cached) return cached;

  const response = await axios.get(`${BASE_URL}/${documentNumber}.json`, { params: { 'fields[]': ['pdf_url'] } });
  const url = response.data?.pdf_url;
  if (!url) return null;

  cache.set(`doc:${documentNumber}`, url);
  return url;
}

// Only ever fetch from govinfo (or congress.gov for bills), whatever the upstream API returns.
const PDF_HOSTS = ['www.govinfo.gov', 'www.congress.gov'];

async function sendPdf(res, url, filename) {
  if (!url || !PDF_HOSTS.includes(new URL(url).hostname)) return res.status(404).send('No PDF for this document');

  const upstream = await axios.get(url, { responseType: 'stream' });
  // A missing file can come back as an HTML page with status 200.
  if (!/pdf/i.test(upstream.headers['content-type'] ?? '')) {
    upstream.data.destroy();
    return res.status(404).send('No PDF for this document');
  }
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${filename}.pdf"`,
    'Cache-Control': 'public, max-age=86400',
  });
  if (upstream.headers['content-length']) res.set('Content-Length', upstream.headers['content-length']);
  upstream.data.pipe(res);
}

export const pdfRouter = express.Router();

// Documents with no order number (memoranda), by Federal Register document number.
pdfRouter.get('/doc/:documentNumber', async (req, res) => {
  const { documentNumber } = req.params;
  if (!/^[A-Za-z0-9-]+$/.test(documentNumber)) return res.status(400).send('Bad document number');

  try {
    await sendPdf(res, await documentPdfUrl(documentNumber), `federal-register-${documentNumber}`);
  } catch (err) {
    if (err.response?.status === 404) return res.status(404).send('No PDF for this document');
    console.error(`document ${documentNumber} pdf failed:`, err.message);
    res.status(502).send('Could not load the PDF');
  }
});

// A bill text version, by its govinfo package id (e.g. BILLS-119s3018rs: 119th Congress,
// S. 3018, "rs" = reported in Senate). The id is the PDF's file name at congress.gov.
pdfRouter.get('/bill/:packageId', async (req, res) => {
  const match = /^BILLS-(\d{2,3})([a-z]+)(\d+)([a-z0-9]+)$/.exec(req.params.packageId);
  if (!match) return res.status(400).send('Bad bill text id');
  const [packageId, congress, type, number] = match;

  try {
    await sendPdf(res, `https://www.govinfo.gov/content/pkg/${packageId}/pdf/${packageId}.pdf`, packageId);
  } catch (err) {
    // govinfo can lag behind congress.gov for the newest versions.
    if (err.response?.status !== 404) {
      console.error(`bill text ${packageId} pdf failed:`, err.message);
      return res.status(502).send('Could not load the PDF');
    }
    try {
      await sendPdf(res, `https://www.congress.gov/${congress}/bills/${type}${number}/${packageId}.pdf`, packageId);
    } catch (fallbackErr) {
      if (fallbackErr.response?.status === 404) return res.status(404).send('No PDF for this bill text');
      console.error(`bill text ${packageId} pdf failed:`, fallbackErr.message);
      res.status(502).send('Could not load the PDF');
    }
  }
});

pdfRouter.get('/eo/:number', async (req, res) => {
  const number = parseInt(req.params.number, 10);
  if (!Number.isInteger(number)) return res.status(400).send('Bad executive order number');

  try {
    await sendPdf(res, await executiveOrderPdfUrl(number), `executive-order-${number}`);
  } catch (err) {
    console.error(`executive order ${number} pdf failed:`, err.message);
    res.status(502).send('Could not load the PDF');
  }
});

// A govinfo publication or one of its parts, by package and granule id (reports: GPO-911REPORT,
// GPO-911REPORT-7 = chapter 1). Ids are letters, digits and dashes only.
pdfRouter.get('/govinfo/:packageId/:granuleId?', async (req, res) => {
  const { packageId, granuleId = packageId } = req.params;
  if (![packageId, granuleId].every(id => /^[A-Za-z0-9-]+$/.test(id)) || !granuleId.startsWith(packageId)) {
    return res.status(400).send('Bad govinfo id');
  }
  try {
    await sendPdf(res, `https://www.govinfo.gov/content/pkg/${packageId}/pdf/${granuleId}.pdf`, granuleId);
  } catch (err) {
    if (err.response?.status === 404) return res.status(404).send('No PDF for this document');
    console.error(`govinfo ${granuleId} pdf failed:`, err.message);
    res.status(502).send('Could not load the PDF');
  }
});
