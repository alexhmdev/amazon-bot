// Download the helper library from https://www.twilio.com/docs/node/install
// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

function createCall(phoneNumber) {
  client.calls.create({
    url: 'http://demo.twilio.com/docs/voice.xml',
    to: phoneNumber,
    from: process.env.TWILIO_PHONE_NUMBER,
  });
}

module.exports = createCall;
