const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { 
  getAllGuildConfigs, 
  hasSent, 
  markSent,
  getLastDailyAnnouncementDate,
  setLastDailyAnnouncementDate,
  getDailyAnnouncementDateUTC,
} = require("./freeGamesManager.js");

// API configuration
const GAMERPOWER_API = "https://www.gamerpower.com/api/giveaways";
const EPIC_GAMES_API = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions";
const STEAM_API = "https://api.steampowered.com";
const GOG_API = "https://api.gog.com/v1";
const ITCH_IO_API = "https://itch.io/api/1";

function buildFreeGamesPreviewEmbed(offers, totalCount = offers.length, currentPage = 1, totalPages = 1) {
  const embed = new EmbedBuilder()
    .setColor(0xd6aded)
    .setTitle("🎁 Limited-Time Free Games & Giveaways")
    .setDescription(`Limited-time offers only! Showing **${offers.length}** of **${totalCount}** current. Page **${currentPage}/${totalPages}**.`)
    .setTimestamp();

  for (const offer of offers) {
    const priceInfo = offer.fromPrice ? `**$${offer.fromPrice}**` : "N/A";
    
    const description = [
      offer.platform ? `🎮 **${offer.platform}**` : null,
      offer.genre ? `📋 ${offer.genre}` : null,
      `💰 Regular: ${priceInfo}`,
      offer.until ? `⏰ FREE until: **${offer.until}**` : "⏰ **Limited Time**",
      `🔗 [Get Game](${offer.link})`,
    ].filter(Boolean).join("\n");

    embed.addFields({
      name: `${offer.title}`,
      value: description,
      inline: false,
    });
  }

  return embed;
}

function formatDate(dateString) {
  if (!dateString || dateString === "Permanent") return "Permanent";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "GameBoyBot/1.0",
          "Accept": "application/json",
          ...options.headers,
        },
        ...options,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          // Retry on rate limit or server error
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }
  throw lastError;
}

async function fetchGamePowerGiveaways() {
  try {
    const res = await fetchWithRetry(`${GAMERPOWER_API}?sort-by=popularity`, {
      headers: {
        "Accept": "application/json",
      },
    });
    
    const giveaways = await res.json();
    
    if (!Array.isArray(giveaways)) return [];

    // Filter for items with end dates (limited time only) - exclude permanent listings
    return giveaways
      .filter(item => {
        // Only include items that have a real end date (not N/A and not ancient dates)
        return item.end_date && 
               item.end_date !== "N/A" && 
               !item.end_date.includes("N/A") &&
               new Date(item.end_date) > new Date(); // Only future dates
      })
      .slice(0, 30)
      .map(game => ({
        id: `gamerpower:${game.id}`,
        source: "gamerpower",
        sourceType: "giveaway",
        title: game.title || "Free game giveaway",
        platform: normalizePlatform(game.platforms || "PC"),
        genre: null,
        fromPrice: normalizePrice(game.worth) || normalizePrice(game.value),
        until: formatDateString(game.end_date),
        link: game.open_giveaway_url || game.giveaway_url || "https://www.gamerpower.com/",
        thumbnail: null,
        isPermanentFree: false,
        priority: 2, // Medium priority - Giveaways after direct services
      }));
  } catch (err) {
    console.error("[FREE GAMES] GamePower fetch error:", err.message);
    return [];
  }
}

function normalizePlatform(platformText) {
  const text = String(platformText || "").toLowerCase();
  if (!text) return "PC";
  if (text.includes("epic")) return "Epic Games Store";
  if (text.includes("steam")) return "Steam";
  if (text.includes("itch")) return "itch.io";
  if (text.includes("gog")) return "GOG";
  if (text.includes("playstation")) return "PlayStation";
  if (text.includes("xbox")) return "Xbox";
  return "PC";
}

function normalizePrice(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || /^(n\/a|free|unknown|$)$/i.test(text)) return null;
  return text;
}

function formatDateString(dateValue) {
  if (!dateValue || dateValue === "N/A") return "Unknown";
  try {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateValue;
  }
}

function getColorForPlatform(source, platform) {
  // Color scheme per platform/source
  const colorMap = {
    "epic": 0x9D4EDD, // Purple for Epic Games
    "steam": 0x1B4965, // Blue for Steam
    "gog": 0xDC2F02, // Red for GOG
    "itch": 0xFF8C42, // Orange for itch.io
    "gamerpower": 0xFF6B9D, // Pink for all giveaways
  };

  // Check platform if source is gamerpower to get specific color
  if (source === "gamerpower" && platform) {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes("steam")) return colorMap["steam"];
    if (platformLower.includes("gog")) return colorMap["gog"];
    if (platformLower.includes("itch")) return colorMap["itch"];
  }

  return colorMap[source] || colorMap["gamerpower"];
}

