const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE = path.join(__dirname, "welcomeGoodbyeConfig.json");

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ welcomes: {}, goodbyes: {}, hiddenlogs: {} }), "utf-8");
}

function getData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    
    if (!data.welcomes) data.welcomes = {};
    if (!data.goodbyes) data.goodbyes = {};
    if (!data.hiddenlogs) data.hiddenlogs = {};
    
    return data;
  } catch (err) {
    return { welcomes: {}, goodbyes: {}, hiddenlogs: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

module.exports = {
  saveConfig(type, guildId, configData) {
    const data = getData();
    
    if (!data[type]) data[type] = {};
    
    data[type][guildId] = configData;
    saveData(data);
  },

  getConfig(type, guildId) {
    const data = getData();
    return data[type]?.[guildId] || null;
  },

  removeConfig(type, guildId) {
    const data = getData();
    if (data[type] && data[type][guildId]) {
      delete data[type][guildId];
      saveData(data);
      return true;
    }
    return false;
  },

  parsePlaceholders(text, member) {
    if (!text) return "";
    return text
      .replace(/{username}/g, member.user.username)
      .replace(/{mention}/g, `<@${member.id}>`)
      .replace(/{member_count}/g, member.guild.memberCount)
      .replace(/{server_name}/g, member.guild.name);
  }
};