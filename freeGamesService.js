const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getAllGuildConfigs, hasSent, markSent } = require("./freeGamesManager.js");

function buildFreeGamesPreviewEmbed(offers, totalCount = offers.length, currentPage = 1, totalPages = 1) {
  const embed = new EmbedBuilder()
    .setColor(0xd6aded)
    .setTitle("🎮 Free game preview")
    .setDescription(`Fresh picks from the latest public giveaway feed. Showing **${offers.length}** of **${totalCount}** current results. Page **${currentPage}/${totalPages}**.`)
    .setTimestamp();

  for (const offer of offers) {
    const fields = [
      `• Platform: **${offer.platform || "Unknown"}**`,
      offer.fromPrice ? `• Regular price: **${offer.fromPrice}**` : null,
      offer.until ? `• Free until: **${formatDate(offer.until)}**` : "• Limited-time listing currently live",
      `• [Open giveaway](${offer.link})`,
    ].filter(Boolean);

    embed.addFields({
      name: `${offer.title}`,
      value: fields.join("\n"),
      inline: false,
    });
  }

  return embed;
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizePlatform(platformText) {
  const text = String(platformText || "").toLowerCase();
  if (!text) return "PC";
  if (text.includes("epic")) return "Epic Games Store";
  if (text.includes("steam")) return "Steam";
  if (text.includes("itch")) return "itch.io";
  if (text.includes("gog")) return "GOG";
  if (text.includes("playstation")) return "PlayStation";
  return "PC";
}

function normalizePrice(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || /^(n\/a|free|unknown)$/i.test(text)) return null;
  return text;
}

async function fetchGamerPowerFreeGames() {
  const res = await fetch("https://www.gamerpower.com/api/giveaways?sort-by=popularity", {
    headers: {
      "User-Agent": "GameBoyBot/1.0 (+https://github.com/)",
      "Accept": "application/json",
    },
  });

  if (!res.ok) return [];

  const items = await res.json();
  if (!Array.isArray(items)) return [];

  return items
    .filter(item => {
      const sourceText = `${item.title || ""} ${item.platforms || ""} ${item.instructions || ""}`.toLowerCase();
      return /(steam|epic|itch|gog|playstation|pc)/i.test(sourceText);
    })
    .slice(0, 20)
    .map(game => ({
      id: `gamerpower:${game.id || game.open_giveaway_url || game.title}`,
      source: "gamerpower",
      title: game.title || "Free game giveaway",
      platform: normalizePlatform(game.platforms),
      fromPrice: normalizePrice(game.worth) || normalizePrice(game.value) || normalizePrice(game.normal_price) || normalizePrice(game.price),
      until: game.end_date && game.end_date !== "N/A" ? game.end_date : null,
      link: game.open_giveaway_url || game.giveaway_url || "https://www.gamerpower.com/",
    }));
}

async function collectFreeGameOffers() {
  return fetchGamerPowerFreeGames();
}

async function announceFreeGames(client) {
  const guildConfigs = getAllGuildConfigs();
  const offers = await collectFreeGameOffers();
  const newestOffers = offers.slice(0, 3);

  if (!newestOffers.length) return 0;

  let sentCount = 0;

  for (const [guildId, config] of Object.entries(guildConfigs)) {
    const channel = client.channels.cache.get(config.channelId);
    if (!channel || !channel.isTextBased?.()) continue;

    const permissions = channel.permissionsFor(client.user);
    if (!permissions?.has(PermissionFlagsBits.SendMessages) || !permissions?.has(PermissionFlagsBits.EmbedLinks)) {
      console.warn(`Skipping free-game announce in ${guildId}: missing send/embed permissions in ${config.channelId}`);
      continue;
    }

    for (const offer of newestOffers) {
      if (hasSent(offer.source, offer.id)) continue;

      const fields = [
        { name: "Platform", value: offer.platform || "Platform unavailable", inline: true },
        ...(offer.fromPrice ? [{ name: "Regular price", value: offer.fromPrice, inline: true }] : []),
        { name: "Limited time", value: offer.until ? `Free until ${formatDate(offer.until)}` : "Free now on the current listing", inline: false },
        { name: "Link", value: `[Open giveaway page](${offer.link})`, inline: false },
      ];

      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${offer.title}`)
        .setColor(0xd6aded)
        .addFields(fields)
        .setFooter({ text: `FREE GAMES • ${offer.source.toUpperCase()}` })
        .setTimestamp();

      try {
        await channel.send({ embeds: [embed] });
        markSent(offer.source, offer.id, { title: offer.title, link: offer.link });
        sentCount += 1;
      } catch (err) {
        console.error(`Failed to post free-game announcement to ${guildId}:`, err);
      }
    }
  }

  return sentCount;
}

module.exports = {
  collectFreeGameOffers,
  announceFreeGames,
  buildFreeGamesPreviewEmbed,
};
