import { existsSync } from 'fs';
import { config } from 'dotenv';
import pico from 'picocolors';
import { text, isCancel } from '@clack/prompts';

// check if the .env file is present
if (!existsSync('.env')) {
  console.log(
    pico.red(
      `Missing .env file. Please create one copying ${pico.bold(
        '.env.example'
      )} and try again.`
    )
  );
  process.exit(1);
}

config();

// ask for the WhatsApp number to notify if it's not in the .env file
if (!process.env.PHONE_TO_NOTIFY) {
  const phone = await text({
    message:
      'Enter the WhatsApp number to notify (with country code, e.g. +5215512345678)',
    placeholder: '+5215512345678',
    validate: (value) => {
      if (!value || value.replace(/\D/g, '').length < 10) {
        return 'Please enter a valid phone number including the country code';
      }
    },
  });
  if (isCancel(phone)) {
    process.exit(0);
  }
  process.env.PHONE_TO_NOTIFY = phone;
}
