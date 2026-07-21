const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");
const { audit, notifyAdmin } = require("../moderationUtils.js");

module.exports = {
  category: "Moderation",
  data: {
    name: "timeout",
    description: "Timeout (mute) a member for a given duration",
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    options: [
      {
        name: "user",
        description: "User to timeout",
        type: 6,
        required: true,
      },
      {
        name: "duration",
        description: "Duration like 10m, 2h, 1d",
        type: 3,
        required: true,
      },
      {
        name: "reason",
        description: "Reason",
        type: 3,
        required: false,
      },
    ],
  },

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "You don’t have permission to use this.", flags: [MessageFlags.Ephemeral] });
    }

    const user = interaction.options.getUser("user", true);
    const durationStr = interaction.options.getString("duration", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: "I can’t find that member.", flags: [MessageFlags.Ephemeral] });

    const ms = parseDuration(durationStr);
    if (!ms) return interaction.reply({ content: "Invalid duration. Use like `10m`, `2h`, `1d`.", flags: [MessageFlags.Ephemeral] });
    if (ms < 5_000) return interaction.reply({ content: "Duration too short.", flags: [MessageFlags.Ephemeral] });
    if (ms > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ content: "Max timeout is 28 days.", flags: [MessageFlags.Ephemeral] });
    }

    // Role hierarchy guard
    if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: "You can’t timeout someone with an equal/higher role than you.", flags: [MessageFlags.Ephemeral] });
    }
    if (!member.moderatable) {
      return interaction.reply({ content: "I can’t timeout that member (role hierarchy / missing permissions).", flags: [MessageFlags.Ephemeral] });
    }

    await member.timeout(ms, `${reason} — by ${interaction.user.tag}`);
    audit("timeout", { action: "Timeout command used", actor: interaction.user, target: user, reason, context: `duration=${durationStr}` });
    await notifyAdmin(interaction.guild, { embeds: [new EmbedBuilder().setColor(0xffb020).setTitle("Member timed out").setDescription(`Admin: <@${interaction.user.id}>\nUser: <@${user.id}>\nDuration: ${durationStr}\nReason: ${reason}`).setTimestamp()] });

    const embed = new EmbedBuilder()
      .setTitle("⏳ Member timed out")
      .setColor(0xffb020)
      .addFields(
        { name: "User", value: `${user} (${user.id})`, inline: false },
        { name: "Duration", value: durationStr, inline: true },
        { name: "Reason", value: reason, inline: true },
      )
      .setFooter({ text: "GameBoy moderation" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

function parseDuration(input) {
  const m = input.trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d)$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return n * mult;
}
