const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");
const { audit, notifyAdmin } = require("../moderationUtils.js");

module.exports = {
  category: "Moderation",
  data: {
    name: "purge",
    description: "Bulk delete messages",
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    options: [
      {
        type: 1,
        name: "amount",
        description: "Delete a specific number of recent messages from this channel",
        options: [
          {
            type: 4,
            name: "amount",
            description: "How many messages to delete? (1-100)",
            required: true,
            min_value: 1,
            max_value: 100,
          },
        ],
      },

      {
        type: 1,
        name: "user",
        description: "Delete a specific number of messages from a specific user",
        options: [
          {
            type: 6,
            name: "target",
            description: "User whose messages you want to delete",
            required: true,
          },
          {
            type: 4,
            name: "amount",
            description: "How many recent messages from that user to delete? (1-100)",
            required: true,
            min_value: 1,
            max_value: 100,
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
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "You need moderator permissions to use this command.", flags: [MessageFlags.Ephemeral] });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "amount") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const count = Math.min(Math.max(interaction.options.getInteger("amount", true), 1), 100);

      const deleted = await interaction.channel.bulkDelete(count, true).catch(() => null);
      if (!deleted) {
        return interaction.editReply(embedResult("Failed to delete messages. Note: Messages older than 14 days cannot be bulk-deleted."));
      }

      audit("purge", { action: `Purged ${deleted.size} messages`, actor: interaction.user, reason: "Recent messages deleted", context: `channel=${interaction.channelId}` });
      await notifyAdmin(interaction.guild, { embeds: [new EmbedBuilder().setColor(0xd6aded).setTitle("Messages purged").setDescription(`Admin: <@${interaction.user.id}>\nChannel: <#${interaction.channelId}>\nDeleted: **${deleted.size}** messages`).setTimestamp()] });

      return interaction.editReply(embedResult(`Successfully deleted **${deleted.size}** recent messages.`));
    }

    if (sub === "user") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const target = interaction.options.getUser("target", true);
      const amount = Math.min(Math.max(interaction.options.getInteger("amount", true), 1), 100);

      let collected = [];
      let before = null;

      while (collected.length < amount) {
        const batch = await interaction.channel.messages.fetch({ limit: 100, before }).catch(() => null);
        if (!batch || batch.size === 0) break;

        const matching = [...batch.values()].filter(m => m.author.id === target.id);
        collected.push(...matching);

        if (collected.length >= amount) break;
        if (batch.size < 100) break;

        before = batch.last().id;
      }

      const targetMessages = collected.slice(0, amount);
      if (targetMessages.length === 0) {
        return interaction.editReply(embedResult(`Found no recent messages from ${target} in the last messages I could inspect.`));
      }

      const deleted = await interaction.channel.bulkDelete(targetMessages, true).catch(() => null);
      if (!deleted) {
        return interaction.editReply(embedResult("Failed to delete messages. They might be older than 14 days."));
      }

      audit("purge", { action: `Purged ${deleted.size} messages`, actor: interaction.user, target, reason: "Targeted message deletion", context: `channel=${interaction.channelId}` });
      await notifyAdmin(interaction.guild, { embeds: [new EmbedBuilder().setColor(0xd6aded).setTitle("Messages purged").setDescription(`Admin: <@${interaction.user.id}>\nUser: <@${target.id}>\nChannel: <#${interaction.channelId}>\nDeleted: **${deleted.size}** messages`).setTimestamp()] });

      return interaction.editReply(embedResult(`Successfully deleted **${deleted.size}** messages from ${target}.`));
    }

    if (sub === "channel") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const confirm = interaction.options.getBoolean("confirm", true);
      
      if (!confirm) {
        return interaction.editReply(embedResult("Purge not confirmed. Action cancelled."));
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

      audit("purge", { action: "Channel cloned and purged", actor: interaction.user, reason: "Full channel purge", context: `channel=${oldChannel.id}` });
      await notifyAdmin(interaction.guild, { embeds: [new EmbedBuilder().setColor(0xd6aded).setTitle("Channel purged").setDescription(`Admin: <@${interaction.user.id}>\nChannel: #${oldChannel.name}`).setTimestamp()] });

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
        .setColor(0xd6aded)
        .setFooter({ text: "GameBoy moderation" })
        .setTimestamp()
    ],
  };
}
