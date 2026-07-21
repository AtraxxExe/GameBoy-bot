const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE = path.join(__dirname, "freeGames.json");

function defaultData() {
  return {
    guilds: {},
    sent: {},
    dailyAnnouncements: {}, // Track last daily announcement per guild: { guildId: "2026-07-21" }
  };
}

function getData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData(), null, 2), "utf-8");
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return {
      guilds: data.guilds || {},
      sent: data.sent || {},
      dailyAnnouncements: data.dailyAnnouncements || {},
    };
  } catch (err) {
    return defaultData();
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

module.exports = {
  setGuildChannel(guildId, channelId) {
    const data = getData();
    data.guilds[guildId] = { channelId };
    saveData(data);
    return data.guilds[guildId];
  },

  getGuildChannel(guildId) {
    const data = getData();
    return data.guilds[guildId] || null;
  },

  getAllGuildConfigs() {
    return getData().guilds;
  },

  hasSent(source, id) {
    const data = getData();
    return Boolean(data.sent?.[source]?.[id]);
  },

  markSent(source, id, payload = {}) {
    const data = getData();
    data.sent[source] ??= {};
    data.sent[source][id] = {
      ...payload,
      sentAt: Date.now(),
    };
    saveData(data);
  },

  getLastDailyAnnouncementDate(guildId) {
    const data = getData();
    return data.dailyAnnouncements[guildId] || null;
  },

  setLastDailyAnnouncementDate(guildId, dateString) {
    const data = getData();
    data.dailyAnnouncements[guildId] = dateString; // Format: "2026-07-21"
    saveData(data);
  },

  getDailyAnnouncementDateUTC() {
    // Returns current date in UTC format: "2026-07-21"
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
};
