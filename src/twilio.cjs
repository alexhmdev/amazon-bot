/* eslint-disable no-undef */
// Download the helper library from https://www.twilio.com/docs/node/install
// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

function createCall(phoneNumber, message) {
  client.calls.create({
    twiml: `<Response><Say>${message}</Say></Response>`,
    to: phoneNumber,
    from: process.env.TWILIO_PHONE_NUMBER,
  });
}

function createMessage(phoneNumber, message) {
  console.log(process.env.TWILIO_WHATSAPP_NUMBER);
  client.messages
    .create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      // insert 1 after the country code change if you are not from Mexico
      to: `whatsapp:+521${phoneNumber.substring(3)}`,
    })
    .then((message) => console.log(message.sid))
    .catch((err) => console.log(err));
}

module.exports = { createCall, createMessage };
