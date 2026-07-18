const { SlashCommandBuilder, PermissionsBitField, ChannelType, MessageFlags } = require("discord.js");
const giveawayManager = require("../giveawayManager.js");

module.exports = {
  category: "Other",
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Create and manage giveaways with a guided embed wizard")
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Launch a giveaway wizard in the selected channel")
        .addChannelOption(option => option
          .setName("channel")
          .setDescription("Channel where the giveaway card will be posted")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
        )
        .addStringOption(option => option.setName("title").setDescription("Giveaway header").setRequired(true))
        .addStringOption(option => option.setName("text").setDescription("Main giveaway body text").setRequired(true))
        .addStringOption(option => option.setName("countdown").setDescription("Countdown duration, for example 00:01:00 or 90m").setRequired(true))
        .addStringOption(option => option.setName("color").setDescription("Embed color as hex, like #d6aded").setRequired(false))
        .addStringOption(option => option.setName("buttoncolor").setDescription("Button color").setRequired(false))
        .addStringOption(option => option.setName("image").setDescription("Image URL for the giveaway card").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove the latest active giveaway posted by the bot in this server")
    )
    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("List active giveaways in this server")
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "This command can only be used inside a server.", flags: [MessageFlags.Ephemeral] });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const channel = interaction.options.getChannel("channel", true);
      const title = interaction.options.getString("title", true);
      const text = interaction.options.getString("text", true);
      const countdownInput = interaction.options.getString("countdown", true);
      const color = interaction.options.getString("color");
      const buttonColor = interaction.options.getString("buttoncolor");
      const image = interaction.options.getString("image");

      const durationMs = giveawayManager.parseCountdownToMs(countdownInput);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return interaction.reply({ content: "Giveaway countdown must be a valid duration like `01:30:00` or `90m`.", flags: [MessageFlags.Ephemeral] });
      }

      const giveaway = giveawayManager.createGiveaway({
        guildId: interaction.guildId,
        channelId: channel.id,
        title,
        text,
        color,
        buttonColor,
        imageUrl: image || null,
        durationMs,
      });

      try {
        await giveawayManager.postGiveawayMessage(interaction.client, giveaway);
      } catch (err) {
        return interaction.reply({ content: "❌ I couldn’t post the giveaway card into that channel. Check my channel permissions and try again.", flags: [MessageFlags.Ephemeral] });
      }

      return interaction.reply({
        content: `✅ Giveaway created in ${channel}. It will run for ${countdownInput} and keep a live entry count automatically.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (subcommand === "remove") {
      const removed = await giveawayManager.removeLatestGiveaway(interaction.client, interaction.guildId);
      if (!removed) {
        return interaction.reply({ content: "I couldn’t find any active giveaway in this server that I can remove.", flags: [MessageFlags.Ephemeral] });
      }

      return interaction.reply({ content: "✅ The latest active giveaway card has been removed.", flags: [MessageFlags.Ephemeral] });
    }

    if (subcommand === "status") {
      const active = giveawayManager.getAllGiveaways().filter(item => item.status === "active");
      if (!active.length) {
        return interaction.reply({ content: "No active giveaways are currently running in this server.", flags: [MessageFlags.Ephemeral] });
      }

      const lines = active.map(item => `• **${item.title}** in <#${item.channelId}> — ${item.entries.length} entries — ends <t:${Math.floor(item.endAt / 1000)}:R>`);
      return interaction.reply({ content: lines.join("\n"), flags: [MessageFlags.Ephemeral] });
    }

    return interaction.reply({ content: "Unknown giveaway subcommand.", flags: [MessageFlags.Ephemeral] });
  },
};
