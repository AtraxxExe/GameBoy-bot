const { 
  SlashCommandBuilder, 
  PermissionsBitField, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle ,
  MessageFlags
} = require("discord.js");
const { getLogs } = require("../logManager.js");

module.exports = {
  category: "Moderation",
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("View server logs"),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "You need moderation permissions to do that.", flags: [MessageFlags.Ephemeral] });
    }

    let currentCategory = "ban";
    let currentPage = 1;
    let limitPerPage = 10;

    const fetchRenderData = (cat) => {
      const allLogs = getLogs();
      return allLogs[cat] || [];
    };

    const generateComponents = (totalLogs) => {
      const maxPages = Math.ceil(totalLogs / limitPerPage) || 1;

      const selectMenuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("log_category")
          .setPlaceholder("Select Log Type")
          .addOptions([
            { label: "Ban Logs", value: "ban", default: currentCategory === "ban" },
            { label: "Kick Logs", value: "kick", default: currentCategory === "kick" },
            { label: "Timeout Logs", value: "timeout", default: currentCategory === "timeout" },
            { label: "Purge Logs", value: "purge", default: currentCategory === "purge" },
            { label: "Message Edit Logs", value: "message_edits", default: currentCategory === "message_edits" },
            { label: "Deleted Messages Logs", value: "deleted_messages", default: currentCategory === "deleted_messages" },
            { label: "Joins & Leaves Logs", value: "joins_leaves", default: currentCategory === "joins_leaves" },
            { label: "Channel Changes Logs", value: "channel_changes", default: currentCategory === "channel_changes" },
            { label: "Role Logs", value: "role_logs", default: currentCategory === "role_logs" },
          ])
      );

      const sizeSelectorRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("log_size")
          .setPlaceholder(`Page Item Limit (Currently: ${limitPerPage})`)
          .addOptions([
            { label: "Show 10", value: "10", default: limitPerPage === 10 },
            { label: "Show 50", value: "50", default: limitPerPage === 50 },
            { label: "Show 100", value: "100", default: limitPerPage === 100 },
          ])
      );

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("log_prev")
          .setLabel("◀ Backward")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage <= 1),
        new ButtonBuilder()
          .setCustomId("log_page_indicator")
          .setLabel(`Page ${currentPage}/${maxPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("log_next")
          .setLabel("Forward ▶")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage >= maxPages)
      );

      return [selectMenuRow, sizeSelectorRow, actionRow];
    };

    const buildEmbed = () => {
      const categoryLogs = fetchRenderData(currentCategory);
      const totalLogs = categoryLogs.length;
      const maxPages = Math.ceil(totalLogs / limitPerPage) || 1;
      
      if (currentPage > maxPages) currentPage = maxPages;

      const startIndex = (currentPage - 1) * limitPerPage;
      const paginatedItems = categoryLogs.slice(startIndex, startIndex + limitPerPage);

      const formattedTitle = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1).toLowerCase().replace(/_/g, " ");

      const embed = new EmbedBuilder()
        .setTitle(`Server Activity Logs — ${formattedTitle}`)
        .setColor(0x8a5cff)
        .setTimestamp()
        .setFooter({ text: "GameBoy Monitoring" });

      if (paginatedItems.length === 0) {
        embed.setDescription("No records logged in this category yet.");
      } else {
        let textBuffer = "";
        paginatedItems.forEach((log) => {
          textBuffer += `🔹 **Action:** ${log.action}\n` +
                        `• **By:** ${log.who}\n` +
                        `• **Context:** ${log.reason}\n` +
                        `• **Logged:** <t:${log.timestamp}:R>\n` +
                        `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`;
        });
        embed.setDescription(textBuffer.substring(0, 4000));
      }

      return { embed, totalLogs };
    };

    const initialData = buildEmbed();
    const response = await interaction.reply({
      embeds: [initialData.embed],
      components: generateComponents(initialData.totalLogs),
      fetchReply: true
    });

    const collector = response.createMessageComponentCollector({ time: 600000 });

    collector.on("collect", async (i) => {
      if (!i.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
        return i.reply({ content: "You need moderation permissions to do that.", flags: [MessageFlags.Ephemeral] });
      }

      if (i.customId === "log_category") {
        currentCategory = i.values[0];
        currentPage = 1;
      } else if (i.customId === "log_size") {
        limitPerPage = parseInt(i.values[0], 10);
        currentPage = 1;
      } else if (i.customId === "log_prev") {
        currentPage--;
      } else if (i.customId === "log_next") {
        currentPage++;
      }

      const updatedData = buildEmbed();
      await i.update({
        embeds: [updatedData.embed],
        components: generateComponents(updatedData.totalLogs)
      });
    });

    collector.on("end", () => {
      response.edit({ components: [] }).catch(() => {});
    });
  },
};