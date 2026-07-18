const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const levelManager = require("../levelManager.js");

module.exports = {
  category: "Entertainment",
  data: new SlashCommandBuilder()
    .setName("leaderboards")
    .setDescription("View the top ranked members of the server for various activities.")
    .addSubcommand(sub => 
      sub.setName("messages")
         .setDescription("View the top members with the most messages sent.")
    )
    .addSubcommand(sub => 
      sub.setName("vc")
         .setDescription("View the top members with the most voice chat time.")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const users = levelManager.getGuildUsers(guildId);
    
    const isMessages = sub === "messages";

    const activeUsers = Object.entries(users)
      .filter(u => isMessages ? (u[1].messages > 0) : ((u[1].vcTime || 0) > 0))
      .sort((a, b) => isMessages 
        ? (b[1].messages - a[1].messages) 
        : ((b[1].vcTime || 0) - (a[1].vcTime || 0))
      );

    if (activeUsers.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle(isMessages ? "🏆 Messages Leaderboard" : "🎙️ Voice Chat Leaderboard")
        .setColor(0x8a5cff)
        .setDescription(`No active ${isMessages ? "message" : "voice chat"} data recorded yet.`)
        .setTimestamp();
      return interaction.reply({ embeds: [emptyEmbed] });
    }

    const itemsPerPage = 10;
    const pages = [];
    
    for (let i = 0; i < activeUsers.length; i += itemsPerPage) {
      const chunk = activeUsers.slice(i, i + itemsPerPage);
      let textBuffer = "";
      
      chunk.forEach((u, index) => {
        const rank = i + index + 1;
        if (isMessages) {
          textBuffer += `🔹 **Rank #${rank}** — <@${u[0]}>\n• **Messages:** ${u[1].messages}\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`;
        } else {
          const formattedTime = levelManager.getVoiceTime(guildId, u[0]) || "0 minutes";
          textBuffer += `🔹 **Rank #${rank}** — <@${u[0]}>\n• **Time in VC:** ${formattedTime}\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`;
        }
      });
      
      const embed = new EmbedBuilder()
        .setTitle(isMessages ? "🏆 Messages Leaderboard" : "🎙️ Voice Chat Leaderboard")
        .setColor(0x8a5cff)
        .setDescription(textBuffer)
        .setTimestamp()
        .setFooter({ text: `GameBoy Ranking Engine • Page ${Math.floor(i / itemsPerPage) + 1} of ${Math.ceil(activeUsers.length / itemsPerPage)}` });
        
      pages.push(embed);
    }

    if (pages.length === 1) {
      return interaction.reply({ embeds: [pages[0]] });
    }

    const message = await interaction.reply({ embeds: [pages[0]], fetchReply: true });
    await message.react("⬅️");
    await message.react("➡️");

    const filter = (reaction, user) => ["⬅️", "➡️"].includes(reaction.emoji.name) && !user.bot && user.id === interaction.user.id;
    const collector = message.createReactionCollector({ filter, time: 120000 }); // 2 minutes active time

    let currentPage = 0;

    collector.on("collect", async (reaction, user) => {
      try { await reaction.users.remove(user.id); } catch (e) {}

      if (reaction.emoji.name === "➡️") {
        if (currentPage < pages.length - 1) currentPage++;
      } else if (reaction.emoji.name === "⬅️") {
        if (currentPage > 0) currentPage--;
      }

      await interaction.editReply({ embeds: [pages[currentPage]] });
    });

    collector.on("end", () => {
      message.reactions.removeAll().catch(() => {});
    });
  }
};