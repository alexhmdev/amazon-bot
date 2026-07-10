import axios from 'axios';
import { load } from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Checks a single product page and reports its state without side effects.
 * Returns { status: 'available' | 'unavailable' | 'blocked', name, method, url }
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
    return { status: 'blocked', name: product.label, method: null, url };
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

  return {
    status: method ? 'available' : 'unavailable',
    name,
    method,
    url,
  };
}
