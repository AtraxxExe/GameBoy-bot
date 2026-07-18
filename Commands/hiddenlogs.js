const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require("discord.js");
const welcomeManager = require("../welcomeManager.js");

module.exports = {
  category: "Other",
  data: new SlashCommandBuilder()
    .setName("hiddenlogs")
    .setDescription("Configure a hidden logs channel for permanent image storage.")
    .addSubcommand(sub => 
      sub.setName("set")
        .setDescription("Set the hidden private logs channel.")
        .addChannelOption(opt => 
          opt.setName("channel")
            .setDescription("The hidden channel to store setup images")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Administrator authorization required.", flags: [MessageFlags.Ephemeral] });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "set") {
      const channel = interaction.options.getChannel("channel");
      
      const currentConfig = welcomeManager.getConfig("hiddenlogs", guildId);
      if (currentConfig && currentConfig.channelId === channel.id) {
        return interaction.reply({
          content: "⚠️ This channel has already been set for hiddenlogs.",
          flags: [MessageFlags.Ephemeral]
        });
      }
      
      welcomeManager.saveConfig("hiddenlogs", guildId, {
        channelId: channel.id
      });

      return interaction.reply({ 
        content: `✅ **Hidden logs channel set to <#${channel.id}>.** Setup images will now be permanently backed up here to prevent Discord link expiration.`, 
        flags: [MessageFlags.Ephemeral] 
      });
    }
  }
}