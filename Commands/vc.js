const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require("discord.js");

module.exports = {
  category: "Moderation",
  data: new SlashCommandBuilder()
    .setName("vc")
    .setDescription("Manage voice channels and voice moderation actions")
    .addSubcommand(sub =>
      sub.setName("mute")
        .setDescription("Mute a member in a voice channel")
        .addUserOption(opt => opt.setName("user").setDescription("The member to mute").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("unmute")
        .setDescription("Unmute a member in a voice channel")
        .addUserOption(opt => opt.setName("user").setDescription("The member to unmute").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("afk")
        .setDescription("Move a member to the AFK channel")
        .addUserOption(opt => opt.setName("user").setDescription("The member to move").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Disconnect a member from voice")
        .addUserOption(opt => opt.setName("user").setDescription("The member to disconnect").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("limit")
        .setDescription("Set the user limit for the current voice channel")
        .addIntegerOption(opt => opt.setName("amount").setDescription("How many people can join").setRequired(true).setMinValue(0).setMaxValue(99))
    )
    .addSubcommand(sub =>
      sub.setName("name")
        .setDescription("Rename the current voice channel")
        .addStringOption(opt => opt.setName("name").setDescription("The new channel name").setRequired(true))
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.MuteMembers)) {
      return interaction.reply({ content: "Sorry, you need voice moderation permissions to use this.", flags: [MessageFlags.Ephemeral] });
    }

    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("user");
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUser?.id || interaction.user.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: "I couldn’t find that member in this server.", flags: [MessageFlags.Ephemeral] });
    }

    const voiceChannel = member.voice.channel;

    try {
      if (sub === "mute") {
        if (!voiceChannel) {
          return interaction.reply({ content: "That member isn’t in a voice channel right now.", flags: [MessageFlags.Ephemeral] });
        }
        await member.voice.setMute(true);
        return interaction.reply({ content: `✅ ${member.user.tag} has been muted in voice.`, flags: [MessageFlags.Ephemeral] });
      }

      if (sub === "unmute") {
        if (!voiceChannel) {
          return interaction.reply({ content: "That member isn’t in a voice channel right now.", flags: [MessageFlags.Ephemeral] });
        }
        await member.voice.setMute(false);
        return interaction.reply({ content: `✅ ${member.user.tag} has been unmuted.`, flags: [MessageFlags.Ephemeral] });
      }

      if (sub === "afk") {
        const afkChannel = guild.afkChannel;
        if (!afkChannel) {
          return interaction.reply({ content: "There isn’t an AFK channel set for this server.", flags: [MessageFlags.Ephemeral] });
        }
        await member.voice.setChannel(afkChannel);
        return interaction.reply({ content: `✅ ${member.user.tag} has been moved to the AFK channel.`, flags: [MessageFlags.Ephemeral] });
      }

      if (sub === "remove") {
        if (!voiceChannel) {
          return interaction.reply({ content: "That member isn’t in a voice channel right now.", flags: [MessageFlags.Ephemeral] });
        }
        await member.voice.disconnect();
        return interaction.reply({ content: `✅ ${member.user.tag} has been disconnected from voice.`, flags: [MessageFlags.Ephemeral] });
      }

      if (sub === "limit") {
        const currentChannel = interaction.member.voice.channel;
        if (!currentChannel) {
          return interaction.reply({ content: "You need to be in a voice channel to change its limit.", flags: [MessageFlags.Ephemeral] });
        }
        await currentChannel.setUserLimit(interaction.options.getInteger("amount"));
        return interaction.reply({ content: `✅ The user limit for this voice channel is now ${interaction.options.getInteger("amount")}.`, flags: [MessageFlags.Ephemeral] });
      }

      if (sub === "name") {
        const currentChannel = interaction.member.voice.channel;
        if (!currentChannel) {
          return interaction.reply({ content: "You need to be in a voice channel to rename it.", flags: [MessageFlags.Ephemeral] });
        }
        await currentChannel.setName(interaction.options.getString("name"));
        return interaction.reply({ content: `✅ This voice channel is now named **${interaction.options.getString("name")}**.`, flags: [MessageFlags.Ephemeral] });
      }

      return interaction.reply({ content: "That option isn’t available right now.", flags: [MessageFlags.Ephemeral] });
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "I couldn’t complete that voice action. Please check my permissions and try again.", flags: [MessageFlags.Ephemeral] });
    }
  },
};
