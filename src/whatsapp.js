import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import pico from 'picocolors';

const { Client, LocalAuth } = pkg;

let client = null;
let chatId = null;
let isGroup = false;

/**
 * Connects to WhatsApp Web using your own number. On the first run a QR code
 * is printed in the terminal — scan it from WhatsApp on your phone
 * (Settings > Linked devices). The session is persisted in .wwebjs_auth so
 * you only need to scan once.
 *
 * Notifications go to the group named in NOTIFY_GROUP if set (your account
 * must be a member), otherwise directly to PHONE_TO_NOTIFY.
 */
export async function initWhatsApp(phoneToNotify, groupName) {
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

  if (groupName) {
    const chats = await client.getChats();
    const group = chats.find(
      (chat) =>
        chat.isGroup &&
        chat.name.toLowerCase() === groupName.toLowerCase().trim()
    );
    if (!group) {
      const available = chats
        .filter((chat) => chat.isGroup)
        .map((chat) => `  • ${chat.name}`)
        .join('\n');
      throw new Error(
        `Group "${groupName}" not found. Groups you are a member of:\n${available}`
      );
    }
    chatId = group.id._serialized;
    isGroup = true;
    console.log(
      pico.green(`WhatsApp connected ✓ — notifying group "${group.name}"`)
    );
    return;
  }

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
  isGroup = false;
  console.log(pico.green(`WhatsApp connected ✓ — notifying ${phoneToNotify}`));
}

/**
 * Sends a message to the configured chat. With tagEveryone (groups only)
 * every participant is @-mentioned so they all get a notification.
 */
export async function sendWhatsApp(message, { tagEveryone = false } = {}) {
  if (!client || !chatId) {
    throw new Error('WhatsApp client is not initialized');
  }

  if (tagEveryone && isGroup) {
    const chat = await client.getChatById(chatId);
    const mentions = chat.participants.map(
      (participant) => participant.id._serialized
    );
    const tags = chat.participants
      .map((participant) => `@${participant.id.user}`)
      .join(' ');
    await client.sendMessage(chatId, `${message}\n\n${tags}`, { mentions });
    return;
  }

  await client.sendMessage(chatId, message);
}

export async function destroyWhatsApp() {
  if (client) {
    await client.destroy();
    client = null;
    chatId = null;
    isGroup = false;
  }
}
