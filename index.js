require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { saveLog } = require("./logManager.js");

const { 
  Client, 
  Collection, 
  GatewayIntentBits, 
  Partials, 
  Events, 
  AuditLogEvent, 
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  AttachmentBuilder,
  MessageFlags 
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

const invitesCache = new Map();
const { ActivityType } = require("discord.js");

client.once(Events.ClientReady, async () => {
  console.log(`✅ GameBoy logged in as ${client.user.tag}`);
  require("./events/voiceStateUpdate.js")(client);
  client.user.setPresence({
    activities: [{ 
      name: '💢 Listening to your complaints..', 
      type: ActivityType.Streaming, 
      url: 'https://twitch.tv/discord'
    }],
    status: 'dnd',
  });

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const guildInvites = await guild.invites.fetch();
      invitesCache.set(guild.id, new Map(guildInvites.map(inv => [inv.code, inv.uses])));
    } catch (err) {
      console.log(`Couldn't pre-cache invites for guild: ${guild.id}`);
    }
  }
});

client.on(Events.InviteCreate, (invite) => {
  const guildMap = invitesCache.get(invite.guild.id) || new Map();
  guildMap.set(invite.code, invite.uses);
  invitesCache.set(invite.guild.id, guildMap);
});

client.on(Events.InviteDelete, (invite) => {
  const guildMap = invitesCache.get(invite.guild.id);
  if (guildMap) {
    guildMap.delete(invite.code);
  }
});

client.on(Events.MessageDelete, async (message) => {
  if (message.partial || message.author?.bot) return; 

  saveLog("deleted_messages", {
    action: `Message deleted in <#${message.channelId}>`,
    who: `${message.author.tag} (${message.author.id})`,
    reason: message.content ? `Content: "${message.content}"` : "No text content"
  });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (oldMessage.partial) await oldMessage.fetch().catch(() => {});
  if (newMessage.partial) await newMessage.fetch().catch(() => {});
  if (newMessage.author?.bot || oldMessage.content === newMessage.content) return;

  saveLog("message_edits", {
    action: `Message edited in <#${newMessage.channelId}>`,
    who: `${newMessage.author.tag}`,
    reason: `Before: "${oldMessage.content || ''}" \nAfter: "${newMessage.content || ''}"`
  });
});