async function fetchEpicGamesFree() {
  try {
    const res = await fetchWithRetry(EPIC_GAMES_API);
    const data = await res.json();
    
    if (!data.data || !data.data.catalog || !data.data.catalog.searchStore) return [];

    const now = new Date();
    const games = data.data.catalog.searchStore
      .filter(item => {
        // Only include games with promotions
        if (!item.promotions || !item.promotions.promotionalOffers) return false;
        
        const promo = item.promotions.promotionalOffers[0];
        if (!promo) return false;
        
        const endDate = new Date(promo.promotionEndDate);
        // Only include if the promotion hasn't ended yet
        return endDate > now;
      })
      .slice(0, 20)
      .map(game => {
        const promo = game.promotions.promotionalOffers[0];
        const endDate = new Date(promo.promotionEndDate);
        
        return {
          id: `epic:${game.id}`,
          source: "epic",
          sourceType: "epic-games",
          title: game.title || "Epic Game",
          platform: "Epic Games Store",
          genre: game.genre || null,
          fromPrice: game.price?.originalPrice ? String(game.price.originalPrice / 100) : null,
          until: formatDateString(promo.promotionEndDate),
          link: `https://www.epicgames.com/store/en-US/p/${game.productSlug || game.id}`,
          thumbnail: game.keyImages?.find(img => img.type === "Thumbnail")?.url || null,
          isPermanentFree: false,
          priority: 1, // Highest priority - Direct service
        };
      });

    console.log(`[FREE GAMES] Epic Games: Found ${games.length} free games`);
    return games;
  } catch (err) {
    console.error("[FREE GAMES] Epic Games fetch error:", err.message);
    return [];
  }
}

async function fetchSteamFreeGames() {
  try {
    // Steam doesn't have a direct free games API, but we can use community sources
    // For now, we'll rely on GamePower for Steam games
    // This is a placeholder for future Steam integration
    // When implemented, set priority: 1 and sourceType: "steam"
    return [];
  } catch (err) {
    console.error("[FREE GAMES] Steam fetch error:", err.message);
    return [];
  }
}

async function fetchGOGGiveaways() {
  try {
    // GOG API is limited, but GamePower already covers GOG giveaways
    // This is a placeholder for future GOG integration
    // When implemented, set priority: 1 and sourceType: "gog"
    return [];
  } catch (err) {
    console.error("[FREE GAMES] GOG fetch error:", err.message);
    return [];
  }
}

async function fetchItchIOFreeGames() {
  try {
    // itch.io API requires authentication for detailed data
    // GamePower already covers itch.io giveaways
    // This is a placeholder for future itch.io integration
    // When implemented, set priority: 1 and sourceType: "itch"
    return [];
  } catch (err) {
    console.error("[FREE GAMES] itch.io fetch error:", err.message);
    return [];
  }
}

async function collectFreeGameOffers() {
  try {
    console.log("[FREE GAMES] Starting multi-source fetch...");
    
    // Fetch from all sources in parallel
    const [epicGames, gamePowerGiveaways, steamGames, gogGames, itchGames] = await Promise.all([
      fetchEpicGamesFree(),
      fetchGamePowerGiveaways(),
      fetchSteamFreeGames(),
      fetchGOGGiveaways(),
      fetchItchIOFreeGames(),
    ]);

    // Combine all offers
    const allOffers = [
      ...epicGames,
      ...gamePowerGiveaways,
      ...steamGames,
      ...gogGames,
      ...itchGames,
    ];

    if (allOffers.length === 0) {
      console.warn("[FREE GAMES] No limited-time offers fetched from any source");
      return [];
    }

    // Smarter deduplication: prefer direct services over giveaways
    const deduped = new Map();
    for (const offer of allOffers) {
      const key = offer.title.toLowerCase().trim();
      const existing = deduped.get(key);
      
      if (!existing) {
        // First occurrence, add it
        deduped.set(key, offer);
      } else {
        // Compare priorities: direct services (priority 1) > giveaways (priority 2)
        const existingPriority = existing.priority || 2;
        const offerPriority = offer.priority || 2;
        
        if (offerPriority < existingPriority) {
          // New offer has higher priority (lower number), replace
          deduped.set(key, offer);
        } else if (offerPriority === existingPriority) {
          // Same priority, keep the one expiring sooner
          const existingDate = new Date(existing.until || "2099-12-31");
          const offerDate = new Date(offer.until || "2099-12-31");
          if (offerDate < existingDate) {
            deduped.set(key, offer);
          }
        }
        // If offer has lower priority (higher number), keep existing
      }
    }

    // Sort by priority (direct services first), then by end date (soonest first)
    const sorted = Array.from(deduped.values())
      .sort((a, b) => {
        // First by priority (lower = higher priority)
        const priorityA = a.priority || 2;
        const priorityB = b.priority || 2;
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        // Then by end date (soonest first)
        const dateA = new Date(a.until || "2099-12-31");
        const dateB = new Date(b.until || "2099-12-31");
        return dateA - dateB;
      });

    console.log(`[FREE GAMES] Aggregated ${sorted.length} unique limited-time offers (deduped from ${allOffers.length})`);
    console.log(`[FREE GAMES] Breakdown: Epic=${epicGames.length}, GamePower=${gamePowerGiveaways.length}, Steam=${steamGames.length}, GOG=${gogGames.length}, itch=${itchGames.length}`);
    
    return sorted;
  } catch (err) {
    console.error("[FREE GAMES] Error collecting offers:", err);
    return [];
  }
}

