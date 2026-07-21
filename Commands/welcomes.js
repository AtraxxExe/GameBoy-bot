const fs = require("node:fs");
const path = require("node:path");
const { SlashCommandBuilder, PermissionsBitField, MessageFlags, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const welcomeManager = require("../welcomeManager.js");

module.exports = {
  category: "Utilities",
  data: new SlashCommandBuilder()
    .setName("welcomes")
    .setDescription("Configure welcome greeting modules for incoming members.")
    .addSubcommand(sub => sub.setName("set").setDescription("Launch wizard to set up welcome embeds."))
    .addSubcommand(sub => 
      sub.setName("modify")
        .setDescription("Modify specific properties of your active welcome card.")
        .addBooleanOption(opt => opt.setName("channel").setDescription("Modify the target channel?"))
        .addBooleanOption(opt => opt.setName("color").setDescription("Modify the sidebar color?"))
        .addBooleanOption(opt => opt.setName("header").setDescription("Modify the header title?"))
        .addBooleanOption(opt => opt.setName("body").setDescription("Modify the body text?"))
        .addBooleanOption(opt => opt.setName("picture").setDescription("Modify the embed picture?"))
    )
    .addSubcommand(sub => sub.setName("remove").setDescription("Permanently delete existing welcome card."))
    .addSubcommand(sub => sub.setName("test").setDescription("Test your active welcome configuration right now.")),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Administrator authorization required.", flags: [MessageFlags.Ephemeral] });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const existing = welcomeManager.getConfig("welcomes", guildId);

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

      welcomeManager.removeConfig("welcomes", guildId);
      return interaction.reply({ content: "🗑️ Welcomes deleted.", flags: [MessageFlags.Ephemeral] });
    }

    if (sub === "test") {
      if (!existing) {
        return interaction.reply({ content: "⚠️ No welcome configuration found to test! Run `/welcomes set` first.", flags: [MessageFlags.Ephemeral] });
      }

      const welcomeChannel = interaction.guild.channels.cache.get(existing.channelId);
      if (!welcomeChannel) {
        return interaction.reply({ content: "❌ The configured welcome channel could not be found.", flags: [MessageFlags.Ephemeral] });
      }

      const embed = new EmbedBuilder()
        .setColor(existing.color !== null && existing.color !== undefined ? existing.color : 0xd6aded)
        .setTimestamp();

      if (existing.title) embed.setTitle(welcomeManager.parsePlaceholders(existing.title, interaction.member));
      if (existing.description) embed.setDescription(welcomeManager.parsePlaceholders(existing.description, interaction.member));

      const payload = { embeds: [embed] };

      if (existing.image) {
        if (existing.image.local) {
          if (existing.image.filePath && fs.existsSync(existing.image.filePath)) {
            const imgAttachment = new AttachmentBuilder(existing.image.filePath, { name: existing.image.name });
            embed.setImage(`attachment://${existing.image.name}`);
            payload.files = [imgAttachment];
          } else if (existing.image.url) {
            embed.setImage(existing.image.url);
          }
        } else if (existing.image.url) {
          embed.setImage(existing.image.url);
        }
      }

      await welcomeChannel.send(payload).catch(err => console.error(err));
      return interaction.reply({ content: `✅ Sent a welcome simulation card to <#${welcomeChannel.id}>!`, flags: [MessageFlags.Ephemeral] });
    }

    let runChannel = true, runColor = true, runHeader = true, runBody = true, runPicture = true;

    if (sub === "modify") {
      if (!existing) {
        return interaction.reply({ content: "⚠️ No existing configurations were found. Run `/welcomes set` first.", flags: [MessageFlags.Ephemeral] });
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
      return interaction.reply({ content: "⚠️ Welcome infrastructure is already configured! Use `/welcomes modify` or `/welcomes remove`.", flags: [MessageFlags.Ephemeral] });
    }

    await interaction.reply({ 
      content: `🛠️ **Welcome Embeds Wizard Active.** Type \`!stop!\` at any point to terminate.`, 
      flags: [MessageFlags.Ephemeral] 
    });

    const filter = (m) => m.author.id === interaction.user.id;
    const channel = interaction.channel;

    const checkStop = async (userMsg, promptMsg) => {
      if (userMsg.content.trim() === "!stop!") {
        await userMsg.delete().catch(() => {});
        await promptMsg.delete().catch(() => {});
        await channel.send("🛑 **Wizard Cancelled.** Configuration process halted.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
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
        const p1 = await channel.send("👉 **Step 1:** Mention the channel where welcome greetings should be routed (e.g., #welcomes).");
        const col1 = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const msg1 = col1.first();
        if (await checkStop(msg1, p1)) return;

        let targetChannel = msg1.mentions.channels.first();
        await msg1.delete().catch(() => {});
        await p1.delete().catch(() => {});

        if (!targetChannel) {
          const p1Retry = await channel.send("⚠️ **Invalid text channel mention.** Attempt 2: Please try again or type `!stop!` to kill the wizard.");
          const col1Retry = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
          const msg1Retry = col1Retry.first();
          if (await checkStop(msg1Retry, p1Retry)) return;

          targetChannel = msg1Retry.mentions.channels.first();
          await msg1Retry.delete().catch(() => {});
          await p1Retry.delete().catch(() => {});

          if (!targetChannel) return channel.send("❌ Setup cancelled due to invalid channel designation inputs.");
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
            const pColorRetry = await channel.send("⚠️ **Invalid Hex format.** Please try one more time. Send a valid hex code like `#FF0000` or type `!skip!` to use default purple.");
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
        const p2 = await channel.send("📝 **Step 3:** Write down text for the **Header Title**.\n*(Type `!skip!` to leave it blank)*");
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
        const p4 = await channel.send("🖼️ **Step 5:** Adding an image asset. Paste an image URL, upload a picture directly, or type `none` to skip.");
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
          const fileName = `welcome_card.${fileExt}`;
          const assetsDir = path.join(__dirname, "..", "assets", "welcome_images");
          fs.mkdirSync(assetsDir, { recursive: true });
          const localFilePath = path.join(assetsDir, `${guildId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`);
          let permanentUrl = fileAttachment.url;
          let newLogMessageId = null;

          const logsConfig = welcomeManager.getConfig("hiddenlogs", guildId);
          if (logsConfig && logsConfig.channelId) {
            const logsChannel = interaction.guild.channels.cache.get(logsConfig.channelId);
            if (logsChannel) {
              try {
                const response = await fetch(fileAttachment.url);
                if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
                const buffer = Buffer.from(await response.arrayBuffer());
                fs.writeFileSync(localFilePath, buffer);

                const logMsg = await logsChannel.send({
                  content: `🔒 **Permanent Image Storage**\nType: Welcome Card\nSet by: ${interaction.user.tag}`,
                  files: [{ attachment: buffer, name: fileName }]
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
            filePath: localFilePath,
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

      welcomeManager.saveConfig("welcomes", guildId, {
        channelId: targetChannelId,
        color: embedColor,
        title: headerText,
        description: bodyText,
        image: imageObj
      });

      return channel.send(`🎉 **Welcome layouts synced successfully!** Cards will ship directly to <#${targetChannelId}>.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

    } catch (err) {
      console.error(err);
      return channel.send("❌ Wizard expired due to inactivity or internal fault.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }
};