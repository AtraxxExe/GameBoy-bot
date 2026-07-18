const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE = path.join(__dirname, "levels.json");
const VOICE_DATA_FILE = path.join(__dirname, "voiceData.json");

function getData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")); }
  catch (err) { return { settings: {}, users: {} }; }
}

function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8"); }

function loadVoiceData() {
  if (!fs.existsSync(VOICE_DATA_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(VOICE_DATA_FILE, "utf8")); }
  catch (err) { return {}; }
}

function saveVoiceData(data) { fs.writeFileSync(VOICE_DATA_FILE, JSON.stringify(data, null, 2), "utf-8"); }

module.exports = {
  getRequiredForLevel(level) {
    return 5 * (level + 1) * (level + 2);
  },

  addMessage(guildId, userId) {
    const data = getData();
    if (!data.users[guildId]) data.users[guildId] = {};
    if (!data.users[guildId][userId]) data.users[guildId][userId] = { messages: 0, level: 0 };
    
    const user = data.users[guildId][userId];
    user.messages += 1;
    
    let leveledUp = false;
    let required = this.getRequiredForLevel(user.level);
    
    if (user.messages >= required) {
      user.level += 1;
      leveledUp = true;
    }
    
    saveData(data);
    return { user, leveledUp, nextReq: this.getRequiredForLevel(user.level) };
  },

  getGuildUsers(guildId) { return getData().users[guildId] || {}; },
  
  saveSettings(guildId, config) { 
    const data = getData();
    data.settings[guildId] = config;
    saveData(data);
  },
  
  resetGuild(guildId) {
    const data = getData();
    if (data.users[guildId]) delete data.users[guildId];
    if (data.settings[guildId]) delete data.settings[guildId];
    saveData(data);
  },

  getSettings(guildId) { return getData().settings[guildId] || null; },

  addVoiceTime: (guildId, userId, durationMs) => {
    const data = loadVoiceData();
    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId][userId]) data[guildId][userId] = 0;
    
    data[guildId][userId] += durationMs;
    saveVoiceData(data);
  },
  
  getVoiceTime: (guildId, userId) => {
    const data = loadVoiceData();
    const timeMs = data[guildId]?.[userId] || 0;
    const totalMinutes = Math.floor(timeMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
};