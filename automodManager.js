const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { getAutomodConfig, addWarning, saveCase, getCase, closeCase } = require("./warningManager.js");
const { redact, notifyAdmin, audit } = require("./moderationUtils.js");

const recentMessages = new Map();
const joinWindows = new Map();
const raidSpamWindows = new Map();
const automodDeletedMessageIds = new Set();
const severeTerms = /\b(?:n[i1]gg(?:a|er)?|f[a@]gg?[o0]t|k[i1]ke|ch[i1]nk|sp[i1]c)\b/i;
const strictTerms = /\b(?:fuck(?:ing)?|shit(?:ty)?|bitch(?:es)?|asshole|dumbass|idiot|moron|stupid|loser|bastard|damn|crap)\b/i;

const inviteLinkPattern = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|com)\/invite|discordapp\.com\/invite|discord\.gg)\//i;
const mentionPattern = /<@!?\d+>|<@&\d+>/g;

function normalize(text) { return String(text || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/(.)\1{3,}/g, "$1$1").toLowerCase(); }

function getPresetSettings(config) {
  const preset = config?.preset || "light";
  if (preset === "strict") return { repeatThreshold: 5, mentionThreshold: 4, strictMode: true, severeOnly: false };
  return { repeatThreshold: 8, mentionThreshold: 5, strictMode: false, severeOnly: true };
}

function shouldSkipChannel(config, message) {
  const ignored = config?.ignoredChannels || [];
  return ignored.includes(message.channel.id);
}