client.on(Events.GuildMemberAdd, async (member) => {
  let inviteDetails = "Unknown Invite Method";

  try {
    const cachedGuildInvites = invitesCache.get(member.guild.id);
    const liveInvites = await member.guild.invites.fetch();

    if (cachedGuildInvites) {
      const usedInvite = liveInvites.find(inv => {
        const previousUses = cachedGuildInvites.get(inv.code) || 0;
        return inv.uses > previousUses;
      });

      if (usedInvite) {
        inviteDetails = `Invited by: **${usedInvite.inviter?.tag || "Unknown"}** (Using code: \`${usedInvite.code}\`)`;
      }
    }
    invitesCache.set(member.guild.id, new Map(liveInvites.map(inv => [inv.code, inv.uses])));
  } catch (err) {
    console.error("Failed to accurately cross-examine invite links:", err);
  }

  saveLog("joins_leaves", {
    action: `Member Joined: ${member.user.tag}`,
    who: `ID: ${member.id}`,
    reason: inviteDetails
  });

  const welcomeManager = require("./welcomeManager.js");
  const config = welcomeManager.getConfig("welcomes", member.guild.id);

  if (config) {
    const welcomeChannel = member.guild.channels.cache.get(config.channelId);
    if (welcomeChannel) {
      const embed = new EmbedBuilder()
        .setColor(config.color !== null && config.color !== undefined ? config.color : 0x8a5cff)
        .setTimestamp();

      if (config.title) embed.setTitle(welcomeManager.parsePlaceholders(config.title, member));
      if (config.description) embed.setDescription(welcomeManager.parsePlaceholders(config.description, member));

      const payload = { embeds: [embed] };

      if (config.image) {
        if (config.image.local) {
          const imgAttachment = new AttachmentBuilder(config.image.url, { name: config.image.name });
          embed.setImage(`attachment://${config.image.name}`);
          payload.files = [imgAttachment];
        } else {
          embed.setImage(config.image.url);
        }
      }

      if (config.title || config.description || config.image) {
        welcomeChannel.send(payload).catch(err => console.error("Error sending welcome embed:", err));
      }
    }
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  await new Promise(resolve => setTimeout(resolve, 800));
  let leaveType = "Left the server by choice.";

  try {
    const banCheck = await member.guild.bans.fetch(member.id).catch(() => null);
    if (banCheck) {
      leaveType = `Was banned from the server.`;
    } else {
      const auditLogs = await member.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick,
      }).catch(() => null);

      const kickLog = auditLogs?.entries.first();
      if (kickLog && kickLog.target.id === member.id && (Date.now() - kickLog.createdTimestamp < 5000)) {
        leaveType = `Removed: Kicked by **${kickLog.executor?.tag || "Staff"}**`;
      }
    }
  } catch (err) {
    console.error("Error analyzing audit logs for member leave context:", err);
  }

  saveLog("joins_leaves", {
    action: `Member Left: ${member.user.tag}`,
    who: `ID: ${member.id}`,
    reason: leaveType
  });

  const welcomeManager = require("./welcomeManager.js");
  const config = welcomeManager.getConfig("goodbyes", member.guild.id);

  if (config) {
    const goodbyeChannel = member.guild.channels.cache.get(config.channelId);
    if (goodbyeChannel) {
      const embed = new EmbedBuilder()
        .setColor(config.color !== null && config.color !== undefined ? config.color : 0xff4b4b)
        .setTimestamp();

      if (config.title) embed.setTitle(welcomeManager.parsePlaceholders(config.title, member));
      if (config.description) embed.setDescription(welcomeManager.parsePlaceholders(config.description, member));

      const payload = { embeds: [embed] };

      if (config.image) {
        if (config.image.local) {
          const imgAttachment = new AttachmentBuilder(config.image.url, { name: config.image.name });
          embed.setImage(`attachment://${config.image.name}`);
          payload.files = [imgAttachment];
        } else {
          embed.setImage(config.image.url);
        }
      }

      if (config.title || config.description || config.image) {
        goodbyeChannel.send(payload).catch(err => console.error("Error sending goodbye embed:", err));
      }
    }
  }
});

