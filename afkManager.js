const fs = require("node:fs");
const path = require("node:path");

const storagePath = path.join(__dirname, "afkData.json");

function readData() {
  try {
    if (!fs.existsSync(storagePath)) {
      fs.writeFileSync(storagePath, JSON.stringify({ afks: {} }, null, 2), "utf-8");
      return { afks: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
    return { afks: parsed.afks || {} };
  } catch (err) {
    return { afks: {} };
  }
}

function writeData(data) {
  fs.writeFileSync(storagePath, JSON.stringify(data, null, 2), "utf-8");
}

function setAfk(guildId, userId, details) {
  const data = readData();
  if (!data.afks[guildId]) data.afks[guildId] = {};

  data.afks[guildId][userId] = {
    guildId,
    userId,
    reason: details.reason || null,
    startedAt: details.startedAt || Date.now(),
    mentions: []
  };

  writeData(data);
  return data.afks[guildId][userId];
}

function getAfk(guildId, userId) {
  const data = readData();
  return data.afks[guildId]?.[userId] || null;
}

function getAfkUsers(guildId) {
  const data = readData();
  return Object.keys(data.afks[guildId] || {});
}

function removeAfk(guildId, userId) {
  const data = readData();
  const current = data.afks[guildId]?.[userId];
  if (!current) return null;

  delete data.afks[guildId][userId];
  if (Object.keys(data.afks[guildId] || {}).length === 0) {
    delete data.afks[guildId];
  }

  writeData(data);
  return current;
}

function addMention(guildId, userId, entry) {
  const data = readData();
  const target = data.afks[guildId]?.[userId];
  if (!target) return null;

  target.mentions.push(entry);
  writeData(data);
  return target;
}

module.exports = {
  setAfk,
  getAfk,
  removeAfk,
  getAfkUsers,
  addMention
};
