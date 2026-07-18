const { SlashCommandBuilder, AttachmentBuilder, PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");
const levelManager = require("../levelManager.js");

module.exports = {
  category: "Utilities",
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Check user profile modules.")
    
    .addSubcommand(sub => 
      sub.setName("level")
         .setDescription("View your level.")
         .addUserOption(o => o.setName("target").setDescription("Select a target user to show their level."))
    )
    
    .addSubcommand(sub => sub.setName("nick")
     .setDescription("(Admin) Change or reset a user's nickname.")
     .addUserOption(o => o.setName("user").setDescription("The user to rename.").setRequired(true))
     .addStringOption(o => o.setName("nickname").setDescription("The new nickname."))
     .addBooleanOption(o => o.setName("reset").setDescription("Reset to display name?"))
)
    
    .addSubcommand(sub =>
      sub.setName("info")
         .setDescription("(Admin) Secretly view detailed information about a user.")
         .addUserOption(o => o.setName("user").setDescription("The user to inspect.").setRequired(true))
    )
    
    .addSubcommand(sub =>
      sub.setName("stats")
         .setDescription("View fun server stats for yourself or another user!")
         .addUserOption(o => o.setName("user").setDescription("The user to view stats for (optional)."))
    )
    .addSubcommand(sub => sub.setName("warns").setDescription("(Admin) View a user's warning history.").addUserOption(o => o.setName("user").setDescription("User to inspect").setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "level") {
      const target = interaction.options.getUser("target") || interaction.user;
      
      if (target.id !== interaction.user.id && !interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "❌ Administrator permissions required to look up other members.", flags: [MessageFlags.Ephemeral] });
      }

      await interaction.deferReply();

      const users = levelManager.getGuildUsers(interaction.guild.id);
      const stats = users[target.id] || { level: 0, messages: 0 };
      const reqMessages = levelManager.getRequiredForLevel(stats.level);

      try {
        const profileImage = require("../profileImage.js");
        const imageBuffer = await profileImage.generateCard(target, stats, reqMessages);
        const fileAttachment = new AttachmentBuilder(imageBuffer, { name: `profile_${target.id}.png` });

        return interaction.editReply({ files: [fileAttachment] });
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: "❌ Something went wrong building your profile rank card." });
      }
    }

    if (subcommand === "nick") {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
       return interaction.reply({ content: "❌ Administrator permissions required.", flags: [MessageFlags.Ephemeral] });
     }

     const targetUser = interaction.options.getUser("user");
      const newNickname = interaction.options.getString("nickname");
     const shouldReset = interaction.options.getBoolean("reset");
     const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

     if (!targetMember) return interaction.reply({ content: "❌ User not found.", flags: [MessageFlags.Ephemeral] });

      try {
       if (shouldReset) {
         await targetMember.setNickname(null);
         return interaction.reply({ content: `✅ Nickname reset for **${targetUser.tag}**.`, flags: [MessageFlags.Ephemeral] });
        } else if (newNickname) {
         await targetMember.setNickname(newNickname);
         return interaction.reply({ content: `✅ Set **${targetUser.tag}**'s nickname to **${newNickname}**.`, flags: [MessageFlags.Ephemeral] });
        }
      } catch (err) {
        return interaction.reply({ content: "❌ I don't have permission to change that user's nickname.", flags: [MessageFlags.Ephemeral] });
      }
    }

    if (subcommand === "info") {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "❌ You need Administrator permissions to use this command.", flags: [MessageFlags.Ephemeral] });
      }

      const targetUser = interaction.options.getUser("user");
      const targetMember = await interaction.guild.members.fetch({ user: targetUser.id, force: true }).catch(() => null);
      const fullTargetUser = await interaction.client.users.fetch(targetUser.id, { force: true }).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: "❌ I couldn't find that user on the server.", flags: [MessageFlags.Ephemeral] });
      }

      const createdAtDate = targetUser.createdAt.toLocaleString('en-US', { 
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
      }).replace(',', ' at');
      const joinedAtDate = targetMember.joinedAt.toLocaleString('en-US', { 
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
      }).replace(',', ' at');

      const roles = targetMember.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r.toString()).join(", ") || "None";
      const nitroType = Number.isInteger(fullTargetUser?.premiumType) ? fullTargetUser.premiumType : null;
      const nitroText = nitroType === 1 ? "Nitro Classic" : nitroType === 2 ? "Nitro" : null;
      const boostTimestamp = targetMember.premiumSinceTimestamp ?? null;
      const boostText = boostTimestamp
        ? `Boosting since <t:${Math.floor(boostTimestamp / 1000)}:d>`
        : "Not currently boosting";
      const isMod = targetMember.permissions.has(PermissionsBitField.Flags.ModerateMembers) || targetMember.permissions.has(PermissionsBitField.Flags.Administrator);
      const infoFields = [
        { name: "User Details", value: `**Display:** ${targetMember.displayName}\n**Username:** ${targetUser.username}\n**ID:** ${targetUser.id}`, inline: false },
        { name: "Account Created", value: `(${createdAtDate}) (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`, inline: false },
        { name: "Joined Server", value: `(${joinedAtDate}) (<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>)`, inline: false },
        { name: "Mod Permissions |", value: isMod ? "Yes" : "No", inline: true },
        { name: "Is Bot? |", value: targetUser.bot ? "Yes" : "No", inline: true },
        ...(nitroText ? [{ name: "Nitro Subscription", value: nitroText, inline: true }] : []),
        { name: "Server Boosting", value: boostText, inline: true },
        { name: `Roles [${targetMember.roles.cache.size - 1}]`, value: roles.length > 1024 ? "Too many roles." : roles, inline: false }
      ];
      
      const infoEmbed = new EmbedBuilder()
        .setColor(0xd6aded)
        .setTitle(`🕵️ User Inspect: ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(infoFields)
        .setFooter({ text: "GameBoy Admin Data" })
        .setTimestamp();

      return interaction.reply({ embeds: [infoEmbed], flags: [MessageFlags.Ephemeral] });
    }

    if (subcommand === "stats") {
      const targetUser = interaction.options.getUser("user") || interaction.user;
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      const users = levelManager.getGuildUsers(interaction.guild.id);
      const stats = users[targetUser.id] || { level: 0, messages: 0 };
      
      const voiceTime = levelManager.getVoiceTime(interaction.guild.id, targetUser.id);
      
      const isBoosting = Boolean(targetMember?.premiumSinceTimestamp || targetMember?.premiumSince);
      const statsEmbed = new EmbedBuilder()
        .setColor(0x6320ee)
        .setAuthor({ name: `${targetMember ? targetMember.displayName : targetUser.username}'s Stats`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
        .addFields(
          { name: "💬 All-time Messages", value: `**${stats.messages}** messages sent`, inline: true },
          { name: "🏆 Current Level", value: `**Level ${stats.level}**`, inline: false },
          { name: "🎙️ Voice Chat Time", value: `**${voiceTime}** spent in voice`, inline: false },
          { name: "💖 Boosting Support", value: isBoosting ? "Active Server Booster! 🚀" : "Not currently boosting.", inline: false }
        )
        .setFooter({ text: "GameBoy Stats" })
        .setTimestamp();

      return interaction.reply({ embeds: [statsEmbed] });
    }

    if (subcommand === "warns") {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: "Administrator permissions required.", flags: [MessageFlags.Ephemeral] });
      const target = interaction.options.getUser("user", true);
      const { getWarnings } = require("../warningManager.js");
      const warnings = getWarnings(interaction.guildId, target.id);
      const lines = warnings.length ? warnings.slice(-20).reverse().map((w, index) => `**#${warnings.length - index}** · ${w.source} · <t:${Math.floor(w.timestamp / 1000)}:R>\n${w.reason}`).join("\n\n") : "No warnings recorded.";
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle(`Warnings: ${target.tag}`).setDescription(lines.slice(0, 4000)).setFooter({ text: `${warnings.length} total warning(s); newest 20 shown` }).setTimestamp()], flags: [MessageFlags.Ephemeral] });
    }
  }
};