client.on(Events.GuildAuditLogEntryCreate, async (auditLogEntry, guild) => {
  const { action, executor, target, reason } = auditLogEntry;
  const modInfo = executor ? `${executor.tag} (${executor.id})` : "Unknown Mod";
  const targetInfo = target ? `${target.tag || target.id}` : "Unknown Target";
  const finalReason = reason ?? "No reason provided";

  if (action === AuditLogEvent.MemberBanAdd) {
    saveLog("ban", { action: `Banned ${targetInfo}`, who: modInfo, reason: finalReason });
  } else if (action === AuditLogEvent.MemberKick) {
    saveLog("kick", { action: `Kicked ${targetInfo}`, who: modInfo, reason: finalReason });
  } else if (action === AuditLogEvent.MemberUpdate) {
    const timeoutChange = auditLogEntry.changes?.find(c => c.key === 'communication_disabled_until');
    if (timeoutChange) {
      const mode = timeoutChange.new ? `Timed out ${targetInfo}` : `Removed timeout from ${targetInfo}`;
      saveLog("timeout", { action: mode, who: modInfo, reason: finalReason });
    }
  }

  if (action === AuditLogEvent.ChannelCreate || action === AuditLogEvent.ChannelUpdate || action === AuditLogEvent.ChannelDelete) {
    let actionName = "Channel updated";
    if (action === AuditLogEvent.ChannelCreate) actionName = "Channel created";
    if (action === AuditLogEvent.ChannelDelete) actionName = "Channel deleted";

    let details = `Channel ID: ${auditLogEntry.targetId}`;
    const nameChange = auditLogEntry.changes?.find(c => c.key === 'name');
    if (nameChange) {
      details = `Renamed: "${nameChange.old}" ➡️ "${nameChange.new}"`;
    }

    saveLog("channel_changes", {
      action: actionName,
      who: modInfo,
      reason: `${details} | ${finalReason}`
    });
  }

  if (action === AuditLogEvent.RoleCreate || action === AuditLogEvent.RoleUpdate || action === AuditLogEvent.RoleDelete) {
    let actionName = "Role settings updated";
    if (action === AuditLogEvent.RoleCreate) actionName = "New role created";
    if (action === AuditLogEvent.RoleDelete) actionName = "Role deleted";

    let details = `Role ID: ${auditLogEntry.targetId}`;
    const nameChange = auditLogEntry.changes?.find(c => c.key === 'name');
    if (nameChange) {
      details = `Role Name: "${nameChange.new || nameChange.old}"`;
    }

    saveLog("role_logs", {
      action: actionName,
      who: modInfo,
      reason: `${details} | ${finalReason}`
    });
  }

  if (action === AuditLogEvent.MemberRoleUpdate) {
    const targetUser = target ? `${target.tag}` : "Target User";
    let roleChanges = [];

    const addedRoles = auditLogEntry.changes?.find(c => c.key === '$add');
    const removedRoles = auditLogEntry.changes?.find(c => c.key === '$remove');

    if (addedRoles) {
      addedRoles.new.forEach(r => roleChanges.push(`Added role: <@&${r.id}>`));
    }
    if (removedRoles) {
      removedRoles.new.forEach(r => roleChanges.push(`Removed role: <@&${r.id}>`));
    }

    if (roleChanges.length > 0) {
      saveLog("role_logs", {
        action: `Role adjustments for ${targetUser}`,
        who: modInfo,
        reason: `${roleChanges.join(", ")} | ${finalReason}`
      });
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.author.bot && message.guild) {
    const levelManager = require("./levelManager.js");
    
    if (!client.cooldowns) client.cooldowns = new Map();
    const userCooldownKey = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    
    const { user, leveledUp } = levelManager.addMessage(message.guild.id, message.author.id);

    if (leveledUp) {
      const settings = levelManager.getSettings(message.guild.id);
      if (settings?.channelId) {
        const channel = message.guild.channels.cache.get(settings.channelId);
        if (channel) {
          const levelEmbed = new EmbedBuilder()
            .setColor(0x8a5cff)
            .setTitle("Level Up!")
            .setDescription(`Congratulations **${message.author}**, you have reached **Level ${user.level}**!`)
            .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
            .setTimestamp();

          channel.send({ embeds: [levelEmbed] }).catch(err => console.error("Error sending level up embed:", err));
        }

        if (user.level > 0 && user.level % 5 === 0) {
          const expectedRoleName = `Level ${user.level}`;
          let milestoneRole = message.guild.roles.cache.find(r => r.name === expectedRoleName);
          
          try {
            if (!milestoneRole) {
              milestoneRole = await message.guild.roles.create({
                name: expectedRoleName,
                color: 0,
                reason: "Automated Leveling Milestone Generation"
              });
            }
            
            if (message.member && !message.member.roles.cache.has(milestoneRole.id)) {
              await message.member.roles.add(milestoneRole);
            }
          } catch (err) {
            console.error(`Failed handling automatic role operations for Level ${user.level}:`, err);
          }
        }
      }
    }
  }

  if (message.content.trim() === "!done!") {
    const ticketManager = require("./ticketManager.js");
    const activeTicket = ticketManager.getActiveTicket(message.channelId);

    if (activeTicket) {
      const guild = message.guild;
      const config = ticketManager.getConfig(guild.id);

      if (config) {
        const centralChannel = guild.channels.cache.get(config.centralChannelId);
        if (centralChannel) {
          await centralChannel.send(`🔒 **Ticket [${activeTicket.ticketNumber}] closed.** Channel purged successfully.`);
        }
      }

      const member = await guild.members.fetch(activeTicket.userId).catch(() => null);
      const targetRole = guild.roles.cache.get(activeTicket.roleId);
      
      if (member && targetRole) {
        await member.roles.remove(targetRole).catch(err => console.error("Failed handling automatic role deleting operations:", err));
      }

      ticketManager.removeActiveTicket(message.channelId);
      
      setTimeout(async () => {
        await message.channel.delete("Ticket target closed explicitly by worker request.").catch(() => {});
        if (targetRole) await targetRole.delete("Profile closure.").catch(() => {});
      }, 2000);

      return;
    }
  }

  const prefix = "!talk";
  if (!message.content.startsWith(prefix)) return;

  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return; 
  }

  const sayMessage = message.content.slice(prefix.length).trim();
  
  if (!sayMessage && message.attachments.size === 0) return;

  try {
    const replyMessageId = message.reference?.messageId;
    
    const payload = {};
    if (sayMessage) payload.content = sayMessage;

    if (message.attachments.size > 0) {
      payload.files = message.attachments.map(att => new AttachmentBuilder(att.url, { name: att.name }));
    }

    if (replyMessageId) {
      payload.reply = {
        messageReference: replyMessageId,
        failIfNotExists: false
      };
    }

    await message.channel.send(payload);
    await message.delete().catch(() => {});
    
  } catch (err) {
    console.error("Error running !talk command:", err);
  }
});

