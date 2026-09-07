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
    // Pin a known-working WhatsApp Web build instead of always fetching the
    // live version — WA ships breaking internal changes faster than
    // whatsapp-web.js can track them, which crashes getChats()/evaluate calls.
    webVersionCache: {
      type: 'remote',
      remotePath:
        'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
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
    // client.getChats() calls chat.serialize() on every chat via Promise.all —
    // one malformed chat (e.g. a channel/newsletter entry) throws and kills the
    // whole batch. Pull raw id/name straight from the Store instead, skipping
    // chats that can't be read, so a single bad chat doesn't block group lookup.
    const groups = await client.pupPage.evaluate(() => {
      const chats = window.require('WAWebCollections').Chat.getModelsArray();
      const results = [];
      for (const chat of chats) {
        if (!chat.groupMetadata) continue;
        try {
          results.push({
            id: chat.id._serialized,
            name: chat.name || chat.formattedTitle || '',
          });
        } catch {
          // unreadable chat, skip it
        }
      }
      return results;
    });
    const group = groups.find(
      (chat) => chat.name.toLowerCase() === groupName.toLowerCase().trim()
    );
    if (!group) {
      const available = groups
        .map((chat) => `  • ${chat.name}`)
        .join('\n');
      throw new Error(
        `Group "${groupName}" not found. Groups you are a member of:\n${available}`
      );
    }
    targets.push({
      chatId: group.id,
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
    try {
      if (tagEveryone && target.isGroup) {
        // getChatById()'s model-building (serialize() + LID-to-phone
        // migration + a live groupMetadata network refresh) crashes on some
        // accounts — same failure class as the getChats() bug worked around
        // above. Pull participants straight from the Store instead.
        const selfId = client.info.wid._serialized;
        const { mentions, tags } = await client.pupPage.evaluate(
          (chatId, selfId) => {
            const chatWid = window.require('WAWebWidFactory').createWid(chatId);
            const chat = window.require('WAWebCollections').Chat.get(chatWid);
            const participants =
              chat?.groupMetadata?.participants?.getModelsArray() ?? [];

            // Own id and participant ids can each be in either phone
            // (@c.us) or WhatsApp's newer privacy-number (@lid) form, so a
            // raw string compare can miss a self-match. Normalize both sides
            // with toPn (lid -> phone) and compare every combination.
            const { toPn } = window.require('WAWebLidMigrationUtils');
            const idVariants = (wid) => {
              const variants = new Set([wid._serialized]);
              try {
                const pn = toPn(wid);
                if (pn) variants.add(pn._serialized);
              } catch {
                // no phone-number mapping available, raw id is all we have
              }
              return variants;
            };
            const selfWid = window.require('WAWebWidFactory').createWid(selfId);
            const selfVariants = idVariants(selfWid);
            const others = participants.filter((participant) => {
              const variants = idVariants(participant.id);
              return ![...variants].some((v) => selfVariants.has(v));
            });
            return {
              mentions: others.map(
                (participant) => participant.id._serialized
              ),
              tags: others
                .map((participant) => `@${participant.id.user}`)
                .join(' '),
            };
          },
          target.chatId,
          selfId
        );
        await client.sendMessage(target.chatId, `${message}\n\n${tags}`, {
          mentions,
        });
      } else {
        await client.sendMessage(target.chatId, message);
      }
    } catch (error) {
      console.log(
        pico.red(
          `Failed to notify ${target.description}: ${error.stack || error}`
        )
      );
      if (tagEveryone && target.isGroup) {
        console.log(pico.yellow(`Retrying ${target.description} without mentions...`));
        await client.sendMessage(target.chatId, message).catch((fallbackError) => {
          console.log(
            pico.red(`Fallback send to ${target.description} also failed: ${fallbackError.stack || fallbackError}`)
          );
        });
      }
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
