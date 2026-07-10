import './src/env.js';
import { intro, outro } from '@clack/prompts';
import pico from 'picocolors';
import { loadConfig } from './src/config.js';
import {
  initWhatsApp,
  sendWhatsApp,
  destroyWhatsApp,
} from './src/whatsapp.js';
import { watchProducts } from './src/scheduler.js';

intro('Amazon Product Availability Checker 🤖 2.0.0');

const config = loadConfig();
console.log(
  pico.blue(
    `Watching ${config.products.length} product(s) every ${config.settings.checkIntervalMinutes} minute(s):`
  )
);
for (const product of config.products) {
  console.log(pico.dim(`  • ${product.label} (${product.id})`));
}

await initWhatsApp(process.env.PHONE_TO_NOTIFY);
await sendWhatsApp(
  `🤖 Amazon bot started. Watching ${config.products.length} product(s):\n${config.products
    .map((product) => `• ${product.label}`)
    .join('\n')}`
);

await watchProducts(config, sendWhatsApp);

outro(pico.green('All products found and notified 🎉'));
await destroyWhatsApp();
