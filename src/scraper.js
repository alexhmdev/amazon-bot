import axios from 'axios';
import { load } from 'cheerio';
import open from 'open';
import createCall from './phoneCall.cjs';
// const productURL = 'https://www.amazon.com.mx/dp/B0CCSQXHJ2'; // Replace with the URL of the product you want to check
// test
const webURL = 'https://www.amazon.com.mx/dp/'; // Replace with the URL of the product you want to check
export async function checkProductAvailability(productID) {
  try {
    const productURL = webURL + productID;
    const response = await axios.get(productURL);
    const $ = load(response.data);

    // Look for the "Add to Cart" or "Buy Now" button on the product page
    const addToCartButton = $('#add-to-cart-button');
    const buyNowButton = $('#buy-now-button');

    if (addToCartButton.length > 0 || buyNowButton.length > 0) {
      console.log('Product is available for purchase! opening browser...');
      // Open chrome with the product URL
      await open(productURL);
      // Make a phone call to the number specified in the .env file
      createCall(process.env.PHONE_TO_NOTIFY);
    } else {
      console.log('Product is currently not available for purchase.');
      // Check again in 1 minutes
      setTimeout(checkProductAvailability, 60000);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}
