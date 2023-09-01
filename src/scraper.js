import axios from 'axios';
import { load } from 'cheerio';
import { outro, spinner } from '@clack/prompts';
import open from 'open';
import pico from 'picocolors';
import createCall from './phoneCall.cjs';
// const productURL = 'https://www.amazon.com.mx/dp/B0CCSQXHJ2'; // Replace with the URL of the product you want to check
// test
const webURL = 'https://www.amazon.com.mx/dp/'; // Replace with the URL of the product you want to check
const s = spinner();
export async function checkProductAvailability(
  productID,
  minutuesToCheckAgain = 1
) {
  try {
    // Show a spinner while the product page is being downloaded
    s.start('Checking product availability...');
    const productURL = webURL + productID;
    console.log(productURL);
    const response = await axios.get(productURL);
    const $ = load(response.data);

    // Look for the "Add to Cart" or "Buy Now" button on the product page
    const addToCartButton = $('#add-to-cart-button');
    const buyNowButton = $('#buy-now-button');

    if (addToCartButton.length > 0 || buyNowButton.length > 0) {
      s.stop(
        pico.blue('Product is available for purchase! Opening browser...')
      );
      // Open chrome with the product URL
      await open(productURL);
      // Make a phone call to the number specified in the .env file
      createCall(process.env.PHONE_TO_NOTIFY);
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
    outro('Something went wrong. Please try again.');
  }
}
