const { 
  SlashCommandBuilder, 
  PermissionsBitField, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType,
  MessageFlags
} = require("discord.js");
const ticketManager = require("../ticketManager.js");

module.exports = {
  category: "Utilities",
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("GameBoy Ticket System Interface")
    .addSubcommand(subcmd =>
      subcmd
        .setName("setup")
        .setDescription("Setup ticket infrastructure configurations")
    )
    .addSubcommand(subcmd =>
      subcmd
        .setName("open")
        .setDescription("Open a support request ticket")
        .addStringOption(opt =>
          opt.setName("urgency")
            .setDescription("How urgent is this problem layout?")
            .setRequired(true)
            .addChoices(
              { name: "🔴 Urgent", value: "urgent" },
              { name: "🟡 Mild", value: "mild" },
              { name: "🟢 Not Urgent", value: "not urgent" }
            )
        )
        .addStringOption(opt =>
          opt.setName("problem")
            .setDescription("Briefly summarize the issue")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === "setup") {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: "❌ You need Administrator permissions to use this command.", flags: [MessageFlags.Ephemeral] });
      }

      await interaction.reply({ 
        content: "🛠️ **GameBoy Ticket Wizard Initialized.** Type `!stop!` at any point to terminate the wizard.", 
        flags: [MessageFlags.Ephemeral]
      });

      const filter = (m) => m.author.id === interaction.user.id;
      const channel = interaction.channel;

      const checkStop = async (userMsg, promptMsg) => {
        if (userMsg.content.trim() === "!stop!") {
          await userMsg.delete().catch(() => {});
          await promptMsg.delete().catch(() => {});
          await channel.send("🛑 **Setup Terminated.** Configurations preserved.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
          return true;
        }
        return false;
      };

      try {
        let reqChan;
        const p1 = await channel.send("👉 **Step 1:** Mention the channel where users are allowed to execute the `/ticket open` command.");
        const col1 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const msg1 = col1.first();
        if (await checkStop(msg1, p1)) return;
        
        reqChan = msg1.mentions.channels.first();
        await msg1.delete().catch(() => {}); 
        await p1.delete().catch(() => {});

        if (!reqChan) {
          const retryP1 = await channel.send("⚠️ **Valid text channel mention missing.** Please try again or type `!stop!` to terminate the wizard.");
          const retryCol1 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
          const retryMsg1 = retryCol1.first();
          if (await checkStop(retryMsg1, retryP1)) return;

          reqChan = retryMsg1.mentions.channels.first();
          await retryMsg1.delete().catch(() => {}); 
          await retryP1.delete().catch(() => {});

          if (!reqChan) {
            return channel.send("❌ Second attempt failed. Setup crashed due to invalid channel target configuration.");
          }
        }

        let centralChan;
        const p2 = await channel.send("👉 **Step 2:** Mention your **Ticket Central** management channel for moderators.");
        const col2 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const msg2 = col2.first();
        if (await checkStop(msg2, p2)) return;

        centralChan = msg2.mentions.channels.first();
        await msg2.delete().catch(() => {}); 
        await p2.delete().catch(() => {});

        if (!centralChan) {
          const retryP2 = await channel.send("⚠️ **Valid text channel mention missing.** Please try again or type `!stop!` to terminate the wizard.");
          const retryCol2 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
          const retryMsg2 = retryCol2.first();
          if (await checkStop(retryMsg2, retryP2)) return;

          centralChan = retryMsg2.mentions.channels.first();
          await retryMsg2.delete().catch(() => {}); 
          await retryP2.delete().catch(() => {});

          if (!centralChan) {
            return channel.send("❌ Second attempt failed. Setup crashed due to invalid central target configuration.");
          }
        }

        let targetCategory;
        const p3 = await channel.send("👉 **Step 3:** Provide the Target Category ID where new ticket channels should be created (Format: `<#ID>` or plain text ID digits).");
        const col3 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const msg3 = col3.first();
        if (await checkStop(msg3, p3)) return;
        
        let rawId = msg3.content.replace(/[<#>]/g, "").trim();
        await msg3.delete().catch(() => {}); 
        await p3.delete().catch(() => {});

        targetCategory = guild.channels.cache.get(rawId);

        if (!targetCategory || targetCategory.type !== ChannelType.GuildCategory) {
          const retryP3 = await channel.send("⚠️ **Invalid Category ID provided.** Please verify the ID and try again, or type `!stop!` to terminate the wizard.");
          const retryCol3 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
          const retryMsg3 = retryCol3.first();
          if (await checkStop(retryMsg3, retryP3)) return;

          rawId = retryMsg3.content.replace(/[<#>]/g, "").trim();
          await retryMsg3.delete().catch(() => {}); 
          await retryP3.delete().catch(() => {});

          targetCategory = guild.channels.cache.get(rawId);

          if (!targetCategory || targetCategory.type !== ChannelType.GuildCategory) {
            return channel.send("❌ Second attempt failed. Setup crashed due to an invalid category mapping profile.");
          }
        }

        ticketManager.saveConfig(guild.id, reqChan.id, centralChan.id, targetCategory.id);
        return channel.send(`🎉 **Ticket Infrastructure Synced.** Channels linked to category: **${targetCategory.name}**.`);

      } catch (err) {
        return channel.send("❌ Setup expired due to inactivity.");
      }
    }

    if (subcommand === "open") {
      const config = ticketManager.getConfig(guild.id);
      if (!config) {
        return interaction.reply({ content: "⚠️ Ticket engine requires configuration settings setup first by an Administrator.", flags: [MessageFlags.Ephemeral] });
      }

      if (interaction.channelId !== config.requestChannelId) {
        return interaction.reply({ content: `⚠️ Sorry. You can only file support tickets in <#${config.requestChannelId}>.`, flags: [MessageFlags.Ephemeral] });
      }

      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const urgency = interaction.options.getString("urgency");
      const problem = interaction.options.getString("problem");
      const ticketNum = ticketManager.getNextTicketId(guild.id);

      try {
        const botMember = await guild.members.fetchMe().catch(() => null);
        if (!botMember) {
          return interaction.editReply({ content: "❌ I could not verify my own permissions for ticket creation.", flags: [MessageFlags.Ephemeral] });
        }

        const missingBotPerms = [];
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          missingBotPerms.push("Manage Roles");
        }
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          missingBotPerms.push("Manage Channels");
        }

        if (missingBotPerms.length > 0) {
          return interaction.editReply({
            content: `❌ I’m missing the following permissions needed to open tickets: ${missingBotPerms.join(", ")}. Please grant them to me and try again.`,
            flags: [MessageFlags.Ephemeral]
          });
        }

        const targetCategory = guild.channels.cache.get(config.categoryId) || await guild.channels.fetch(config.categoryId).catch(() => null);
        if (!targetCategory || targetCategory.type !== ChannelType.GuildCategory) {
          return interaction.editReply({ content: "❌ The configured ticket category is invalid or no longer accessible. Please re-run /ticket setup.", flags: [MessageFlags.Ephemeral] });
        }

        const ticketRole = await guild.roles.create({
          name: `Ticket [${ticketNum}]`,
          reason: `Auto-generated identifier asset for ticket request #${ticketNum}`
        });

        await interaction.member.roles.add(ticketRole);

        const channelPerms = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: ticketRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: guild.members.me.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageRoles
            ]
          }
        ];

        guild.roles.cache.forEach(r => {
          if (r.permissions.has(PermissionsBitField.Flags.ManageMessages) && !r.managed) {
            channelPerms.push({
              id: r.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            });
          }
        });

        const ticketChannel = await guild.channels.create({
          name: `ticket-${ticketNum}`,
          type: ChannelType.GuildText,
          parent: config.categoryId,
          permissionOverwrites: channelPerms
        });

        ticketManager.trackActiveTicket(guild.id, ticketChannel.id, interaction.user.id, ticketRole.id, ticketNum);

        await ticketChannel.send(`Hi <@${interaction.user.id}>! Please start describing your issue. A moderator will help you soon.`);

        const centralChannel = guild.channels.cache.get(config.centralChannelId);
        if (centralChannel) {
          const modEmbed = new EmbedBuilder()
            .setTitle(`🎫 Ticket Request Pending — #${ticketNum}`)
            .setColor(urgency === "urgent" ? 0xFF0000 : urgency === "mild" ? 0xFFA500 : 0x00FF00)
            .addFields(
              { name: "User", value: `${interaction.user} (${interaction.user.tag})`, inline: true },
              { name: "Urgency", value: urgency.toLowerCase(), inline: true },
              { name: "Problem", value: problem }
            )
            .setTimestamp()
            .setFooter({ text: `GameBoy Ticket System | Guild ID: ${guild.id}` });

          const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`accept_ticket_${ticketChannel.id}`)
              .setLabel("Accept Request")
              .setStyle(ButtonStyle.Success)
          );

          await centralChannel.send({ embeds: [modEmbed], components: [actionRow] });
        }

        return interaction.editReply({ content: `✅ Ticket registered successfully! Your ticket number is **#${ticketNum}**. Proceed to ${ticketChannel}.` });

      } catch (err) {
        console.error(err);

        if (err?.code === 50013 || err?.status === 403 || err?.message?.includes("Missing Permissions")) {
          return interaction.editReply({ content: "❌ I don’t have the required Discord permissions to create the ticket channel and role. Please update my permissions and try again.", flags: [MessageFlags.Ephemeral] });
        }

        return interaction.editReply({ content: "❌ An internal execution exception blocked configuration builds.", flags: [MessageFlags.Ephemeral] });
      }
    }
  }
};