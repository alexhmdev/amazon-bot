import open from 'open';
import pico from 'picocolors';
import { checkProduct } from './scraper.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 5-15s between requests so N products don't hit Amazon at the same instant
const jitter = () => 5000 + Math.random() * 10000;

const BLOCKED_BACKOFF_MINUTES = 15;

export function renderMessage(template, context) {
  return template.replace(/\{(\w+)\}/g, (match, key) => context[key] ?? match);
}

/**
 * Checks every product in the watchlist sequentially and notifies every
 * round it's available (stock is limited, so units restock and sell out
 * repeatedly — products are never removed after a notification, the bot
 * keeps watching and alerting for as long as it runs).
 */
export async function watchProducts(config, notify) {
  const pending = [...config.products];
  const { checkIntervalMinutes, openBrowser } = config.settings;

  while (pending.length > 0) {
    let blocked = false;

    for (let i = pending.length - 1; i >= 0; i--) {
      const product = pending[i];
      const timestamp = new Date().toLocaleTimeString();
      try {
        const result = await checkProduct(product);

        if (result.status === 'blocked') {
          blocked = true;
          console.log(
            pico.red(
              `[${timestamp}] ⛔ Amazon served a captcha while checking ${product.label}. Backing off...`
            )
          );
        } else if (
          result.status === 'available' &&
          product.onlyAmazon &&
          !result.soldByAmazon
        ) {
          console.log(
            pico.yellow(
              `[${timestamp}] 🏪 ${product.label} is available but sold by ${
                result.seller ?? 'an unknown seller'
              } (not Amazon) — no alert sent, still watching for Amazon stock.`
            )
          );
        } else if (result.status === 'available') {
          const message = renderMessage(product.message, {
            label: product.label,
            name: result.name,
            method: result.method,
            url: result.url,
            id: product.id,
            seller: result.seller ?? '',
          });
          console.log(
            pico.green(
              `[${timestamp}] 🎉 ${product.label} is available via ${result.method}!`
            )
          );
          if (openBrowser) {
            await open(result.url).catch(() => {});
          }
          await notify(message, { tagEveryone: product.tagEveryone });
        } else {
          console.log(
            pico.yellow(
              `[${timestamp}] 🫥 ${product.label} is not available yet.`
            )
          );
        }
      } catch (error) {
        console.log(
          pico.red(
            `[${timestamp}] Error checking ${product.label}: ${error.stack || error}`
          )
        );
      }

      if (pending.length > 0 && i > 0) {
        await sleep(jitter());
      }
    }

    if (pending.length > 0) {
      const waitMinutes = blocked
        ? Math.max(checkIntervalMinutes, BLOCKED_BACKOFF_MINUTES)
        : checkIntervalMinutes;
      console.log(
        pico.dim(
          `Next round in ${waitMinutes} minute(s) — ${pending.length} product(s) still being watched.`
        )
      );
      await sleep(waitMinutes * 60 * 1000);
    }
  }
}
