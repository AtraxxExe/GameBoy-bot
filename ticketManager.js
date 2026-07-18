const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE = path.join(__dirname, "tickets.json");

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ configs: {}, counters: {}, active: {} }), "utf-8");
}

function getData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (err) {
    return { configs: {}, counters: {}, active: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

module.exports = {
  saveConfig(guildId, requestChannelId, centralChannelId, categoryId) {
    const data = getData();
    data.configs[guildId] = { requestChannelId, centralChannelId, categoryId };
    saveData(data);
  },

  getConfig(guildId) {
    return getData().configs[guildId];
  },

  getNextTicketId(guildId) {
    const data = getData();
    if (!data.counters[guildId]) data.counters[guildId] = 0;
    data.counters[guildId]++;
    saveData(data);
    return data.counters[guildId];
  },

  trackActiveTicket(guildId, channelId, userId, roleId, ticketNumber) {
    const data = getData();
    data.active[channelId] = { guildId, userId, roleId, ticketNumber };
    saveData(data);
  },

  getActiveTicket(channelId) {
    return getData().active[channelId];
  },

  removeActiveTicket(channelId) {
    const data = getData();
    delete data.active[channelId];
    saveData(data);
  }
};