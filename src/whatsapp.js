import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import pico from 'picocolors';

const { Client, LocalAuth } = pkg;

let client = null;
let chatId = null;

/**
 * Connects to WhatsApp Web using your own number. On the first run a QR code
 * is printed in the terminal — scan it from WhatsApp on your phone
 * (Settings > Linked devices). The session is persisted in .wwebjs_auth so
 * you only need to scan once.
 */
export async function initWhatsApp(phoneToNotify) {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  await new Promise((resolve, reject) => {
    client.on('qr', (qr) => {
      console.log(
        pico.cyan(
          '\nScan this QR code with WhatsApp on your phone (Settings > Linked devices):\n'
        )
      );
      qrcode.generate(qr, { small: true });
    });
    client.on('auth_failure', (message) =>
      reject(new Error(`WhatsApp authentication failed: ${message}`))
    );
    client.on('ready', resolve);
    client.initialize().catch(reject);
  });

  // Resolve the real chat id so country quirks (like Mexico's 521 prefix)
  // are handled by WhatsApp instead of by us
  const digits = phoneToNotify.replace(/\D/g, '');
  const numberId = await client.getNumberId(digits);
  if (!numberId) {
    throw new Error(
      `The number ${phoneToNotify} is not registered on WhatsApp. Check PHONE_TO_NOTIFY in your .env (include the country code, e.g. +5215512345678).`
    );
  }
  chatId = numberId._serialized;
  console.log(pico.green('WhatsApp connected ✓'));
}

export async function sendWhatsApp(message) {
  if (!client || !chatId) {
    throw new Error('WhatsApp client is not initialized');
  }
  await client.sendMessage(chatId, message);
}

export async function destroyWhatsApp() {
  if (client) {
    await client.destroy();
    client = null;
    chatId = null;
  }
}
