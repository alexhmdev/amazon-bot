import axios from 'axios';
import { load } from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Who is selling in the buy box. The classic layout puts "Vendido y enviado
// por Amazon" / "Sold by ..." in #merchant-info; the newer layout splits it
// into offer-display feature rows. Third-party sellers link to their seller
// profile — Amazon itself never does — so a seller link always means resale,
// even when the text mentions Amazon ("Vendido por X y enviado por Amazon"
// is Fulfilled-by-Amazon resale, not Amazon as the seller).
function parseSeller($) {
  const thirdPartyLink = $(
    '#sellerProfileTriggerId, #merchant-info a[href*="seller="], #merchantInfoFeature_feature_div a[href*="seller="]'
  ).first();
  if (thirdPartyLink.length > 0) {
    return { seller: thirdPartyLink.text().trim() || null, soldByAmazon: false };
  }

  // Newer layout: the seller name lives in its own span, next to a label
  // like "Vendedor" / "Remitente / Vendedor" / "Sold by" — match the name
  // alone instead of guessing every label wording.
  const merchantName = $(
    '#merchantInfoFeature_feature_div .offer-display-feature-text-message'
  )
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();
  if (merchantName) {
    return { seller: merchantName, soldByAmazon: /^amazon\b/i.test(merchantName) };
  }

  const text = (
    $('#merchant-info').text().trim() ||
    $('#merchantInfoFeature_feature_div').text().trim()
  ).replace(/\s+/g, ' ');
  if (!text) {
    return { seller: null, soldByAmazon: false };
  }

  const soldByAmazon =
    /^amazon\b/i.test(text) ||
    /(?:vendido(?: y enviado)? por|vendedor|sold by|seller|ships from and sold by)\s*:?\s*amazon\b/i.test(
      text
    );
  return { seller: text, soldByAmazon };
}

/**
 * Checks a single product page and reports its state without side effects.
 * Returns { status: 'available' | 'unavailable' | 'blocked', name, method,
 * url, seller, soldByAmazon }. soldByAmazon is only true when the buy box
 * seller is confirmed to be Amazon itself — unknown sellers count as resale.
 */
export async function checkProduct(product) {
  const url = `https://www.${product.marketplace}/dp/${product.id}`;
  const response = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
    },
  });
  const $ = load(response.data);

  // Amazon serves captcha pages with HTTP 200 — without this check a block
  // is indistinguishable from "out of stock"
  const isBlocked =
    $('form[action*="validateCaptcha"]').length > 0 ||
    /robot check|captcha/i.test($('title').text());
  if (isBlocked) {
    return {
      status: 'blocked',
      name: product.label,
      method: null,
      url,
      seller: null,
      soldByAmazon: false,
    };
  }

  const name = $('#productTitle').text().trim() || product.label;
  const method =
    $('#add-to-cart-button').length > 0
      ? 'Add to Cart'
      : $('#buy-now-button').length > 0
      ? 'Buy Now'
      : $('#buybox-see-all-buying-choices').length > 0
      ? 'Buy Box'
      : null;

  const { seller, soldByAmazon } = parseSeller($);

  return {
    status: method ? 'available' : 'unavailable',
    name,
    method,
    url,
    seller,
    soldByAmazon,
  };
}
