const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
  category: "Moderation",
  data: {
    name: "ban",
    description: "Manage server bans",
    options: [
      {
        type: 1,
        name: "user",
        description: "Ban a member from the server",
        options: [
          {
            type: 6,
            name: "target",
            description: "User to ban",
            required: true,
          },
          {
            type: 3,
            name: "reason",
            description: "Reason for the ban",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "list",
        description: "Displays a list of currently banned users in this server",
      },
    ],
  },

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "You don’t have permission to use this command.", flags: [MessageFlags.Ephemeral] });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "user") {
      const user = interaction.options.getUser("target", true);
      const reason = interaction.options.getString("reason") ?? "No reason provided";

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (member) {
        if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
          return interaction.reply({ content: "You can’t ban someone with an equal or higher role than you.", flags: [MessageFlags.Ephemeral] });
        }
        if (!member.bannable) {
          return interaction.reply({ content: "Missing permissions to ban that member.", flags: [MessageFlags.Ephemeral] });
        }
      }

      await user.send(`⚠️ You have been banned from **${interaction.guild.name}**\n**Reason:** ${reason}`).catch(() => {});
      await interaction.guild.members.ban(user.id, { reason: `${reason} — by ${interaction.user.tag}` });

      const embed = new EmbedBuilder()
        .setTitle("⛔ Member banned")
        .setColor(0xd32f2f)
        .addFields(
          { name: "User", value: `${user} (${user.id})`, inline: false },
          { name: "Reason", value: reason, inline: true },
        )
        .setFooter({ text: "GameBoy moderation" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "list") {
      await interaction.deferReply({ ephemeral: true });

      try {
        const bans = await interaction.guild.bans.fetch({ limit: 100 });
        
        if (bans.size === 0) {
          return interaction.editReply({ content: "There are currently no banned users on this server." });
        }

        const embed = new EmbedBuilder()
          .setTitle("📑 Server Ban Registry")
          .setColor(0x8a5cff)
          .setFooter({ text: "GameBoy moderation" })
          .setTimestamp();

        let banRecords = "";
        bans.forEach((ban) => {
          banRecords += `• **${ban.user.tag}** (${ban.user.id})\n  *Reason:* ${ban.reason ?? "No reason provided"}\n`;
        });

        embed.setDescription(banRecords.substring(0, 4000));
        return interaction.editReply({ embeds: [embed] });

      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: "Failed to load the server ban records." });
      }
    }
  },
};