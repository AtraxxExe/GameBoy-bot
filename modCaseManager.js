const fs = require("node:fs");
const path = require("node:path");
const { saveLog } = require("./logManager.js");

const STORAGE_PATH = path.join(__dirname, "modCases.json");

function readAll() {
  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.writeFileSync(STORAGE_PATH, JSON.stringify({ cases: {}, reviewQueue: [] }, null, 2), "utf8");
      return { cases: {}, reviewQueue: [] };
    }
    return JSON.parse(fs.readFileSync(STORAGE_PATH, "utf8"));
  } catch {
    return { cases: {}, reviewQueue: [] };
  }
}

function writeAll(data) {
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function normalizeCase(caseData) {
  return {
    id: caseData.id,
    guildId: caseData.guildId,
    targetId: caseData.targetId || null,
    actorId: caseData.actorId || null,
    type: caseData.type || "manual",
    reason: caseData.reason || "No reason provided",
    status: caseData.status || "open",
    createdAt: caseData.createdAt || Date.now(),
    reviewPriority: caseData.reviewPriority || "normal",
  };
}

function createCase(guildId, details = {}) {
  const data = readAll();
  const id = details.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const caseEntry = normalizeCase({ id, guildId, ...details });
  data.cases[id] = caseEntry;
  data.reviewQueue.push(id);
  writeAll(data);
  return caseEntry;
}

function getCase(guildId, caseId) {
  const data = readAll();
  return data.cases[caseId] && data.cases[caseId].guildId === guildId ? data.cases[caseId] : null;
}

function updateCase(guildId, caseId, updates = {}) {
  const data = readAll();
  const item = data.cases[caseId];
  if (!item || item.guildId !== guildId) return null;

  Object.assign(item, normalizeCase({ ...item, ...updates }));
  writeAll(data);
  return item;
}

function listCases(guildId) {
  const data = readAll();
  return Object.values(data.cases).filter(item => item.guildId === guildId).sort((a, b) => b.createdAt - a.createdAt);
}

function reviewQueue(guildId) {
  const data = readAll();
  return data.reviewQueue
    .map(id => data.cases[id])
    .filter(Boolean)
    .filter(item => item.guildId === guildId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function closeCase(guildId, caseId) {
  const data = readAll();
  const item = data.cases[caseId];
  if (!item || item.guildId !== guildId) return null;
  item.status = "closed";
  data.reviewQueue = data.reviewQueue.filter(id => id !== caseId);
  writeAll(data);
  saveLog("case_review", { action: `Case ${caseId} closed`, who: "System", reason: `target=${item.targetId || "n/a"}; reason=${item.reason}` });
  return item;
}

module.exports = {
  createCase,
  getCase,
  updateCase,
  listCases,
  reviewQueue,
  closeCase,
};