function messageViolation(message, config) {
  const content = normalize(message.content);
  const policy = getPresetSettings(config);
  const messageText = message.content || "";

  if (config?.policies?.inviteLinks === true && inviteLinkPattern.test(messageText)) {
    return "invite links";
  }

  const mentionCount = (messageText.match(mentionPattern) || []).length;
  if (config?.policies?.mentionSpam && mentionCount >= policy.mentionThreshold) {
    return "mention spam";
  }

  if (config?.policies?.spamRepeat) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const messages = (recentMessages.get(key) || []).filter(x => now - x.at < 10_000);
    messages.push({ at: now, text: content });
    recentMessages.set(key, messages);

    const repeated = messages.filter(x => x.text === content).length;
    if (messages.length >= policy.repeatThreshold || (content.length > 12 && repeated >= 3)) {
      return "message spam";
    }
  }

  if (severeTerms.test(content)) return "severe abusive language";
  if (policy.strictMode && strictTerms.test(content)) return "prohibited insulting or profane language";

  return null;
}
async function inspectRaidSpam(message) {
  const now = Date.now();
  const entries = (raidSpamWindows.get(message.guild.id) || []).filter(x => now - x.at < 10_000);
  entries.push({ at: now, authorId: message.author.id }); raidSpamWindows.set(message.guild.id, entries);
  const authors = new Set(entries.map(x => x.authorId));
  if (entries.length === 25 && authors.size >= 5) await openCase(message.guild, null, "Possible spam raid detected", `**${entries.length}** messages from **${authors.size}** accounts were observed in ten seconds. Review the activity before acting.`);
}
function buttons(caseId) { return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`modcase:act:${caseId}`).setLabel("Take action").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`modcase:ignore:${caseId}`).setLabel("Ignore").setStyle(ButtonStyle.Secondary)); }
async function openCase(guild, subject, title, details, reason = "No reason provided", type = "automod") {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  saveCase(guild.id, {
    id,
    guildId: guild.id,
    subjectId: subject?.id || null,
    createdAt: Date.now(),
    status: "open",
    type,
    reason: reason || "No reason provided",
    title,
    details,
  });
  await notifyAdmin(guild, { embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle(title).setDescription(details).setFooter({ text: `Case ${id}` }).setTimestamp()], components: [buttons(id)] });
}
async function handleMessage(message) {
  const config = getAutomodConfig(message.guild.id);
  if (!config.enabled || message.author.bot) return false;
  if (shouldSkipChannel(config, message)) return false;

  await inspectRaidSpam(message);
  const reason = messageViolation(message, config);
  if (!reason) return false;

  automodDeletedMessageIds.add(message.id);
  setTimeout(() => automodDeletedMessageIds.delete(message.id), 60_000).unref();
  await message.delete().catch(() => automodDeletedMessageIds.delete(message.id));

  const result = await addWarning(message.guild.id, message.author.id, {
    guild: message.guild,
    source: "automod",
    reason,
    actorTag: "Automod",
  });

 audit("automod", { action: "Automod violation", actor: { tag: "Automod", id: "automod" }, target: message.author, reason, context: `warning=${result.totalWarnings}; preset=${config.preset || "balanced"}` });

  if (["message spam", "mention spam", "invite links"].includes(reason)) {
    await openCase(
      message.guild,
      message.author,
      "Automod review case",
      `A message from <@${message.author.id}> was removed.\nReason: **${reason}**\nWarning total: **${result.totalWarnings}**\nPreset: **${config.preset || "light"}**`,
      reason,
      "automod"
    ).catch(() => null);
  } else {
    
    await notifyAdmin(message.guild, { embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle("Automod action").setDescription(`A message from <@${message.author.id}> was removed.\nReason: **${reason}**\nWarning total: **${result.totalWarnings}**`).setFooter({ text: "Message content intentionally redacted" }).setTimestamp()] });
  }
  if (["kick", "ban"].includes(result.penalty.type)) {
    await notifyAdmin(message.guild, { embeds: [new EmbedBuilder().setColor(result.penalty.type === "ban" ? 0x992d22 : 0xe67e22).setTitle(result.penalty.type === "ban" ? "Permanent ban issued" : "Warning-limit kick issued").setDescription(`User: <@${message.author.id}>\nTotal warnings: **${result.totalWarnings}**\nReason: **${reason}**`).setTimestamp()] });
  }
  return true;
}
async function handleMemberAdd(member) {
  const now = Date.now();
  const list = (joinWindows.get(member.guild.id) || []).filter(t => now - t < 60_000);
  list.push(now);
  joinWindows.set(member.guild.id, list);

  const ageHours = (now - member.user.createdTimestamp) / 3_600_000;
  const isVerifiedBot = member.user.bot && member.user.flags?.has?.("VerifiedBot");
  const likelyFakeBot = !!member.user.bot && !isVerifiedBot && ageHours < 12;
  const suspicious = ageHours < 24 && (!member.user.bot || likelyFakeBot);
  const raiding = list.length >= 6;

  if (likelyFakeBot) {
    await openCase(member.guild, member.user, "Suspicious bot account", `Member: <@${member.id}>\nAccount age: **${Math.max(0, Math.floor(ageHours))} hours**\nReason: unverified bot account joined recently.`);
  }

  if (suspicious) {
    await openCase(member.guild, member.user, "Suspicious new account", `Member: <@${member.id}>\nAccount age: **${Math.max(0, Math.floor(ageHours))} hours**\nReason: newly-created account.`);
  }

  if (raiding && list.length === 6) {
    await openCase(member.guild, null, "Possible raid detected", `**${list.length}** joins were observed in one minute. Review recent joins before acting.`);
  }
}
async function handleCaseButton(interaction) {
  const [, action, id] = interaction.customId.split(":"); const item = getCase(interaction.guildId, id);
  if (!item || item.guildId !== interaction.guildId || Date.now() - item.createdAt > 86_400_000) return interaction.reply({ content: "This case has expired. Create a new case if action is still needed.", flags: [MessageFlags.Ephemeral] });
  if (!interaction.memberPermissions?.has("Administrator")) return interaction.reply({ content: "Administrator permission is required.", flags: [MessageFlags.Ephemeral] });
  if (action === "ignore") { closeCase(interaction.guildId, id); return interaction.update({ content: `Case ignored by ${interaction.user.tag}.`, components: [] }); }
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`modcase:act:${id}`).setLabel("Take action").setStyle(ButtonStyle.Danger).setDisabled(!item.subjectId), new ButtonBuilder().setCustomId(`modcase:ignore:${id}`).setLabel("Ignore").setStyle(ButtonStyle.Secondary).setDisabled(!item.subjectId), new ButtonBuilder().setCustomId(`modcase:delete:${id}`).setLabel("Delete user's messages").setStyle(ButtonStyle.Primary).setDisabled(!item.subjectId));
  return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle("What action should I take?").setDescription(item.subjectId ? `Case target: <@${item.subjectId}>` : "This raid case has no single account target.").setTimestamp()], components: [row] });
}
async function executeCaseAction(interaction) {
  const [, action, id] = interaction.customId.split(":"); const item = getCase(interaction.guildId, id);
  if (!item?.subjectId || item.guildId !== interaction.guildId) return interaction.reply({ content: "This case no longer has an actionable target.", flags: [MessageFlags.Ephemeral] });
  if (!interaction.memberPermissions?.has("Administrator")) return interaction.reply({ content: "Administrator permission is required.", flags: [MessageFlags.Ephemeral] });
  const member = await interaction.guild.members.fetch(item.subjectId).catch(() => null);
  try {
    if (action === "ban") await interaction.guild.members.ban(item.subjectId, { reason: `Admin action from case ${id}` });
    if (action === "kick") { if (!member?.kickable) throw new Error("Member cannot be kicked due to bot permissions or role hierarchy."); await member.kick(`Admin action from case ${id}`); }
    if (action === "delete") {
      let remaining = 100;
      for (const channel of interaction.guild.channels.cache.values()) {
        if (remaining <= 0 || !channel.isTextBased() || !channel.messages?.fetch) continue;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        const eligible = messages ? [...messages.values()].filter(m => m.author.id === item.subjectId && Date.now() - m.createdTimestamp < 1_209_600_000).slice(0, remaining) : [];
        if (eligible.length) { await channel.bulkDelete(eligible, true).catch(() => null); remaining -= eligible.length; }
      }
    }
    audit("moderation_actions", { action: `Case action: ${action}`, actor: interaction.user, target: { id: item.subjectId }, reason: `case=${id}` }); closeCase(interaction.guildId, id);
    return interaction.update({ content: `Case action completed: **${action}** by ${interaction.user.tag}.`, embeds: [], components: [] });
  } catch (error) { return interaction.reply({ content: `Action failed safely: ${redact(error.message, 160)}`, flags: [MessageFlags.Ephemeral] }); }
}
module.exports = { handleMessage, handleMemberAdd, handleCaseButton, executeCaseAction, wasAutomodDeleted: id => automodDeletedMessageIds.has(id) };
