const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");
const { saveLog } = require("../logManager.js");

module.exports = {
  category: "Moderation",
  data: {
    name: "purge",
    description: "Bulk delete messages",
    options: [
      {
        type: 1,
        name: "amount",
        description: "Delete recent messages from this channel",
        options: [
          {
            type: 4,
            name: "count",
            description: "How many messages",
            required: true,
            choices: [
              { name: "10", value: 10 },
              { name: "50", value: 50 },
              { name: "100", value: 100 },
            ],
          },
        ],
      },

      {
        type: 1,
        name: "user",
        description: "Delete messages from a specific user",
        options: [
          {
            type: 6,
            name: "target",
            description: "User whose messages you want to delete",
            required: true,
          },
          {
            type: 4,
            name: "scan",
            description: "How many recent messages to scan?",
            required: false,
            choices: [
              { name: "Scan last 50", value: 50 },
              { name: "Scan last 100", value: 100 },
            ],
          },
        ],
      },

      {
        type: 1,
        name: "channel",
        description: "Completely purge everything from the channel",
        options: [
          {
            type: 5,
            name: "confirm",
            description: "Confirm you want to delete and recreate this channel?",
            required: true,
          },
        ],
      },
    ],
  },

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "You need moderator permissions to use this command.", flags: [MessageFlags.Ephemeral] });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "amount") {
      await interaction.deferReply({ ephemeral: true });
      const count = interaction.options.getInteger("count", true);

      const deleted = await interaction.channel.bulkDelete(count, true).catch(() => null);
      if (!deleted) {
        return interaction.editReply(embedResult("Failed to delete messages. Note: Messages older than 14 days cannot be bulk-deleted."));
      }

      saveLog("purge", {
        action: `Purged ${deleted.size} messages`,
        who: `${interaction.user.tag}`,
        reason: `Cleared active recent feed history layout.`
      });

      return interaction.editReply(embedResult(`Successfully deleted **${deleted.size}** recent messages.`));
    }

    if (sub === "user") {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser("target", true);
      const scanLimit = interaction.options.getInteger("scan") ?? 50;

      const messages = await interaction.channel.messages.fetch({ limit: scanLimit }).catch(() => null);
      if (!messages) return interaction.editReply(embedResult("Could not fetch channel text context."));

      const userMessages = messages.filter(m => m.author.id === target.id);
      if (userMessages.size === 0) {
        return interaction.editReply(embedResult(`Found no recent messages from ${target} within the last ${scanLimit} messages.`));
      }

      const deleted = await interaction.channel.bulkDelete(userMessages, true).catch(() => null);
      if (!deleted) {
        return interaction.editReply(embedResult("Failed to delete messages. They might be older than 14 days."));
      }

      saveLog("purge", {
        action: `Purged ${deleted.size} messages from target user`,
        who: `${interaction.user.tag}`,
        reason: `Targeted wipe on member: ${target.tag} (${target.id})`
      });

      return interaction.editReply(embedResult(`Successfully deleted **${deleted.size}** messages from ${target}.`));
    }

    if (sub === "channel") {
      await interaction.deferReply({ ephemeral: true });
      const confirm = interaction.options.getBoolean("confirm", true);
      
      if (!confirm) {
        return interaction.editReply(embedResult("Purge not confirmed. Action cancelled."));
      }

      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.editReply({ content: "You need moderator permissions to use this command.", flags: [MessageFlags.Ephemeral] });
      }

      const oldChannel = interaction.channel;
      const cloned = await oldChannel.clone({
        name: oldChannel.name,
        reason: `Full purge by ${interaction.user.tag}`,
      });

      if ("parentId" in oldChannel && oldChannel.parentId) {
        await cloned.setParent(oldChannel.parentId).catch(() => {});
      }
      if ("rawPosition" in oldChannel) {
        await cloned.setPosition(oldChannel.rawPosition).catch(() => {});
      }

      saveLog("purge", { 
        action: `Nuked entire channel content: #${oldChannel.name}`, 
        who: `${interaction.user.tag}`, 
        reason: "Cloned and deleted original structure channel." 
      });

      await oldChannel.delete(`Full purge by ${interaction.user.tag}`);
      await interaction.user.send(`✅ Full purge done. New channel created: #${cloned.name}`).catch(() => {});
      return; 
    }

    return interaction.editReply(embedResult("Unknown purge mode."));
  },
};

function embedResult(text) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("🧹 Purge Action")
        .setDescription(text)
        .setColor(0x8a5cff)
        .setFooter({ text: "GameBoy moderation" })
        .setTimestamp()
    ],
  };
}