const { EmbedBuilder, MessageFlags, PermissionsBitField } = require("discord.js");
const { getLogs } = require("../logManager.js");

module.exports = {
  category: "Utilities",
  data: {
    name: "invites",
    description: "View invite stats and leaderboards",
    options: [
      {
        type: 1,
        name: "user",
        description: "Check how many members a user has invited",
        options: [
          {
            type: 6,
            name: "target",
            description: "The user to check",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "leaderboard",
        description: "Show the top server inviters",
      },
    ],
  },

  async execute(interaction) {
    const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
    if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ 
        content: "❌ I need the **Manage Server** (`ManageGuild`) permission enabled to access and track invite metrics.", 
        flags: [MessageFlags.Ephemeral] 
      });
    }

    const sub = interaction.options.getSubcommand();
    
    const allLogs = getLogs();
    const joinLogs = allLogs["joins_leaves"] || [];

    const inviterData = new Map();

    joinLogs.forEach((log) => {
      if (!log.action.includes("Member Joined:")) return;

      const joinedIdMatch = log.who.match(/ID:\s*(\d+)/);
      if (!joinedIdMatch) return;
      const joinedId = joinedIdMatch[1];

      const inviterMatch = log.reason.match(/Invited by:\s*\*\*([^*]+)\*\*/);
      if (!inviterMatch) return;
      const inviterTag = inviterMatch[1];

      if (!inviterData.has(inviterTag)) {
        inviterData.set(inviterTag, new Set());
      }
      
      inviterData.get(inviterTag).add(joinedId);
    });

    if (sub === "user") {
      const targetUser = interaction.options.getUser("target") ?? interaction.user;
      
      const uniqueInvitesCount = inviterData.get(targetUser.tag)?.size || 0;

      const embed = new EmbedBuilder()
        .setTitle("Invite Tracking Profile")
        .setDescription(`User ${targetUser} has successfully brought **${uniqueInvitesCount}** members to the server.`)
        .setColor(0xd6aded)
        .setTimestamp()
        .setFooter({ text: "GameBoy Stats" });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "leaderboard") {
      const sortedLeaderboard = Array.from(inviterData.entries())
        .map(([tag, set]) => ({ tag, count: set.size }))
        .sort((a, b) => b.count - a.count);

      const embed = new EmbedBuilder()
        .setTitle("Server Invite Leaderboard")
        .setColor(0xd6aded)
        .setTimestamp()
        .setFooter({ text: "GameBoy Stats" });

      if (sortedLeaderboard.length === 0) {
        embed.setDescription("No tracked invites have been registered yet.");
        return interaction.reply({ embeds: [embed] });
      }

      let leaderboardText = "";
      sortedLeaderboard.slice(0, 10).forEach((entry, index) => {
        leaderboardText += `${index + 1}. ${entry.tag} - ${entry.count} invites\n`;
      });

      embed.setDescription(leaderboardText);
      return interaction.reply({ embeds: [embed] });
    }
  },
};