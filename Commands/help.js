const { EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
  category: "Other",
  data: {
    name: "help",
    description: "Shows available commands",
  },
  async execute(interaction) {
    const commands = interaction.client.commands;
    
    const categories = {
      Moderation: [],
      Utilities: [],
      Entertainment: [],
      Other: []
    };

    commands.forEach(cmd => {
      const category = cmd.category || "Other";
      if (categories[category]) {
        categories[category].push(`\`/${cmd.data.name}\``);
      }
    });

    let descriptionText = "";
    for (const [catName, cmdList] of Object.entries(categories)) {
      if (cmdList.length > 0) {
        descriptionText += `**${catName}:**\n${cmdList.join(", ")}\n\n`;
      }
    }

    await interaction.reply({
      embeds: [{
        title: "Available commands",
        description: descriptionText || "No commands loaded.",
        color: 0xd6aded,
        footer: { text: "GameBoy" }
      }],
      flags: [MessageFlags.Ephemeral],
    });
  },
};