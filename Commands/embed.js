const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, AttachmentBuilder, MessageFlags } = require("discord.js");

module.exports = {
  category: "Utilities",
  data: {
    name: "embed",
    description: "Create structured layout embeds step-by-step.",
    options: [
      {
        type: 1,
        name: "write",
        description: "Launch step-by-step wizard to build a custom embed",
        options: [
          {
            type: 5,
            name: "rules",
            description: "Is this for server rules?",
            required: false,
          }
        ]
      }
    ]
  },

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "You need moderator permissions to build embeds.", flags: [MessageFlags.Ephemeral] });
    }

    const isRules = interaction.options.getBoolean("rules") ?? false;

    await interaction.reply({ 
      content: "🛠️ **Embed Wizard Initiated.** Follow the prompts below to customize your block layout.\nYou can type `!stop!` at any step to cancel the setup process.", 
      flags: [MessageFlags.Ephemeral] 
    });

    const filter = (m) => m.author.id === interaction.user.id;
    const channel = interaction.channel;

    let embedColor = 0x8a5cff;
    let targetPostChannel = channel;
    let embedHeader = "";
    let embedBody = "";
    let embedImage = null;
    let imageAttachment = null;

    const checkStop = async (collectedMessage, promptMessage) => {
      if (collectedMessage.content.trim() === "!stop!") {
        await collectedMessage.delete().catch(() => {});
        await promptMessage.delete().catch(() => {});
        await channel.send("🛑 **Wizard Cancelled.** The embed creation process has been stopped.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        return true;
      }
      return false;
    };

    try {
      if (isRules) {
        const chanPrompt = await channel.send("👉 **Step 1:** Mention the channel where the **Rules Embed** should be posted (e.g., #rules).");
        const chanCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const chanUserMsg = chanCollected.first();

        if (await checkStop(chanUserMsg, chanPrompt)) return;

        let mentionedChan = chanUserMsg.mentions.channels.first();
        await chanUserMsg.delete().catch(() => {});
        await chanPrompt.delete().catch(() => {});

        if (mentionedChan) {
          targetPostChannel = mentionedChan;
        } else {
          const retryChanPrompt = await channel.send("⚠️ **Invalid channel.** Please try one more time. Mention a valid text channel (e.g., #rules) or type `!stop!` to cancel.");
          const retryChanCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
          const retryChanUserMsg = retryChanCollected.first();

          if (await checkStop(retryChanUserMsg, retryChanPrompt)) return;

          mentionedChan = retryChanUserMsg.mentions.channels.first();
          await retryChanUserMsg.delete().catch(() => {});
          await retryChanPrompt.delete().catch(() => {});

          if (mentionedChan) {
            targetPostChannel = mentionedChan;
          } else {
            await channel.send("⚠️ Second attempt failed. Defaulting rules deployment to this current thread.").then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
          }
        }
      } else {
        const routeMsg = await channel.send("👉 **Step 1:** Send the embed to a different channel? Respond with `yes` or `no`.");
        const routeCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const routeUserMsg = routeCollected.first();
        
        if (await checkStop(routeUserMsg, routeMsg)) return;

        const routeAns = routeUserMsg.content.trim().toLowerCase();
        await routeUserMsg.delete().catch(() => {});
        await routeMsg.delete().catch(() => {});

        if (routeAns === "yes") {
          const chanPrompt = await channel.send("👉 **Step 1.2:** Mention the target channel now (e.g., #announcements).");
          const chanCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
          const chanUserMsg = chanCollected.first();

          if (await checkStop(chanUserMsg, chanPrompt)) return;

          let mentionedChan = chanUserMsg.mentions.channels.first();
          await chanUserMsg.delete().catch(() => {});
          await chanPrompt.delete().catch(() => {});

          if (mentionedChan) {
            targetPostChannel = mentionedChan;
          } else {
            const retryChanPrompt = await channel.send("⚠️ **Invalid channel.** Please try one more time. Mention a valid text channel (e.g., #announcements) or type `!stop!` to cancel.");
            const retryChanCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
            const retryChanUserMsg = retryChanCollected.first();

            if (await checkStop(retryChanUserMsg, retryChanPrompt)) return;

            mentionedChan = retryChanUserMsg.mentions.channels.first();
            await retryChanUserMsg.delete().catch(() => {});
            await retryChanPrompt.delete().catch(() => {});

            if (mentionedChan) {
              targetPostChannel = mentionedChan;
            } else {
              await channel.send("⚠️ Second attempt failed. Defaulting to this current thread.").then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
            }
          }
        }
      }

      const colorMsg = await channel.send("🎨 **Step 2:** Provide a Hex Color Code string for the sidebar strip (e.g., `#FF0000` or `00FF00`).");
      const colorCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
      const colorUserMsg = colorCollected.first();

      if (await checkStop(colorUserMsg, colorMsg)) return;

      let rawColor = colorUserMsg.content.trim().replace("#", "");
      await colorUserMsg.delete().catch(() => {});
      await colorMsg.delete().catch(() => {});

      if (/^[0-9A-F]{6}$/i.test(rawColor)) {
        embedColor = parseInt(rawColor, 16);
      } else {
        const retryMsg = await channel.send("⚠️ **Invalid Hex format.** Please try one more time. Send a valid hex code like `#FF0000` or typing `!stop!` to cancel.");
        const retryCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const retryUserMsg = retryCollected.first();

        if (await checkStop(retryUserMsg, retryMsg)) return;

        let retryColor = retryUserMsg.content.trim().replace("#", "");
        await retryUserMsg.delete().catch(() => {});
        await retryMsg.delete().catch(() => {});

        if (/^[0-9A-F]{6}$/i.test(retryColor)) {
          embedColor = parseInt(retryColor, 16);
        } else {
          await channel.send("⚠️ Second attempt failed. Defaulting to standard purple color.").then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }
      }

      const headMsg = await channel.send("📝 **Step 3:** Send the precise text context for the **Header Title**.\n*(If you want to skip this step, type `!skip!`)*");
      const headCollected = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ["time"] });
      const headUserMsg = headCollected.first();

      if (await checkStop(headUserMsg, headMsg)) return;

      const headInput = headUserMsg.content.trim();
      embedHeader = headInput.toLowerCase() === "!skip!" ? "" : headInput;
      await headUserMsg.delete().catch(() => {});
      await headMsg.delete().catch(() => {});

      const bodyMsg = await channel.send("📄 **Step 4:** Send the main **Body Content** text layout (supports markdown styling and new lines).\n*(If you want to skip this step, type `!skip!`)*");
      const bodyCollected = await channel.awaitMessages({ filter, max: 1, time: 300000, errors: ["time"] });
      const bodyUserMsg = bodyCollected.first();

      if (await checkStop(bodyUserMsg, bodyMsg)) return;

      const bodyInput = bodyUserMsg.content.trim();
      embedBody = bodyInput.toLowerCase() === "!skip!" ? "" : bodyInput;
      await bodyUserMsg.delete().catch(() => {});
      await bodyMsg.delete().catch(() => {});

      const imgMsg = await channel.send("🖼️ **Step 5:** Send an image for this embed. You can upload a picture file directly, paste an image URL link, or type `none` to skip.");
      const imgCollected = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ["time"] });
      const imgUserMsg = imgCollected.first();

      if (await checkStop(imgUserMsg, imgMsg)) return;

      if (imgUserMsg.attachments.size > 0) {
        const firstAttachment = imgUserMsg.attachments.first();
        const fileExt = firstAttachment.name.split('.').pop() || 'png';
        const safeName = `display_image.${fileExt}`;
        
        imageAttachment = new AttachmentBuilder(firstAttachment.url, { name: safeName });
        embedImage = `attachment://${safeName}`;
      } else {
        const responseText = imgUserMsg.content.trim();
        if (responseText.toLowerCase() !== "none") {
          embedImage = responseText;
        }
      }

      await imgMsg.delete().catch(() => {});

      const finishedEmbed = new EmbedBuilder()
        .setColor(embedColor);

      if (embedHeader) finishedEmbed.setTitle(embedHeader);
      if (embedBody) finishedEmbed.setDescription(embedBody);
      if (embedImage) finishedEmbed.setImage(embedImage);

      if (!embedHeader && !embedBody && !embedImage) {
        if (imgUserMsg) await imgUserMsg.delete().catch(() => {});
        return channel.send("❌ **Error:** You cannot build a completely empty embed layout configuration! Creation cancelled.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      }

      const sendPayload = { embeds: [finishedEmbed] };

      if (imageAttachment) {
        sendPayload.files = [imageAttachment];
      }

      if (isRules) {
        const verifyButtonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("verify_rules_button")
            .setLabel("I Accept the Rules")
            .setStyle(ButtonStyle.Success)
        );
        sendPayload.components = [verifyButtonRow];

        let verifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === "verified");
        if (!verifiedRole) {
          verifiedRole = await interaction.guild.roles.create({
            name: "Verified",
            reason: "Auto-created role for server rules verification."
          }).catch(() => null);
        }

        if (verifiedRole) {
          await targetPostChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            ViewChannel: true
          }).catch(() => {});

          await targetPostChannel.permissionOverwrites.edit(verifiedRole, {
            ViewChannel: true
          }).catch(() => {});
        }
      }

      await targetPostChannel.send(sendPayload);
      if (imgUserMsg) await imgUserMsg.delete().catch(() => {});
      await channel.send(`✅ Embed successfully dispatched to ${targetPostChannel}!`).then(m => setTimeout(() => m.delete().catch(() => {}), 4000));

    } catch (err) {
      console.error(err);
      await channel.send("❌ Wizard expired due to inactivity or internal fault.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }
};