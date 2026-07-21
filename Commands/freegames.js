const { SlashCommandBuilder, PermissionsBitField, ChannelType, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const freeGamesManager = require("../freeGamesManager.js");
const { collectFreeGameOffers, buildFreeGamesPreviewEmbed } = require("../freeGamesService.js");

module.exports = {
  category: "Other",
  data: new SlashCommandBuilder()
    .setName("freegames")
    .setDescription("Configure free-game announcements for this server")
    .addSubcommand(sub =>
      sub
        .setName("set")
        .setDescription("Pick the channel where free game alerts will be posted")
        .addChannelOption(option => option
          .setName("channel")
          .setDescription("Text channel for free game announcements")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("Check the current free game announcement channel")
    )
    .addSubcommand(sub =>
      sub
        .setName("check")
        .setDescription("Fetch the latest free-game offers right now")
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "This command can only be used inside a server.", flags: [MessageFlags.Ephemeral] });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const channel = interaction.options.getChannel("channel", true);
      freeGamesManager.setGuildChannel(interaction.guildId, channel.id);

      return interaction.reply({
        content: `Free game alerts will now be sent to ${channel}.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (subcommand === "check") {
      const offers = await collectFreeGameOffers();

      if (!offers.length) {
        return interaction.reply({
          content: "I couldn’t find any current free-game offers from the checked source right now.",
          flags: [MessageFlags.Ephemeral],
        });
      }

      const pageSize = 3;
      const totalPages = Math.max(1, Math.ceil(offers.length / pageSize));
      let pageIndex = 0;

      const buildPage = (index) => {
        const pageOffers = offers.slice(index * pageSize, index * pageSize + pageSize);
        return {
          embed: buildFreeGamesPreviewEmbed(pageOffers, offers.length, index + 1, totalPages),
          row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("freegames_prev").setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
            new ButtonBuilder().setCustomId("freegames_next").setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(index === totalPages - 1)
          ),
        };
      };

      const firstPage = buildPage(pageIndex);
      const message = await interaction.reply({
        embeds: [firstPage.embed],
        components: [firstPage.row],
        flags: [MessageFlags.Ephemeral],
        fetchReply: true,
      });

      const collector = message.createMessageComponentCollector({
        filter: (componentInteraction) => componentInteraction.user.id === interaction.user.id,
        time: 120_000,
      });

      collector.on("collect", async (componentInteraction) => {
        if (componentInteraction.customId === "freegames_prev") {
          pageIndex = Math.max(0, pageIndex - 1);
        } else if (componentInteraction.customId === "freegames_next") {
          pageIndex = Math.min(totalPages - 1, pageIndex + 1);
        }

        const page = buildPage(pageIndex);
        await componentInteraction.update({ embeds: [page.embed], components: [page.row] });
      });

      collector.on("end", () => {
        if (!message.deleted) {
          message.edit({ components: [] }).catch(() => {});
        }
      });

      return;
    }

    const config = freeGamesManager.getGuildChannel(interaction.guildId);
    if (!config?.channelId) {
      return interaction.reply({
        content: "No free game announcement channel is configured yet. Run /freegames set <channel> first.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    return interaction.reply({
      content: `Free game announcements are configured for <#${config.channelId}>.`,
      flags: [MessageFlags.Ephemeral],
    });
  },
};
