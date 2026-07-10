# Amazon-bot

This bot is **ONLY FOR LEARNING PURPOSES**

> Watch a list of Amazon products and get a WhatsApp notification (from your own number) the moment one of them becomes available. Uses axios + cheerio to load the product page and look for the purchase buttons.

## Features

- Watch **multiple products** from a single `products.json` watchlist
- **Custom notification message per product** with placeholders
- WhatsApp notifications from **your own phone number** using [whatsapp-web.js](https://wwebjs.dev/) — no Twilio account needed
- Notify a **WhatsApp group** instead of a single number, optionally **@-mentioning everyone** in the group per product
- Captcha/block detection with automatic back-off, plus jittered sequential requests to avoid getting blocked
- Opens the product page in your browser when it becomes available ([open](https://www.npmjs.com/package/open))

## Installation

- Amazon-bot requires [Node.js](https://nodejs.org/) (use latest version to run).
- Install the dependencies (the first install downloads a Chromium build used by whatsapp-web.js).

```sh
git clone https://www.github.com/alexhmdev/amazon-bot.git
cd amazon-bot
npm install
```

- Copy `.env.example` to `.env` and set the WhatsApp number that should receive the notifications (usually your own), including the country code:

```sh
PHONE_TO_NOTIFY=+5215512345678
# optional: notify a group instead (exact group name, you must be a member)
# NOTIFY_GROUP=Pokemon Hunters
```

- Copy `products.example.json` to `products.json` and add your products:

```json
{
  "settings": {
    "checkIntervalMinutes": 5,
    "marketplace": "amazon.com.mx",
    "openBrowser": true
  },
  "products": [
    {
      "id": "B0CCSQXHJ2",
      "label": "PS5 Spider-Man 2 Bundle",
      "message": "🕷️ {label} is back in stock via {method}!\nGo get it: {url}"
    }
  ]
}
```

### Product options

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | The ASIN, or the full product URL (the ASIN is extracted from `/dp/...`) |
| `label` | no | Friendly name used in logs and messages (defaults to the ASIN) |
| `message` | no | Custom notification text for this product |
| `marketplace` | no | Overrides `settings.marketplace` for this product (e.g. `amazon.com`) |
| `tagEveryone` | no | When notifying a group, @-mention every participant for this product (defaults to `settings.tagEveryone`) |

### Message placeholders

Use these inside `message` and they are replaced when the notification is sent:

- `{label}` — the product label from your config
- `{name}` — the product title scraped from Amazon
- `{method}` — how it can be bought (`Add to Cart`, `Buy Now` or `Buy Box`)
- `{url}` — the product URL
- `{id}` — the ASIN

### Settings

- `checkIntervalMinutes` — minutes between check rounds (keep it reasonable or Amazon will block you)
- `marketplace` — default Amazon domain, e.g. `amazon.com.mx` or `amazon.com`
- `openBrowser` — open the product page automatically when it's available
- `tagEveryone` — default for @-mentioning all group participants when a product is found (only applies when `NOTIFY_GROUP` is set; ignored for direct messages)

## Usage

```sh
# run the bot
npm start
# run the bot in development mode
npm run dev
```

On the **first run** a QR code is printed in the terminal — scan it with WhatsApp on your phone (Settings > Linked devices), exactly like logging into WhatsApp Web. The session is stored in `.wwebjs_auth/` so you only scan once. The bot sends a start-up message, then notifies you (once per product) as products become available, and exits when everything on the list has been found.

> **Note:** whatsapp-web.js automates WhatsApp Web, which is not officially supported by WhatsApp. Low-volume self-notifications are generally fine, but use it at your own risk.

## License

MIT

**Free Software, Hell Yeah!**
