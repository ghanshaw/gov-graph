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

export const pdfRouter = express.Router();

pdfRouter.get('/eo/:number', async (req, res) => {
  const number = parseInt(req.params.number, 10);
  if (!Number.isInteger(number)) return res.status(400).send('Bad executive order number');

  try {
    const url = await executiveOrderPdfUrl(number);
    // Only ever fetch from govinfo, whatever the Federal Register API returns.
    if (!url || new URL(url).hostname !== 'www.govinfo.gov') return res.status(404).send('No PDF for this order');

    const upstream = await axios.get(url, { responseType: 'stream' });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="executive-order-${number}.pdf"`,
      'Cache-Control': 'public, max-age=86400',
    });
    if (upstream.headers['content-length']) res.set('Content-Length', upstream.headers['content-length']);
    upstream.data.pipe(res);
  } catch (err) {
    console.error(`executive order ${number} pdf failed:`, err.message);
    res.status(502).send('Could not load the PDF');
  }
});
