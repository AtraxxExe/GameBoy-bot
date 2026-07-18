const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");
const levelManager = require("../levelManager.js");

module.exports = {
  category: "Entertainment",
  data: new SlashCommandBuilder()
    .setName("levels")
    .setDescription("Configure or view the server leveling system modules.")
    .addSubcommand(sub => 
      sub.setName("set")
        .setDescription("Set the level-up alert announcement channel.")
        .addChannelOption(o => 
          o.setName("channel")
           .setDescription("Select the channel for leveling alerts")
           .setRequired(true)
        )
    )
    .addSubcommand(sub => sub.setName("top10").setDescription("View the top 10 ranked active members of the server."))
    .addSubcommand(sub => sub.setName("reset").setDescription("Clear all levels, XP, and settings for this server (Admin only).")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "set") {
      if (!interaction.member || !interaction.member.permissions || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "❌ Administrator permissions required.", flags: [MessageFlags.Ephemeral] });
      }

      levelManager.saveSettings(guildId, { channelId: interaction.options.getChannel("channel").id });
      return interaction.reply({ content: "✅ Level-up announcements are now set.", flags: [MessageFlags.Ephemeral] });
    }

    if (sub === "top10") {
      await interaction.guild.members.fetch();
      
      const users = levelManager.getGuildUsers(guildId);
      
      const top = Object.entries(users)
        .filter(u => {
          if ((u[1].messages || 0) === 0 && (u[1].level || 0) === 0) return false;

          const member = interaction.guild.members.cache.get(u[0]);
          if (member && member.user.bot) return false;
          
          return true;
        })
        .sort((a, b) => b[1].level - a[1].level || b[1].messages - a[1].messages)
        .slice(0, 10);

      const embed = new EmbedBuilder()
        .setTitle("🏆 Server Level Top 10")
        .setColor(0xd6aded)
        .setTimestamp()
        .setFooter({ text: "GameBoy Ranking Engine" });

      if (top.length === 0) {
        embed.setDescription("No activity data recorded on this leaderboard yet.");
      } else {
        let textBuffer = "";
        top.forEach((u, i) => {
          textBuffer += `🔹 **Rank #${i + 1}** — <@${u[0]}>\n` +
                        `• **Level:** ${u[1].level} | **Messages:** ${u[1].messages}\n` +
                        `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`;
        });
        embed.setDescription(textBuffer);
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "reset") {
      if (!interaction.member || !interaction.member.permissions || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "❌ Administrator permissions required.", flags: [MessageFlags.Ephemeral] });
      }

      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      if (typeof levelManager.resetGuild === 'function') {
        await levelManager.resetGuild(guildId);
        
        try {
          await interaction.guild.members.fetch();

          const milestoneRoles = interaction.guild.roles.cache.filter(role => role.name.match(/^Level \d+$/));
          
          for (const [roleId, role] of milestoneRoles) {
            for (const [memberId, member] of role.members) {
              await member.roles.remove(role).catch(err => console.error(`Failed to remove role from ${member.user.tag}:`, err));
            }
          }
          
          return interaction.editReply({ content: "✅ Server leveling data, settings, and user milestone roles have been completely reset." });
        } catch (err) {
          console.error("Error clearing milestone roles:", err);
          return interaction.editReply({ content: "⚠️ Levels were reset, but I had trouble removing some milestone roles. Please check my role order." });
        }
      }

      return interaction.editReply({ content: "⚠️ The reset option isn’t available right now." });
    }
  }
};