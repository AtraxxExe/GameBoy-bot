const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE = path.join(__dirname, "freeGames.json");

function defaultData() {
  return {
    guilds: {},
    sent: {},
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
};
