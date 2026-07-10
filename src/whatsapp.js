import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import pico from 'picocolors';

const { Client, LocalAuth } = pkg;

let client = null;
// Every configured destination gets each notification:
// PHONE_TO_NOTIFY (direct message) and/or NOTIFY_GROUP (group)
let targets = [];

/**
 * Connects to WhatsApp Web using your own number. On the first run a QR code
 * is printed in the terminal — scan it from WhatsApp on your phone
 * (Settings > Linked devices). The session is persisted in .wwebjs_auth so
 * you only need to scan once.
 */
export async function initWhatsApp(phoneToNotify, groupName) {
  if (!phoneToNotify && !groupName) {
    throw new Error(
      'Set PHONE_TO_NOTIFY and/or NOTIFY_GROUP in your .env so the bot knows where to send notifications.'
    );
  }

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

  targets = [];

  if (phoneToNotify) {
    // Resolve the real chat id so country quirks (like Mexico's 521 prefix)
    // are handled by WhatsApp instead of by us
    const digits = phoneToNotify.replace(/\D/g, '');
    const numberId = await client.getNumberId(digits);
    if (!numberId) {
      throw new Error(
        `The number ${phoneToNotify} is not registered on WhatsApp. Check PHONE_TO_NOTIFY in your .env (include the country code, e.g. +5215512345678).`
      );
    }
    targets.push({
      chatId: numberId._serialized,
      isGroup: false,
      description: phoneToNotify,
    });
  }

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
    targets.push({
      chatId: group.id._serialized,
      isGroup: true,
      description: `group "${group.name}"`,
    });
  }

  console.log(
    pico.green(
      `WhatsApp connected ✓ — notifying ${targets
        .map((target) => target.description)
        .join(' and ')}`
    )
  );
}

/**
 * Sends a message to every configured destination. With tagEveryone, group
 * destinations @-mention every participant so they all get a notification;
 * direct messages are sent as-is.
 */
export async function sendWhatsApp(message, { tagEveryone = false } = {}) {
  if (!client || targets.length === 0) {
    throw new Error('WhatsApp client is not initialized');
  }

  for (const target of targets) {
    if (tagEveryone && target.isGroup) {
      const chat = await client.getChatById(target.chatId);
      const mentions = chat.participants.map(
        (participant) => participant.id._serialized
      );
      const tags = chat.participants
        .map((participant) => `@${participant.id.user}`)
        .join(' ');
      await client.sendMessage(target.chatId, `${message}\n\n${tags}`, {
        mentions,
      });
    } else {
      await client.sendMessage(target.chatId, message);
    }
  }
}

export async function destroyWhatsApp() {
  if (client) {
    await client.destroy();
    client = null;
    targets = [];
  }
}