function getRoleFromEmbed(embed, reaction) {
  if (!embed || embed.footer?.text !== "GameBoy Autoroles" || !embed.description) return null;

  const lines = embed.description.split("\n");
  for (const line of lines) {
    const parts = line.split(" — ");
    if (parts.length < 2) continue;

    const emojiPart = parts[0].trim();
    const roleNamePart = parts.slice(1).join(" — ").trim();

    if (reaction.emoji.id) {
      if (emojiPart.includes(reaction.emoji.id)) return roleNamePart;
    } else {
      if (emojiPart === reaction.emoji.name) return roleNamePart;
    }
  }
  return null;
}

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try { await reaction.fetch(); } catch (err) { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch (err) { return; }
  }

  const targetRoleName = getRoleFromEmbed(reaction.message.embeds[0], reaction);
  if (!targetRoleName) return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === targetRoleName.toLowerCase());
  if (!targetRole) return;

  try {
    if (!member.roles.cache.has(targetRole.id)) {
      await member.roles.add(targetRole);
    }
  } catch (err) {
    console.error("Hierarchy permission error inside ReactionAdd handler:", err);
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try { await reaction.fetch(); } catch (err) { return; }
  }
  if (reaction.message.partial) {
    try { await reaction.message.fetch(); } catch (err) { return; }
  }

  const targetRoleName = getRoleFromEmbed(reaction.message.embeds[0], reaction);
  if (!targetRoleName) return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  const targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === targetRoleName.toLowerCase());
  if (!targetRole) return;

  try {
    if (member.roles.cache.has(targetRole.id)) {
      await member.roles.remove(targetRole);
    }
  } catch (err) {
    console.error("Hierarchy permission error inside ReactionRemove handler:", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === "verify_rules_button") {
    const verifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === "verified");
    
    if (!verifiedRole) {
      return interaction.reply({ content: "❌ The 'Verified' role could not be found on this server.", flags: [MessageFlags.Ephemeral] });
    }

    try {
      if (interaction.member.roles.cache.has(verifiedRole.id)) {
        return interaction.reply({ content: "ℹ️ You are already verified!", flags: [MessageFlags.Ephemeral] });
      }

      await interaction.member.roles.add(verifiedRole);
      return interaction.reply({ content: "✅ Success! You have been granted the **Verified** role and now have full access to the server.", flags: [MessageFlags.Ephemeral] });
    } catch (err) {
      console.error("Verification error:", err);
      return interaction.reply({ content: "❌ I couldn't assign the role. Please check my role hierarchy permissions!", flags: [MessageFlags.Ephemeral] });
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith("accept_ticket_")) {
    const targetChannelId = interaction.customId.split("accept_ticket_")[1];
    const ticketChannel = interaction.guild.channels.cache.get(targetChannelId);

    if (!ticketChannel) {
      return interaction.reply({ content: "❌ Target runtime tracking channel is missing from system logs.", flags: [MessageFlags.Ephemeral] });
    }

    const currentEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(currentEmbed);

    const assignedField = currentEmbed.fields.find(f => f.name === "Assigned Moderator");
    if (assignedField) {
      return interaction.reply({ content: "⚠️ A moderator is already assigned to this case layout.", flags: [MessageFlags.Ephemeral] });
    }

    await interaction.deferUpdate();

    updatedEmbed.addFields({ name: "Assigned Moderator", value: `${interaction.user.tag} (${interaction.user.id})`, inline: false });
    
    const disabledRow = new ActionRowBuilder().addComponents(
      ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true).setLabel("Assigned Case Profile")
    );

    await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });
    await ticketChannel.send(`⚡ **A moderator (${interaction.user}) took your case.** After the case is solved, please type \`!done!\``);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing slash command ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
    } else {
      await interaction.reply({ content: '❌ There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);