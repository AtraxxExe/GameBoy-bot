const { PermissionsBitField, EmbedBuilder, MessageFlags, SlashCommandBuilder } = require("discord.js");

module.exports = {
  category: "Other",
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Server utility information")
    .addSubcommand(subcommand =>
      subcommand
        .setName("stats")
        .setDescription("Display real-time statistics and details about this server")
    ),

  async execute(interaction) {
    await interaction.deferReply();
    
    const guild = interaction.guild;

    const members = await guild.members.fetch({ withPresences: true });

    const totalMembers = guild.memberCount;
    const activeMembers = members.filter(member => 
      member.presence && ['online', 'idle', 'dnd'].includes(member.presence.status)
    ).size;

    const creationDate = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`;

    const statsEmbed = new EmbedBuilder()
      .setTitle(`📊 ${guild.name} — Server Statistics`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .setColor(0xd6aded)
      .addFields(
        { name: "🏰 Server Name", value: `${guild.name}`, inline: true },
        { name: "📆 Created On", value: creationDate, inline: true },
        { name: "🚀 Boost Level", value: `Level **${guild.premiumTier}** (${guild.premiumSubscriptionCount} Boosts)`, inline: true },
        { name: "👥 Total Population", value: `**${totalMembers}** members`, inline: true },
        { name: "🟢 Active Users", value: `**${activeMembers}** users online right now`, inline: true },
      )
      .setFooter({ text: "GameBoy Analytics Hub" })
      .setTimestamp();

    return interaction.editReply({ embeds: [statsEmbed] });
  }
};