import { existsSync, readFileSync } from 'fs';
import pico from 'picocolors';

const CONFIG_FILE = 'products.json';

const DEFAULT_SETTINGS = {
  checkIntervalMinutes: 5,
  marketplace: 'amazon.com.mx',
  openBrowser: true,
};

export const DEFAULT_MESSAGE =
  '✅ {name} is available for purchase through {method}!\n{url}';

export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    console.log(
      pico.red(
        `Missing ${pico.bold(CONFIG_FILE)}. Copy ${pico.bold(
          'products.example.json'
        )} to ${pico.bold(CONFIG_FILE)} and add your products.`
      )
    );
    process.exit(1);
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch (error) {
    console.log(
      pico.red(`Could not parse ${CONFIG_FILE}: ${error.message}`)
    );
    process.exit(1);
  }

  const settings = { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) };
  const interval = Number(settings.checkIntervalMinutes);
  if (!Number.isFinite(interval) || interval <= 0) {
    console.log(
      pico.red('settings.checkIntervalMinutes must be a positive number.')
    );
    process.exit(1);
  }
  settings.checkIntervalMinutes = interval;

  const products = (raw.products ?? []).map((product, index) => {
    const id = extractProductId(product.id);
    if (!id) {
      console.log(
        pico.red(
          `Product at position ${index} is missing an "id" (ASIN or amazon URL).`
        )
      );
      process.exit(1);
    }
    return {
      id,
      label: product.label ?? id,
      marketplace: product.marketplace ?? settings.marketplace,
      message: product.message ?? DEFAULT_MESSAGE,
    };
  });

  if (products.length === 0) {
    console.log(pico.red(`No products found in ${CONFIG_FILE}.`));
    process.exit(1);
  }

  return { settings, products };
}

// Accepts a plain ASIN or a full amazon URL and returns the ASIN
export function extractProductId(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.includes('/dp/')) {
    return value.split('/dp/')[1]?.split(/[/?]/)[0] || null;
  }
  return value.trim() || null;
}
