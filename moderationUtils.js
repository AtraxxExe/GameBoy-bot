const { PermissionsBitField } = require("discord.js");
const { saveLog } = require("./logManager.js");

const isAdmin = interaction => Boolean(interaction.inGuild() && interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator));
const redact = (text, max = 90) => { const value = String(text || "").replace(/\s+/g, " ").trim(); return value.length > max ? `${value.slice(0, max - 3)}...` : value; };
function audit(category, { action, actor, target, reason, context = "" }) {
  saveLog(category, { action: redact(action, 180), who: `${redact(actor?.tag || "System", 80)} (${actor?.id || "system"})`, reason: `target=${target?.id || "n/a"}; reason=${redact(reason)}${context ? `; ${redact(context)}` : ""}` });
}
async function notifyAdmin(guild, payload) {
  const { getAutomodConfig } = require("./warningManager.js");
  const channelId = getAutomodConfig(guild.id).adminChannelId;
  if (!channelId) return false;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return false;
  await channel.send({ ...payload, allowedMentions: { parse: [] } }).catch(() => null);
  return true;
}
module.exports = { isAdmin, redact, audit, notifyAdmin };
