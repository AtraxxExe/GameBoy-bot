const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE = path.join(__dirname, "levels.json");
const VOICE_DATA_FILE = path.join(__dirname, "voiceData.json");

function toSafeInteger(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function normalizeUserRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { messages: 0, level: 0 };
  }

  const messages = toSafeInteger(record.messages, 0);
  return {
    messages,
    level: computeLevelFromMessages(messages)
  };
}

function normalizeData(data) {
  const safeData = {
    settings: {},
    users: {}
  };

  if (data?.settings && typeof data.settings === "object") {
    safeData.settings = data.settings;
  }

  if (data?.users && typeof data.users === "object") {
    for (const [guildId, guildUsers] of Object.entries(data.users)) {
      if (!guildUsers || typeof guildUsers !== "object" || Array.isArray(guildUsers)) {
        continue;
      }

      safeData.users[guildId] = {};
      for (const [userId, user] of Object.entries(guildUsers)) {
        safeData.users[guildId][userId] = normalizeUserRecord(user);
      }
    }
  }

  return safeData;
}

function getData() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    const normalized = normalizeData(raw);

    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
      saveData(normalized);
    }

    return normalized;
  } catch (err) {
    return { settings: {}, users: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalizeData(data), null, 2), "utf-8");
}

function computeLevelFromMessages(messageCount) {
  const safeMessageCount = Math.max(0, toSafeInteger(messageCount, 0));
  let level = 0;
  let required = 5 * (level + 1) * (level + 2);

  while (safeMessageCount >= required) {
    level += 1;
    required = 5 * (level + 1) * (level + 2);
  }

  return level;
}

function loadVoiceData() {
  if (!fs.existsSync(VOICE_DATA_FILE)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(VOICE_DATA_FILE, "utf8"));
    const normalized = Object.fromEntries(
      Object.entries(raw || {}).map(([guildId, guildUsers]) => [guildId, Object.fromEntries(
        Object.entries(guildUsers || {}).map(([userId, durationMs]) => [userId, Math.max(0, toSafeInteger(durationMs, 0))])
      )])
    );

    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
      saveVoiceData(normalized);
    }

    return normalized;
  } catch (err) {
    return {};
  }
}

function saveVoiceData(data) { fs.writeFileSync(VOICE_DATA_FILE, JSON.stringify(data, null, 2), "utf-8"); }

module.exports = {
  getRequiredForLevel(level) {
    const safeLevel = Math.max(0, toSafeInteger(level, 0));
    return 5 * (safeLevel + 1) * (safeLevel + 2);
  },

  addMessage(guildId, userId) {
    const data = getData();
    if (!data.users[guildId]) data.users[guildId] = {};
    if (!data.users[guildId][userId]) data.users[guildId][userId] = { messages: 0, level: 0 };

    const user = normalizeUserRecord(data.users[guildId][userId]);
    const previousLevel = user.level;
    user.messages += 1;
    user.level = computeLevelFromMessages(user.messages);

    const leveledUp = user.level > previousLevel;
    data.users[guildId][userId] = user;

    saveData(data);
    return { user, leveledUp, nextReq: this.getRequiredForLevel(user.level) };
  },

  getGuildUsers(guildId) {
    const data = getData();
    const guildUsers = data.users[guildId] || {};
    return Object.fromEntries(
      Object.entries(guildUsers).map(([userId, user]) => [userId, normalizeUserRecord(user)])
    );
  },
  
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
    
    data[guildId][userId] += Math.max(0, toSafeInteger(durationMs, 0));
    saveVoiceData(data);
  },
  
  getVoiceTime: (guildId, userId) => {
    const data = loadVoiceData();
    const timeMs = Math.max(0, toSafeInteger(data[guildId]?.[userId], 0));
    const totalMinutes = Math.floor(timeMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
};