async function updateFreeGamesCache() {
  // Background hourly update - just fetch and cache, no announcements
  try {
    const offers = await collectFreeGameOffers();
    console.log(`[FREE GAMES] Updated cache with ${offers.length} offers`);
    return offers;
  } catch (err) {
    console.error("[FREE GAMES] Error updating cache:", err);
    return [];
  }
}

async function announceDailyFreeGames(client) {
  // Daily announcement at 00:00 UTC - posts top 10 games for the day
  const guildConfigs = getAllGuildConfigs();
  
  if (Object.keys(guildConfigs).length === 0) {
    console.log("[FREE GAMES] No guilds have free games channel configured");
    return 0;
  }

  const offers = await collectFreeGameOffers();
  
  if (!offers.length) {
    console.warn("[FREE GAMES] No limited-time giveaways available to announce");
    return 0;
  }

  const todayDate = getDailyAnnouncementDateUTC();
  let sentCount = 0;

  // Take top 10 games for the daily announcement
  const dailyOffers = offers.slice(0, 10);

  for (const [guildId, config] of Object.entries(guildConfigs)) {
    // Check if already announced today
    const lastAnnouncementDate = getLastDailyAnnouncementDate(guildId);
    if (lastAnnouncementDate === todayDate) {
      console.log(`[FREE GAMES] Guild ${guildId} already received daily announcement today`);
      continue;
    }

    const channel = client.channels.cache.get(config.channelId);
    if (!channel || !channel.isTextBased?.()) {
      console.debug(`[FREE GAMES] Channel not found for guild ${guildId}`);
      continue;
    }

    const permissions = channel.permissionsFor(client.user);
    if (!permissions?.has(PermissionFlagsBits.SendMessages) || !permissions?.has(PermissionFlagsBits.EmbedLinks)) {
      console.warn(`[FREE GAMES] Missing permissions in ${guildId} #${channel.name}`);
      continue;
    }

    try {
      // Create a summary embed showing all 10 games
      const embed = new EmbedBuilder()
        .setTitle("📅 Today's Top 10 Limited-Time Free Games")
        .setDescription(`**${todayDate}** - Updated at 00:00 UTC\n\nGet these games free before they're gone!`)
        .setColor(0xFF6B9D)
        .setTimestamp();

      // Add games as fields
      dailyOffers.forEach((offer, index) => {
        const platformEmoji = offer.source === "epic" ? "🎮" : "🎁";
        const priceInfo = offer.fromPrice ? ` (was ${offer.fromPrice})` : "";
        const value = `**${offer.platform}**${priceInfo}\n⏰ Until: ${offer.until}\n🔗 [Claim](${offer.link})`;
        
        embed.addFields({
          name: `${index + 1}. ${offer.title}`,
          value: value,
          inline: false,
        });
      });

      embed.setFooter({
        text: "Check /freegames check anytime for real-time updates",
      });

      await channel.send({ embeds: [embed] });
      setLastDailyAnnouncementDate(guildId, todayDate);
      sentCount += 1;
      
      console.log(`[FREE GAMES] Posted daily announcement (${dailyOffers.length} games) to guild ${guildId}`);
    } catch (err) {
      console.error(`[FREE GAMES] Failed to post daily announcement to guild ${guildId}:`, err.message);
    }
  }

  console.log(`[FREE GAMES] Daily announcement cycle complete. Sent ${sentCount} announcements.`);
  return sentCount;
}

module.exports = {
  collectFreeGameOffers,
  updateFreeGamesCache,
  announceDailyFreeGames,
  buildFreeGamesPreviewEmbed,
};
