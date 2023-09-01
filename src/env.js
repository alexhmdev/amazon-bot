// init dotenv
import { config } from 'dotenv';
import pico from 'picocolors';
import { existsSync } from 'fs';
import { text } from '@clack/prompts';
config();

// check if the .env file is present
if (!existsSync('.env')) {
  console.log(
    pico.red(
      `Missing .env file. Please create one copying ${pico.bold(
        `.env-example`
      )} and try again.`
    )
  );
  process.exit(1);
}

//check if the product ID is present and ask to add it if not
if (!process.env.PRODUCT_ID) {
  const productID = await text({
    message:
      'Please enter the product ID/amazon URL of the product you want to check',
    placeholder: 'B0CCSQXHJ2 or https://www.amazon.com.mx/dp/B0CCSQXHJ2',
    type: 'input',
    validate: (value) => {
      if (value.length == 0) {
        return 'Please enter the product ID/amazon URL of the product you want to check';
      }
    },
  });
  console.log(productID);
  if (productID.includes('amazon.com')) {
    // search for the product ID in the URL after the /dp/ part
    console.log(productID.split('/dp/')[1].split('/')[0]);
    process.env.PRODUCT_ID = productID.split('/dp/')[1].split('/')[0];
  } else {
    process.env.PRODUCT_ID = productID;
  }
}
