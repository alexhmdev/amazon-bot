import './src/env.js';
import { checkProductAvailability } from './src/scraper.js';
import { intro, text } from '@clack/prompts';
import pico from 'picocolors';
intro('Amazon Product Availability Checker 🤖 1.0.0');

const minutesToCheckAgain = await text({
  message: `How often do you want to check the product availability (in minutes)? \n ${pico.yellow(
    `(if you enter a low value probably amazon will block you, so be careful!`
  )}`,
  placeholder: '1',
});

// Replace with the product ID of the product you want to check
checkProductAvailability(process.env.PRODUCT_ID, minutesToCheckAgain);
