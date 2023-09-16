import axios from 'axios';
import { load } from 'cheerio';
import { outro, spinner } from '@clack/prompts';
import open from 'open';
import pico from 'picocolors';
import createCall from './phoneCall.cjs';
const webURL = 'https://www.amazon.com.mx/dp/'; // Replace with the URL of the product you want to check
const s = spinner();
export async function checkProductAvailability(
  productID,
  minutuesToCheckAgain = 1
) {
  try {
    // axios config to avoid being blocked by amazon
    axios.defaults.headers.common['User-Agent'] =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';
    // Show a spinner while the product page is being downloaded
    s.start('Checking product availability...');
    const productURL = webURL + productID;
    console.log(productURL);
    const response = await axios.get(productURL);
    const $ = load(response.data);

    // Look for the "Add to Cart" or "Buy Now" button on the product page
    const addToCartButton = $('#add-to-cart-button');
    const buyNowButton = $('#buy-now-button');
    const buyBox = $('#buybox-see-all-buying-choices');
    const productName = $('#productTitle').text().trim();

    if (
      addToCartButton.length > 0 ||
      buyNowButton.length > 0 ||
      buyBox.length > 0
    ) {
      const optionFind =
        addToCartButton.length > 0
          ? 'Add to Cart'
          : buyNowButton.length > 0
          ? 'Buy Now'
          : buyBox.length > 0
          ? 'Buy Box'
          : 'Unknown';
      s.stop(
        pico.blue(
          `Product is available for purchase trough ${optionFind}! Opening browser...`
        )
      );
      // Open chrome with the product URL
      await open(productURL);
      // Make a phone call to the number specified in the .env file
      createCall(
        process.env.PHONE_TO_NOTIFY,
        `Product ${productName} is available for purchase trough ${optionFind} go and buy it!`
      );
    } else {
      s.stop(
        pico.yellow(
          `🫥 Product is currently not available for purchase. \n Checking again in ${minutuesToCheckAgain} minutes...`
        )
      );
      // Check again in 1 minutes
      setTimeout(
        () => checkProductAvailability(productID, minutuesToCheckAgain),
        minutuesToCheckAgain * 60 * 1000
      );
    }
  } catch (error) {
    console.error('Error:', error.message);
    s.stop('An error occurred. Retrying in 5 minutes...');
    setTimeout(
      () => checkProductAvailability(productID, minutuesToCheckAgain),
      5 * 60 * 1000
    );
  }
}
