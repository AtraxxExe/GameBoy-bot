const fs = require("node:fs");
const path = require("node:path");
const { saveLog } = require("./logManager.js");

const STORAGE_PATH = path.join(__dirname, "warningData.json");
const PENALTIES = [null, null, 10, null, null, 20, 30, 60, 120, 180, 240, 360, 720, 1440, "kick"];

function readAll() {
  try { return JSON.parse(fs.readFileSync(STORAGE_PATH, "utf8")); } catch { return {}; }
}
function writeAll(data) {
  const temporary = `${STORAGE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, STORAGE_PATH);
}
function state(guildId) {
  const data = readAll();
  data[guildId] ??= {
    automod: {
      enabled: false,
      preset: "light",
      adminChannelId: null,
      ignoredChannels: [],
      allowedChannels: [],
      policies: {
        inviteLinks: true,
        mentionSpam: true,
        spamRepeat: true,
      },
    },
    warnings: {},
    cases: {},
  };
  data[guildId].automod ??= {
    enabled: false,
    preset: "light",
    adminChannelId: null,
    ignoredChannels: [],
    allowedChannels: [],
    policies: {
      inviteLinks: true,
      mentionSpam: true,
      spamRepeat: true,
    },
  };
  data[guildId].warnings ??= {};
  data[guildId].cases ??= {};
  return { data, guild: data[guildId] };
}
function clean(value, limit = 240) {
  const text = String(value || "No reason provided").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, limit) || "No reason provided";
}
function getPenaltyForWarningCount(total) {
  if (total >= 30) return { type: "ban" };
  const entry = PENALTIES[(total - 1) % 15];
  return entry === "kick" ? { type: "kick" } : entry ? { type: "timeout", durationMs: entry * 60_000 } : { type: "warning" };
}
async function applyPenalty(guild, userId, penalty, reason) {
  if (!guild || penalty.type === "warning") return { applied: true };
  const member = await guild.members.fetch(userId).catch(() => null);
  try {
    if (penalty.type === "timeout") {
      if (!member?.moderatable) return { applied: false, error: "Member is not timeoutable" };
      await member.timeout(penalty.durationMs, reason);
    } else if (penalty.type === "kick") {
      if (!member?.kickable) return { applied: false, error: "Member is not kickable" };
      await member.kick(reason);
    } else if (penalty.type === "ban") {
      await guild.members.ban(userId, { reason });
    }
    return { applied: true };
  } catch (error) { return { applied: false, error: error.code || error.message || "Discord API error" }; }
}
async function addWarning(guildId, userId, options = {}) {
  const { data, guild } = state(guildId);
  const records = guild.warnings[userId] ??= [];
  const record = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, source: clean(options.source || "automod", 40), reason: clean(options.reason), actorId: options.actorId || null, actorTag: clean(options.actorTag || "System", 80), timestamp: Date.now() };
  records.push(record);
  writeAll(data); 
  const totalWarnings = records.length;
  const penalty = getPenaltyForWarningCount(totalWarnings);
  const outcome = await applyPenalty(options.guild, userId, penalty, `Warning #${totalWarnings}: ${record.reason}`);

  if (options.guild && userId) {
    const member = await options.guild.members.fetch(userId).catch(() => null);
    if (member) {
      await member.send({
        content: `You were warned in **${options.guild.name}** for: **${record.reason}**. Your total warning count is now **${totalWarnings}**.`,
      }).catch(() => {});
    }
  }

  saveLog("warnings", { action: `Warning #${totalWarnings} for user ${userId}`, who: record.actorTag, reason: `${record.source}; ${record.reason}; applied=${outcome.applied}` });
  return { totalWarnings, penalty, record, outcome };
}
function getWarnings(guildId, userId) { const { guild } = state(guildId); return [...(guild.warnings[userId] || [])]; }
function removeWarnings(guildId, userId, count = 1, options = {}) {
  const { data, guild } = state(guildId); const records = guild.warnings[userId] ??= [];
  const number = Math.min(records.length, Math.max(1, Math.floor(Number(count) || 1)));
  const removed = records.splice(Math.max(0, records.length - number), number);
  writeAll(data);
  saveLog("warnings", { action: `Removed ${removed.length} warning(s) for user ${userId}`, who: clean(options.actorTag || "System", 80), reason: removed.map(x => `${x.id}:${x.reason}`).join(" | ") || "No warning records" });
  return removed;
}
function getAutomodConfig(guildId) {
  const config = state(guildId).guild.automod;
  const { strict: _strictIgnored, ...rest } = config;
  return {
    ...rest,
    ignoredChannels: Array.isArray(config.ignoredChannels) ? [...config.ignoredChannels] : [],
    allowedChannels: Array.isArray(config.allowedChannels) ? [...config.allowedChannels] : [],
    policies: {
      inviteLinks: config.policies?.inviteLinks ?? true,
      mentionSpam: config.policies?.mentionSpam ?? true,
      spamRepeat: config.policies?.spamRepeat ?? true,
    },
  };
}
function setAutomodConfig(guildId, updates = {}) {
  const { data, guild } = state(guildId);
  if (typeof updates.enabled === "boolean") guild.automod.enabled = updates.enabled;
  if (typeof updates.preset === "string") guild.automod.preset = updates.preset;
  if (typeof updates.adminChannelId === "string" || updates.adminChannelId === null) guild.automod.adminChannelId = updates.adminChannelId;
  if (Array.isArray(updates.ignoredChannels)) guild.automod.ignoredChannels = updates.ignoredChannels;
  if (Array.isArray(updates.allowedChannels)) guild.automod.allowedChannels = updates.allowedChannels;
  if (updates.policies && typeof updates.policies === "object") {
    guild.automod.policies = {
      ...guild.automod.policies,
      ...updates.policies,
    };
  }
  writeAll(data);
  return getAutomodConfig(guildId);
}
function saveCase(guildId, caseData) { const { data, guild } = state(guildId); guild.cases[caseData.id] = caseData; writeAll(data); return caseData; }
function getCase(guildId, id) { const { guild } = state(guildId); return guild.cases[id] || null; }
function listCases(guildId) {
  const { guild } = state(guildId);
  return Object.values(guild.cases || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
function reviewQueue(guildId) {
  const { guild } = state(guildId);
  return listCases(guildId).filter(item => item.guildId === guildId);
}
function closeCase(guildId, id) { const { data, guild } = state(guildId); delete guild.cases[id]; writeAll(data); }
module.exports = { addWarning, getWarnings, removeWarnings, getAutomodConfig, setAutomodConfig, getPenaltyForWarningCount, sanitizeReason: clean, saveCase, getCase, listCases, reviewQueue, closeCase };
