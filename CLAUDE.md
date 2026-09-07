# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A CLI bot that watches a list of Amazon products (scraping with axios + cheerio) and sends WhatsApp notifications from the user's own number (whatsapp-web.js, QR login) when a product becomes available. Learning project, MIT licensed.

## Commands

```sh
npm start                 # run the bot
npm run dev               # run with nodemon (restarts on file changes)
npx eslint index.js src/  # lint (no lint script in package.json)
```

There is no test suite or build step. To verify changes without hitting Amazon or WhatsApp, write a throwaway script **inside the repo root** (ESM needs it there for `node_modules` resolution) that monkeypatches `axios.get` to return mock product HTML and passes a fake `notify` function to `watchProducts` — see the states below for what the parser keys on.

Running the real bot requires interactive setup that can't happen headlessly: a `.env` (copy `.env.example`) with `PHONE_TO_NOTIFY` and/or `NOTIFY_GROUP`, a `products.json` (copy `products.example.json`), and a one-time WhatsApp QR scan (session persists in `.wwebjs_auth/`). `products.json`, `.env`, and `.wwebjs_auth/` are gitignored — never commit them. In sandboxes, install with `PUPPETEER_SKIP_DOWNLOAD=true` to avoid the Chromium download whatsapp-web.js pulls in.

## Architecture

Pure ESM (`"type": "module"`). Flow: `index.js` → side-effect import of `src/env.js` (validates `.env`, may prompt via @clack) → `loadConfig()` → `initWhatsApp()` → `watchProducts(config, sendWhatsApp)`.

The modules are deliberately decoupled around two contracts:

- **`src/scraper.js`** — `checkProduct(product)` is pure I/O-in/data-out: fetches one product page and returns `{ status, name, method, url, seller, soldByAmazon }` where `status` is `'available' | 'unavailable' | 'blocked'`. No timers, no notifications, no console output. **`blocked` is load-bearing**: Amazon serves captcha pages with HTTP 200, so without that third state a block is indistinguishable from "out of stock". Availability = presence of `#add-to-cart-button`, `#buy-now-button`, or `#buybox-see-all-buying-choices`. `soldByAmazon` is confirmed-positive only: a seller-profile link in the buy box always means third party (even FBA "Vendido por X y enviado por Amazon"), and an unknown/missing seller counts as *not* Amazon. The scheduler consumes it for the per-product `onlyAmazon` filter (default `true`): reseller availability is logged and treated as not available.
- **`src/whatsapp.js`** — owns the whatsapp-web.js client and a list of `targets` (direct number and/or group; both receive every message). Exposes `sendWhatsApp(message, { tagEveryone })`; `tagEveryone` @-mentions all participants but only on group targets. Chat ids are resolved via `getNumberId`/`getChats` — never build `@c.us` ids by string manipulation (that's how the old Mexico `+521` bug happened).
- **`src/scheduler.js`** — `watchProducts` owns all orchestration: sequential checks with 5–15s jitter between requests (deliberate anti-blocking; don't parallelize), the check-interval sleep, 15-min back-off when any check returns `blocked`, opening the browser. Products are **never removed** from the watchlist after a notification — stock is limited and restocks/sells out repeatedly, so the bot keeps checking and re-notifying every round a product stays available. `renderMessage` fills `{placeholder}` tokens (`label`, `name`, `method`, `url`, `id`, `seller`) into per-product message templates.
- **`src/config.js`** — loads/validates `products.json`, applies `settings` defaults onto each product (`marketplace`, `message`, `tagEveryone`, `onlyAmazon`), and extracts ASINs from full Amazon URLs. Exits the process with a red message on any invalid config.

When adding a notification channel, keep the `notify(message, options)` signature and fan out — the scheduler must stay channel-agnostic. When adding per-product options, follow the existing pattern: default in `DEFAULT_SETTINGS`, per-product override resolved in `loadConfig`, consumed downstream.

User-facing console output uses picocolors + @clack/prompts; notification message *templates* are user-supplied (currently Spanish) — don't hardcode language into the code paths.
