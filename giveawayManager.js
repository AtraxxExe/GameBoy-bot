const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require("discord.js");

const DATA_FILE = path.join(__dirname, "giveaways.json");
const BUTTON_PREFIX = "giveaway_join_";
const BUTTON_LABEL = "Enter the Giveaway";

function ensureStore() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ giveaways: [] }, null, 2), "utf-8");
  }
}

function loadGiveaways() {
  ensureStore();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.giveaways)) {
      parsed.giveaways = [];
    }
    return parsed.giveaways;
  } catch (err) {
    console.error("Failed to load giveaways store:", err);
    return [];
  }
}

function saveGiveaways(giveaways) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ giveaways }, null, 2), "utf-8");
}

function normalizeHexColor(value) {
  if (!value) return 0xd6aded;
  const text = String(value).trim();
  const normalized = text.startsWith("#") ? text.slice(1) : text;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return 0xd6aded;
  }
  return Number.parseInt(normalized, 16);
}

function normalizeButtonStyle(value) {
  const map = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
  };
  return map[String(value || "primary").toLowerCase()] || ButtonStyle.Primary;
}

function msToHoursMinutesSeconds(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function parseCountdownToMs(value) {
  if (typeof value !== "string") return NaN;

  const text = value.trim().replace(/\s+/g, "").toLowerCase();
  if (!text) return NaN;

  const hhmmssMatch = text.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hhmmssMatch) {
    const hours = Number(hhmmssMatch[1]);
    const minutes = Number(hhmmssMatch[2]);
    const seconds = Number(hhmmssMatch[3]);
    if (
      Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(seconds) &&
      minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60
    ) {
      return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
    }
  }

  const colonMatch = text.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const hours = Number(colonMatch[1]);
    const minutes = Number(colonMatch[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes) && minutes >= 0 && minutes < 60) {
      return ((hours * 3600) + (minutes * 60)) * 1000;
    }
  }

  const combinedMatch = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (combinedMatch) {
    const hours = Number(combinedMatch[1] || 0);
    const minutes = Number(combinedMatch[2] || 0);
    const seconds = Number(combinedMatch[3] || 0);

    if (
      Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(seconds) &&
      minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60
    ) {
      return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
    }
  }

  const minuteOnlyMatch = text.match(/^(\d+)m$/i);
  if (minuteOnlyMatch) {
    const minutes = Number(minuteOnlyMatch[1]);
    if (Number.isFinite(minutes) && minutes >= 0) {
      return minutes * 60 * 1000;
    }
  }

  const hourOnlyMatch = text.match(/^(\d+)h$/i);
  if (hourOnlyMatch) {
    const hours = Number(hourOnlyMatch[1]);
    if (Number.isFinite(hours) && hours >= 0) {
      return hours * 3600 * 1000;
    }
  }

  const secondOnlyMatch = text.match(/^(\d+)s$/i);
  if (secondOnlyMatch) {
    const seconds = Number(secondOnlyMatch[1]);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }

  return NaN;
}

function buildButton(buttonColor) {
  return new ButtonBuilder()
    .setCustomId(BUTTON_PREFIX + "placeholder")
    .setLabel(BUTTON_LABEL)
    .setStyle(normalizeButtonStyle(buttonColor));
}

function buildGiveawayCard(giveaway) {
  const remainingMs = Math.max(0, giveaway.endAt - Date.now());
  const stage = remainingMs > 0 ? `Ends <t:${Math.floor(giveaway.endAt / 1000)}:R>` : "Completed";
  const button = buildButton(giveaway.buttonColor);
  button.setCustomId(`${BUTTON_PREFIX}${giveaway.id}`);
  const entryCount = Array.isArray(giveaway.entries) ? giveaway.entries.length : 0;

  const embed = new EmbedBuilder()
    .setTitle(giveaway.title)
    .setDescription(giveaway.text)
    .setColor(normalizeHexColor(giveaway.color))
    .addFields(
      { name: "Entries", value: String(entryCount), inline: true },
      { name: "Status", value: stage, inline: false },
    );

  if (giveaway.imageUrl) {
    embed.setImage(giveaway.imageUrl);
  }

  return {
    embed,
    row: new ActionRowBuilder().addComponents(button),
  };
}

function createGiveaway({ guildId, channelId, title, text, color, buttonColor, imageUrl, durationMs }) {
  const giveaway = {
    id: crypto.randomUUID(),
    guildId,
    channelId,
    title: title || "Giveaway",
    text: text || "Join below to enter the giveaway.",
    color,
    buttonColor,
    imageUrl: imageUrl || null,
    createdAt: Date.now(),
    endAt: Date.now() + durationMs,
    entries: [],
    status: "active",
    messageId: null,
  };

  const giveaways = loadGiveaways();
  giveaways.push(giveaway);
  saveGiveaways(giveaways);
  return giveaway;
}

async function postGiveawayMessage(client, giveaway) {
  const channel = client.channels.cache.get(giveaway.channelId);
  if (!channel?.isTextBased?.()) {
    throw new Error(`Channel ${giveaway.channelId} is unavailable`);
  }

  const payload = buildGiveawayCard(giveaway);

  if (giveaway.messageId) {
    const existingMessage = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (existingMessage) {
      await existingMessage.edit({ embeds: [payload.embed], components: [payload.row] }).catch(() => {});
      return existingMessage;
    }
  }

  const message = await channel.send({ embeds: [payload.embed], components: [payload.row] });
  giveaway.messageId = message.id;
  saveGiveaways(loadGiveaways().map(item => item.id === giveaway.id ? giveaway : item));
  return message;
}

