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
      return interaction.reply({ content: "Sorry, only admins can use this.", flags: [MessageFlags.Ephemeral] });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "set") {
      const channel = interaction.options.getChannel("channel");
      
      const currentConfig = welcomeManager.getConfig("hiddenlogs", guildId);
      if (currentConfig && currentConfig.channelId === channel.id) {
        return interaction.reply({
          content: "That channel is already set as the hidden logs channel.",
          flags: [MessageFlags.Ephemeral]
        });
      }
      
      welcomeManager.saveConfig("hiddenlogs", guildId, {
        channelId: channel.id
      });

      return interaction.reply({ 
        content: `✅ The hidden logs channel is now set to <#${channel.id}>.`, 
        flags: [MessageFlags.Ephemeral] 
      });
    }
  }
}