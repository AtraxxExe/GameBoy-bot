const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require("discord.js");
const welcomeManager = require("../welcomeManager.js");

module.exports = {
  category: "Utilities",
  data: new SlashCommandBuilder()
    .setName("goodbyes")
    .setDescription("Configure leave tracking for departing members.")
    .addSubcommand(sub => sub.setName("set").setDescription("Launch wizard to set up goodbye embeds."))
    .addSubcommand(sub => 
      sub.setName("modify")
        .setDescription("Modify specific properties of your active goodbye card.")
        .addBooleanOption(opt => opt.setName("channel").setDescription("Modify the target channel?"))
        .addBooleanOption(opt => opt.setName("color").setDescription("Modify the sidebar color?"))
        .addBooleanOption(opt => opt.setName("header").setDescription("Modify the header title?"))
        .addBooleanOption(opt => opt.setName("body").setDescription("Modify the body text?"))
        .addBooleanOption(opt => opt.setName("picture").setDescription("Modify the embed picture?"))
    )
    .addSubcommand(sub => sub.setName("remove").setDescription("Permanently delete goodbye handling configurations."))
    .addSubcommand(sub => sub.setName("test").setDescription("Test your active goodbye configuration right now.")),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Administrator authorization required.", flags: [MessageFlags.Ephemeral] });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const existing = welcomeManager.getConfig("goodbyes", guildId);

    if (sub === "remove") {
      if (!existing) {
        return interaction.reply({ content: "⚠️ No existing configurations were found.", flags: [MessageFlags.Ephemeral] });
      }

      if (existing.image && existing.image.logMessageId) {
        const logsConfig = welcomeManager.getConfig("hiddenlogs", guildId);
        if (logsConfig && logsConfig.channelId) {
          const logsChannel = interaction.guild.channels.cache.get(logsConfig.channelId);
          if (logsChannel) {
            await logsChannel.messages.delete(existing.image.logMessageId).catch(() => {});
          }
        }
      }

      welcomeManager.removeConfig("goodbyes", guildId);
      return interaction.reply({ content: "🗑️ Goodbyes deleted.", flags: [MessageFlags.Ephemeral] });
    }

    if (sub === "test") {
      if (!existing) {
        return interaction.reply({ content: "⚠️ No goodbye configuration found to test! Run `/goodbyes set` first.", flags: [MessageFlags.Ephemeral] });
      }

      const goodbyeChannel = interaction.guild.channels.cache.get(existing.channelId);
      if (!goodbyeChannel) {
        return interaction.reply({ content: "❌ The configured goodbye channel could not be found.", flags: [MessageFlags.Ephemeral] });
      }

      const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
      const embed = new EmbedBuilder()
        .setColor(existing.color !== null && existing.color !== undefined ? existing.color : 0xff4b4b)
        .setTimestamp();

      if (existing.title) embed.setTitle(welcomeManager.parsePlaceholders(existing.title, interaction.member));
      if (existing.description) embed.setDescription(welcomeManager.parsePlaceholders(existing.description, interaction.member));

      const payload = { embeds: [embed] };

      if (existing.image) {
        if (existing.image.local) {
          const imgAttachment = new AttachmentBuilder(existing.image.url, { name: existing.image.name });
          embed.setImage(`attachment://${existing.image.name}`);
          payload.files = [imgAttachment];
        } else {
          embed.setImage(existing.image.url);
        }
      }

      await goodbyeChannel.send(payload).catch(err => console.error(err));
      return interaction.reply({ content: `✅ Sent a goodbye simulation card to <#${goodbyeChannel.id}>!`, flags: [MessageFlags.Ephemeral] });
    }

    let runChannel = true, runColor = true, runHeader = true, runBody = true, runPicture = true;

    if (sub === "modify") {
      if (!existing) {
        return interaction.reply({ content: "⚠️ No existing configurations were found. Run `/goodbyes set` first.", flags: [MessageFlags.Ephemeral] });
      }

      const modChan = interaction.options.getBoolean("channel") ?? false;
      const modColor = interaction.options.getBoolean("color") ?? false;
      const modHead = interaction.options.getBoolean("header") ?? false;
      const modBody = interaction.options.getBoolean("body") ?? false;
      const modPic = interaction.options.getBoolean("picture") ?? false;

      if (modChan || modColor || modHead || modBody || modPic) {
        runChannel = modChan;
        runColor = modColor;
        runHeader = modHead;
        runBody = modBody;
        runPicture = modPic;
      }
    } else if (sub === "set" && existing) {
      return interaction.reply({ content: "⚠️ Goodbye infrastructure is already configured! Use `/goodbyes modify` or `/goodbyes remove`.", flags: [MessageFlags.Ephemeral] });
    }

    await interaction.reply({ content: `🛠️ **Goodbye Embed Wizard Active.** Type \`!stop!\` to cancel.`, flags: [MessageFlags.Ephemeral] });

    const filter = (m) => m.author.id === interaction.user.id;
    const channel = interaction.channel;

    const checkStop = async (userMsg, promptMsg) => {
      if (userMsg.content.trim() === "!stop!") {
        await userMsg.delete().catch(() => {});
        await promptMsg.delete().catch(() => {});
        await channel.send("🛑 **Wizard Cancelled.**").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        return true;
      }
      return false;
    };

    try {
      let targetChannelId = existing?.channelId || null;
      let embedColor = existing?.color !== undefined ? existing?.color : null;
      let headerText = existing?.title || "";
      let bodyText = existing?.description || "";
      let imageObj = existing?.image || null;

      if (runChannel) {
        const p1 = await channel.send("👉 **Step 1:** Mention the channel where goodbye notices should be sent.");
        const col1 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const msg1 = col1.first();
        if (await checkStop(msg1, p1)) return;

        let targetChannel = msg1.mentions.channels.first();
        await msg1.delete().catch(() => {});
        await p1.delete().catch(() => {});

        if (!targetChannel) {
          const p1Retry = await channel.send("⚠️ **Invalid channel.** Attempt 2: Re-mention target channel below or type `!stop!`.");
          const col1Retry = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
          const msg1Retry = col1Retry.first();
          if (await checkStop(msg1Retry, p1Retry)) return;

          targetChannel = msg1Retry.mentions.channels.first();
          await msg1Retry.delete().catch(() => {});
          await p1Retry.delete().catch(() => {});

          if (!targetChannel) return channel.send("❌ Setup terminated.");
        }
        targetChannelId = targetChannel.id;
      }

      if (runColor) {
        const pColor = await channel.send("🎨 **Step 2:** Provide a Hex Color Code string for the sidebar strip (e.g., `#FF0000` or `00FF00`).\n*(Type `!skip!` to leave default)*");
        const colColor = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const msgColor = colColor.first();
        if (await checkStop(msgColor, pColor)) return;

        let rawColor = msgColor.content.trim().replace("#", "");
        if (rawColor.toLowerCase() !== "!skip!") {
          if (/^[0-9A-F]{6}$/i.test(rawColor)) {
            embedColor = parseInt(rawColor, 16);
          } else {
            const pColorRetry = await channel.send("⚠️ **Invalid Hex format.** Please try one more time. Send a valid hex code like `#FF0000` or type `!skip!` to use default red.");
            const colColorRetry = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
            const msgColorRetry = colColorRetry.first();
            if (await checkStop(msgColorRetry, pColorRetry)) return;

            let retryColor = msgColorRetry.content.trim().replace("#", "");
            await msgColorRetry.delete().catch(() => {});
            await pColorRetry.delete().catch(() => {});

            if (/^[0-9A-F]{6}$/i.test(retryColor)) {
              embedColor = parseInt(retryColor, 16);
            }
          }
        } else {
          embedColor = null;
        }
        await msgColor.delete().catch(() => {});
        await pColor.delete().catch(() => {});
      }

      if (runHeader) {
        const p2 = await channel.send("📝 **Step 3:** Write down text for the **Header Title**.\n*(Type `!skip!` to leave blank)*");
        const col2 = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ["time"] });
        const msg2 = col2.first();
        if (await checkStop(msg2, p2)) return;

        headerText = msg2.content.trim().toLowerCase() === "!skip!" ? "" : msg2.content.trim();
        await msg2.delete().catch(() => {});
        await p2.delete().catch(() => {});
      }

      if (runBody) {
        const p3 = await channel.send(
          "📄 **Step 4:** Enter the text for the **body section**.\n\n" +
          "💡 **Available placeholders:**\n" +
          "• `{username}` ➡️ Display username string without pinging\n" +
          "• `{mention}` ➡️ Mention/ping the user directly\n" +
          "• `{member_count}` ➡️ Numerical tracking count\n" +
          "• `{server_name}` ➡️ Display this server's name\n\n" +
          "*(Type `!skip!` to leave blank)*"
        );
        const col3 = await channel.awaitMessages({ filter, max: 1, time: 300000, errors: ["time"] });
        const msg3 = col3.first();
        if (await checkStop(msg3, p3)) return;

        bodyText = msg3.content.trim().toLowerCase() === "!skip!" ? "" : msg3.content.trim();
        await msg3.delete().catch(() => {});
        await p3.delete().catch(() => {});
      }

      if (runPicture) {
        const p4 = await channel.send("🖼️ **Step 5:** Provide an image link, file upload, or type `none` to skip.");
        const col4 = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ["time"] });
        const msg4 = col4.first();
        if (await checkStop(msg4, p4)) return;

        if (existing?.image?.logMessageId) {
          const logsConfig = welcomeManager.getConfig("hiddenlogs", guildId);
          if (logsConfig && logsConfig.channelId) {
            const logsChannel = interaction.guild.channels.cache.get(logsConfig.channelId);
            if (logsChannel) {
              await logsChannel.messages.delete(existing.image.logMessageId).catch(() => {});
            }
          }
        }

        if (msg4.attachments.size > 0) {
          const fileAttachment = msg4.attachments.first();
          const fileExt = fileAttachment.name.split('.').pop() || 'png';
          const fileName = `goodbye_card.${fileExt}`;
          let permanentUrl = fileAttachment.url;
          let newLogMessageId = null;

          const logsConfig = welcomeManager.getConfig("hiddenlogs", guildId);
          if (logsConfig && logsConfig.channelId) {
            const logsChannel = interaction.guild.channels.cache.get(logsConfig.channelId);
            if (logsChannel) {
              try {
                const logMsg = await logsChannel.send({
                  content: `🔒 **Permanent Image Storage**\nType: Goodbye Card\nSet by: ${interaction.user.tag}`,
                  files: [{ attachment: fileAttachment.url, name: fileName }]
                });
                
                if (logMsg.attachments.size > 0) {
                  permanentUrl = logMsg.attachments.first().url;
                  newLogMessageId = logMsg.id;
                }
              } catch (err) {
                console.error(err);
              }
            }
          }

          imageObj = {
            url: permanentUrl,
            local: true,
            name: fileName,
            logMessageId: newLogMessageId
          };
          
          setTimeout(() => msg4.delete().catch(() => {}), 5000);
        } else {
          const respText = msg4.content.trim();
          if (respText.toLowerCase() !== "none") {
            imageObj = {
              url: respText,
              local: false
            };
          } else {
            imageObj = null;
          }
          await msg4.delete().catch(() => {});
        }
        await p4.delete().catch(() => {});
      }

      welcomeManager.saveConfig("goodbyes", guildId, {
        channelId: targetChannelId,
        color: embedColor,
        title: headerText,
        description: bodyText,
        image: imageObj
      });

      return channel.send(`🎉 **Goodbye notifications are all set!** Directing payloads to <#${targetChannelId}>.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

    } catch (err) {
      console.error(err);
      return channel.send("❌ Wizard terminated due to an error or timing issue.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }
};