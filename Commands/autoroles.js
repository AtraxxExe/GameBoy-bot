const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
  category: "Utilities",
  data: {
    name: "autoroles",
    description: "Launch step-by-step configuration setup for reaction roles",
  },

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "You need moderator permissions to launch role configs.", flags: [MessageFlags.Ephemeral] });
    }

    await interaction.reply({ 
      content: "🛠️ I’ve started the role setup. Follow the prompts and type `!stop!` at any time to cancel.", 
      flags: [MessageFlags.Ephemeral] 
    });

    const filter = (m) => m.author.id === interaction.user.id;
    const channel = interaction.channel;

    let targetPostChannel = channel;
    let embedColor = 0xd6aded;
    let embedHeader = "";
    const activeMappings = [];

    const checkStop = async (collectedMessage, promptMessage) => {
      if (collectedMessage.content.trim() === "!stop!") {
        await collectedMessage.delete().catch(() => {});
        await promptMessage.delete().catch(() => {});
        await channel.send("🛑 Setup cancelled.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        return true;
      }
      return false;
    };

    try {
      const chanPrompt = await channel.send("👉 Step 1: Tell me which channel should show the role card.");
      const chanCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
      const chanUserMsg = chanCollected.first();

      if (await checkStop(chanUserMsg, chanPrompt)) return;

      let mentionedChan = chanUserMsg.mentions.channels.first();
      await chanUserMsg.delete().catch(() => {});
      await chanPrompt.delete().catch(() => {});

      if (mentionedChan) {
        targetPostChannel = mentionedChan;
      } else {
        const retryChanPrompt = await channel.send("⚠️ I couldn’t read that channel. Please try again or type `!stop!` to cancel.");
        const retryChanCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const retryChanUserMsg = retryChanCollected.first();

        if (await checkStop(retryChanUserMsg, retryChanPrompt)) return;

        mentionedChan = retryChanUserMsg.mentions.channels.first();
        await retryChanUserMsg.delete().catch(() => {});
        await retryChanPrompt.delete().catch(() => {});

        if (mentionedChan) {
          targetPostChannel = mentionedChan;
        } else {
          await channel.send("⚠️ Second attempt failed. Defaulting deployment to this current thread.").then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }
      }

      const colorMsg = await channel.send("🎨 **Step 2:** Provide a Hex Color Code string for the sidebar design accent (e.g., `#FF0000` or `00FF00`).");
      const colorCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
      const colorUserMsg = colorCollected.first();

      if (await checkStop(colorUserMsg, colorMsg)) return;

      let rawColor = colorUserMsg.content.trim().replace("#", "");
      await colorUserMsg.delete().catch(() => {});
      await colorMsg.delete().catch(() => {});

      if (/^[0-9A-F]{6}$/i.test(rawColor)) {
        embedColor = parseInt(rawColor, 16);
      } else {
        const retryMsg = await channel.send("⚠️ That color code wasn’t valid. Please try again or type `!stop!` to cancel.");
        const retryCollected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const retryUserMsg = retryCollected.first();

        if (await checkStop(retryUserMsg, retryMsg)) return;

        let retryColor = retryUserMsg.content.trim().replace("#", "");
        await retryUserMsg.delete().catch(() => {});
        await retryMsg.delete().catch(() => {});

        if (/^[0-9A-F]{6}$/i.test(retryColor)) {
          embedColor = parseInt(retryColor, 16);
        } else {
          await channel.send("⚠️ Second attempt failed. Defaulting to standard purple design.").then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }
      }

      const headMsg = await channel.send("📝 **Step 3:** Send the precise text layout for the **Header Title**.");
      const headCollected = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ["time"] });
      const headUserMsg = headCollected.first();

      if (await checkStop(headUserMsg, headMsg)) return;

      embedHeader = headUserMsg.content.trim();
      await headUserMsg.delete().catch(() => {});
      await headMsg.delete().catch(() => {});

      const loopInstructionMsg = await channel.send(
        "✨ Step 4: Send each emoji, role name, and color one at a time.\n" +
        "Format: `:emoji: Role Name #hex` (Example: `⭐ Member #FFD700`)\n" +
        "When you are finished adding all roles, simply type **`done`**."
      );

      let collectingRoles = true;

      while (collectingRoles) {
        const entryCollected = await channel.awaitMessages({ filter, max: 1, time: 300000, errors: ["time"] });
        const entryUserMsg = entryCollected.first();
        const rawContent = entryUserMsg.content.trim();

        if (rawContent.toLowerCase() === "!stop!") {
          await entryUserMsg.delete().catch(() => {});
          await loopInstructionMsg.delete().catch(() => {});
          await channel.send("🛑 Setup cancelled.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
          return;
        }

        if (rawContent.toLowerCase() === "done") {
          await entryUserMsg.delete().catch(() => {});
          break;
        }

        const matchPattern = rawContent.match(/^(\S+)\s+(.+?)(?:\s+#([0-9A-Fa-f]{6}))?$/);

        if (!matchPattern) {
          const warnMsg = await channel.send("⚠️ I didn’t understand that entry. Use this format: `:emoji: Role Name` or `:emoji: Role Name #hex`.");
          await entryUserMsg.delete().catch(() => {});
          setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
          continue;
        }

        const cleanEmoji = matchPattern[1].trim();
        const cleanRoleName = matchPattern[2].trim();
        const roleHexColor = matchPattern[3] ? matchPattern[3].trim() : null;

        const emojiExists = activeMappings.some(m => m.emoji === cleanEmoji);
        const roleExists = activeMappings.some(m => m.roleName.toLowerCase() === cleanRoleName.toLowerCase());

        if (emojiExists) {
          const warnMsg = await channel.send("⚠️ That emoji is already assigned. Emojis cannot repeat.");
          await entryUserMsg.delete().catch(() => {});
          setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
          continue;
        }

        if (roleExists) {
          const warnMsg = await channel.send("⚠️ That role name has already been registered in this wizard session.");
          await entryUserMsg.delete().catch(() => {});
          setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
          continue;
        }

        let guildRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === cleanRoleName.toLowerCase());
        
        if (!guildRole) {
          try {
            guildRole = await interaction.guild.roles.create({
              name: cleanRoleName,
              color: roleHexColor ? parseInt(roleHexColor, 16) : 0,
              reason: `Automatically created via GameBoy /autoroles wizard setup.`
            });
          } catch (err) {
            const warnMsg = await channel.send("❌ I couldn’t create that role. Please make sure I can manage roles.");
            await entryUserMsg.delete().catch(() => {});
            setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
            continue;
          }
        } else if (roleHexColor) {
          try {
            await guildRole.setColor(parseInt(roleHexColor, 16));
          } catch (err) {
            console.error("Failed to update pre-existing role color:", err);
          }
        }

        activeMappings.push({ emoji: cleanEmoji, roleName: guildRole.name });
        const confirmMsg = await channel.send(`✅ **Registered & Created auto role:** ${cleanEmoji} — **${guildRole.name}** ${roleHexColor ? `(Color: #${roleHexColor})` : ""}`);
        await entryUserMsg.delete().catch(() => {});
        setTimeout(() => confirmMsg.delete().catch(() => {}), 4000);
      }

      await loopInstructionMsg.delete().catch(() => {});

      if (activeMappings.length === 0) {
        return channel.send("⚠️ No valid role configuration items were submitted. Wizard closing down.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      }

      let descriptionLayout = "";
      activeMappings.forEach((mapping) => {
        descriptionLayout += `${mapping.emoji} — ${mapping.roleName}\n`;
      });

      const roleEmbedCard = new EmbedBuilder()
        .setTitle(embedHeader)
        .setDescription(descriptionLayout)
        .setColor(embedColor)
        .setFooter({ text: "GameBoy Autoroles" })
        .setTimestamp();

      const deployedMessage = await targetPostChannel.send({ embeds: [roleEmbedCard] });

      for (const mapping of activeMappings) {
        try {
          if (mapping.emoji.startsWith("<") && mapping.emoji.endsWith(">")) {
            const customEmojiId = mapping.emoji.match(/:(\d+)>$/)[1];
            await deployedMessage.react(customEmojiId);
          } else {
            await deployedMessage.react(mapping.emoji);
          }
        } catch (reactErr) {
          console.error(`Could not pre-react with emoji ${mapping.emoji}:`, reactErr);
        }
      }

      await channel.send(`🎉 All set. The role card is now live in ${targetPostChannel}.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

    } catch (err) {
      console.error(err);
      await channel.send("❌ The setup timed out. Please try again.").then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }
};