async function refreshGiveawayMessage(client, giveaway) {
  if (!giveaway.messageId) return;
  const channel = client.channels.cache.get(giveaway.channelId);
  if (!channel?.isTextBased?.()) return;

  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) {
    giveaway.status = "expired";
    saveGiveaways(loadGiveaways().map(item => item.id === giveaway.id ? giveaway : item));
    return;
  }

  const payload = buildGiveawayCard(giveaway);
  await message.edit({ embeds: [payload.embed], components: [payload.row] }).catch(() => {});
}

async function handleJoinInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith(BUTTON_PREFIX)) {
    return false;
  }

  const giveawayId = interaction.customId.replace(BUTTON_PREFIX, "");
  const giveaways = loadGiveaways();
  const giveaway = giveaways.find(item => item.id === giveawayId);

  if (!giveaway) {
    await interaction.reply({ content: "This giveaway is no longer active.", flags: [MessageFlags.Ephemeral] });
    return true;
  }

  if (giveaway.status !== "active" || giveaway.endAt <= Date.now()) {
    giveaway.status = "expired";
    saveGiveaways(giveaways.filter(item => item.id !== giveaway.id));
    await interaction.reply({ content: "This giveaway is no longer active.", flags: [MessageFlags.Ephemeral] });
    return true;
  }

  if (giveaway.entries.includes(interaction.user.id)) {
    await interaction.reply({ content: "You have already entered this giveaway once.", flags: [MessageFlags.Ephemeral] });
    return true;
  }

  giveaway.entries.push(interaction.user.id);
  saveGiveaways(giveaways.map(item => item.id === giveaway.id ? giveaway : item));
  await refreshGiveawayMessage(interaction.client, giveaway).catch(() => {});
  await interaction.reply({ content: "You’re in! Your entry has been recorded.", flags: [MessageFlags.Ephemeral] });
  return true;
}

async function tickGiveaways(client) {
  const giveaways = loadGiveaways();
  const now = Date.now();

  for (const giveaway of giveaways) {
    if (giveaway.status !== "active") continue;
    if (giveaway.endAt > now) {
      await refreshGiveawayMessage(client, giveaway).catch(() => {});
      continue;
    }

    const entries = Array.from(new Set(giveaway.entries || []));
    giveaway.entries = entries;

    if (!entries.length) {
      giveaway.status = "completed";
      saveGiveaways(giveaways.map(item => item.id === giveaway.id ? giveaway : item));
      const channel = client.channels.cache.get(giveaway.channelId);
      if (channel?.isTextBased?.()) {
        await channel.send({ content: `No entries were recorded for the **${giveaway.title}** giveaway, so it ended without a winner.` }).catch(() => {});
      }
      continue;
    }

    const winnerId = entries[Math.floor(Math.random() * entries.length)];
    const winnerMention = `<@${winnerId}>`;
    giveaway.status = "completed";
    giveaway.winnerId = winnerId;
    saveGiveaways(giveaways.map(item => item.id === giveaway.id ? giveaway : item));

    const channel = client.channels.cache.get(giveaway.channelId);
    if (channel?.isTextBased?.()) {
      await channel.send({ content: `${winnerMention} won the **${giveaway.title}** giveaway! Congrats!` }).catch(() => {});
    }

    await refreshGiveawayMessage(client, giveaway).catch(() => {});
  }
}

async function restoreGiveaways(client) {
  const giveaways = loadGiveaways();
  for (const giveaway of giveaways) {
    if (giveaway.status !== "active") continue;
    try {
      await postGiveawayMessage(client, giveaway);
    } catch (err) {
      console.error(`Failed to restore giveaway ${giveaway.id}:`, err);
      giveaway.status = "expired";
      saveGiveaways(giveaways.map(item => item.id === giveaway.id ? giveaway : item));
    }
  }
}

function getAllGiveaways() {
  return loadGiveaways();
}

async function removeLatestGiveaway(client, guildId) {
  const giveaways = loadGiveaways();
  const active = giveaways
    .filter(item => item.guildId === guildId && item.status === "active")
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const latest = active[active.length - 1];
  if (!latest) return false;

  const channel = client.channels.cache.get(latest.channelId);
  if (channel?.isTextBased?.() && latest.messageId) {
    await channel.messages.delete(latest.messageId).catch(() => {});
  }

  const nextGiveaways = giveaways.filter(item => item.id !== latest.id);
  saveGiveaways(nextGiveaways);
  return true;
}

module.exports = {
  BUTTON_PREFIX,
  BUTTON_LABEL,
  buildGiveawayCard,
  createGiveaway,
  postGiveawayMessage,
  restoreGiveaways,
  tickGiveaways,
  handleJoinInteraction,
  getAllGiveaways,
  removeLatestGiveaway,
  parseCountdownToMs,
  normalizeHexColor,
  normalizeButtonStyle,
  msToHoursMinutesSeconds,
};