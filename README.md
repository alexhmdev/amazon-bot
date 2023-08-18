# Amazon-bot

This bot is **ONLY FOR LEARNING PURPOSES**

> With this bot you can check product availability using axios and cheerio ?>to load the content and look for the purchase button

## Features

- Phone call notification using [Twilio](https://www.twilio.com/)
- Opening the product page in the browser using [Open](https://www.npmjs.com/package/open)

## Installation

- Amazon-bot requires [Node.js](https://nodejs.org/) (use latest version to run).
- Install the dependencies.

```sh
git clone https://www.github.com/alexhmdev/amazon-bot.git
cd amazon-bot
npm install
```

- Create a .env file in the root directory and add the following variables

```sh
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN
PHONE_TO_NOTIFY=YOUR_PHONE_NUMBER
```

- Add the product id in the index.js file (the id is the part of the url after /dp/ e.g. https://www.amazon.com.mx/dp/B0BJT88GLJ)

```javascript
// Replace with the product ID of the product you want to check
checkProductAvailability('B0BJT88GLJ');
```

## Usage

```sh
# run the bot
npm start
# run the bot in development mode
npm run dev
```

## License

MIT

**Free Software, Hell Yeah!**
