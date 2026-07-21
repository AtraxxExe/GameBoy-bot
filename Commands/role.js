const { PermissionsBitField, EmbedBuilder, MessageFlags, SlashCommandBuilder } = require("discord.js");

module.exports = {
  category: "Utilities",
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Server role management utility tools")

    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Create a new server role")
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("The name of the role you want to create")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("color")
            .setDescription("Optional Hex Color code for the role (e.g., #FF0000)")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("delete")
        .setDescription("Delete an existing server role")
        .addRoleOption(option =>
          option
            .setName("target_role")
            .setDescription("Select the server role to permanently delete")
            .setRequired(true)
        )
        .addBooleanOption(option =>
          option
            .setName("confirm")
            .setDescription("Set to true to confirm the permanent deletion of this role")
            .setRequired(true)
        )
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName("update")
        .setDescription("Update an existing server role's settings")
        .addRoleOption(option =>
          option
            .setName("target_role")
            .setDescription("Select the role you want to update")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("updatename")
            .setDescription("Provide a new name for this role")
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName("updatecolor")
            .setDescription("Provide a new Hex Color code for this role (e.g., #00FF00)")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("give")
        .setDescription("Assign a server role to a user")
        .addRoleOption(option =>
          option
            .setName("name")
            .setDescription("Select the role to give")
            .setRequired(true)
        )
        .addUserOption(option =>
          option
            .setName("receiver")
            .setDescription("Select the person who should receive this role")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("take")
        .setDescription("Remove a server role from a user")
        .addRoleOption(option =>
          option
            .setName("name")
            .setDescription("Select the role to take away")
            .setRequired(true)
        )
        .addUserOption(option =>
          option
            .setName("target_user")
            .setDescription("Select the person to remove the role from")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ 
        content: "❌ You need moderator permissions to use role utility actions.", 
        flags: [MessageFlags.Ephemeral] 
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    const parseHex = (hexString) => {
      if (!hexString) return null;
      const cleanHex = hexString.trim().replace("#", "");
      if (/^[0-9A-Fa-f]{6}$/i.test(cleanHex)) {
        return parseInt(cleanHex, 16);
      }
      return -1;
    };

    if (subcommand === "create") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const name = interaction.options.getString("name").trim();
      const rawColor = interaction.options.getString("color");
      
      const parsedColor = parseHex(rawColor);
      if (parsedColor === -1) {
        return interaction.editReply({ content: "⚠️ **Invalid Hex format.** Please provide a valid code like `#FF0000`." });
      }

      try {
        const newRole = await guild.roles.create({
          name: name,
          color: parsedColor || 0,
          reason: `Created via GameBoy /role create by ${interaction.user.tag}`
        });

        return interaction.editReply({
          content: `✅ Successfully created the role **${newRole.name}**! ${rawColor ? `(Color applied: \`${rawColor}\`)` : ""}`
        });
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: "❌ **Failed to create role.** Ensure GameBoy has the `Manage Roles` permission." });
      }
    }

    if (subcommand === "delete") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const targetRole = interaction.options.getRole("target_role");
      const confirm = interaction.options.getBoolean("confirm");

      if (!confirm) {
        return interaction.editReply({ content: "🛑 **Action Cancelled.** You must select `true` in the confirmation box to delete a role." });
      }

      if (targetRole.id === guild.id || targetRole.managed) {
        return interaction.editReply({ content: "❌ I do not have permission to delete this role." });
      }

      try {
        const deletedName = targetRole.name;
        await targetRole.delete(`Deleted via GameBoy /role delete by ${interaction.user.tag}`);
        return interaction.editReply({ content: `**Role Removed:** The role \`${deletedName}\` has been permanently deleted.` });
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: "❌ **Failed to delete role.** Check that the role isn't placed higher than GameBoy's highest role in server settings hierarchy." });
      }
    }

    if (subcommand === "update") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const targetRole = interaction.options.getRole("target_role");
      const updateName = interaction.options.getString("updatename")?.trim();
      const updateColorRaw = interaction.options.getString("updatecolor");

      if (targetRole.id === guild.id || targetRole.managed) {
        return interaction.editReply({ content: "❌ I do not have permission to update this role." });
      }

      if (!updateName && !updateColorRaw) {
        return interaction.editReply({ content: "⚠️ You didn't provide any new attributes to change! Provide a value for `updatename` or `updatecolor`." });
      }

      const updateData = {};
      let changesString = [];

      if (updateName) {
        updateData.name = updateName;
        changesString.push(`Name changed to **${updateName}**`);
      }

      if (updateColorRaw) {
        const parsedColor = parseHex(updateColorRaw);
        if (parsedColor === -1) {
          return interaction.editReply({ content: "⚠️ **Invalid Hex format.** Please provide a valid color structure like `#00FF00`." });
        }
        updateData.color = parsedColor;
        changesString.push(`Color changed to **${updateColorRaw}**`);
      }

      try {
        await targetRole.edit(updateData, `Updated via GameBoy /role update by ${interaction.user.tag}`);
        return interaction.editReply({ content: `**Role Updated (${targetRole.name}):**\n* ${changesString.join("\n* ")}` });
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: "❌ **Failed to modify role.** Verify GameBoy's placement position inside the server hierarchy configurations." });
      }
    }

    if (subcommand === "give") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const roleToGive = interaction.options.getRole("name");
      const targetUser = interaction.options.getMember("receiver");

      if (!targetUser) {
        return interaction.editReply({ content: "❌ Could not track down that target user in this server thread." });
      }

      if (roleToGive.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.editReply({ content: "🛑 **Security Block:** You cannot assign roles that carry full **Administrator** permissions via this command." });
      }

      if (targetUser.roles.cache.has(roleToGive.id)) {
        return interaction.editReply({ content: `⚠️ **${targetUser.user.tag}** already has the **${roleToGive.name}** role assigned.` });
      }

      try {
        await targetUser.roles.add(roleToGive, `Assigned via GameBoy /role give by ${interaction.user.tag}`);
        return interaction.editReply({ content: `🎉 Success! Assigned the role **${roleToGive.name}** to **${targetUser.user.tag}**.` });
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: "❌ **Failed to assign role.** Verify that GameBoy's custom tracking integration role sits *above* the target role in server settings!" });
      }
    }

    if (subcommand === "take") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const roleToTake = interaction.options.getRole("name");
      const targetUser = interaction.options.getMember("target_user");

      if (!targetUser) {
        return interaction.editReply({ content: "❌ Could not track down that target user in this server thread." });
      }

      if (roleToTake.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.editReply({ content: "🛑 **Security Block:** You cannot remove roles that carry full **Administrator** permissions via this command." });
      }

      if (!targetUser.roles.cache.has(roleToTake.id)) {
        return interaction.editReply({ content: `⚠️ **${targetUser.user.tag}** doesn't have the **${roleToTake.name}** role.` });
      }

      try {
        await targetUser.roles.remove(roleToTake, `Removed via GameBoy /role take by ${interaction.user.tag}`);
        return interaction.editReply({ content: `Success! Removed the role **${roleToTake.name}** from **${targetUser.user.tag}**.` });
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: "❌ **Failed to remove role.** Verify that GameBoy's integration role sits *above* the target role in your server's role list hierarchy!" });
      }
    }
  }
};