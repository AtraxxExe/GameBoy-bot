require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const { getBotConfig } = require("./botConfig.js");

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  commands.push(typeof command.data?.toJSON === "function" ? command.data.toJSON() : command.data);
}

const { token, clientId } = getBotConfig();

if (!token || !clientId) {
  console.error("❌ Missing bot token or client ID. Set DISCORD_TOKEN / CLIENT_ID in your environment or create bot.config.json / config.json with discordToken and clientId values.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: commands }
  );
  console.log("✅ Registered slash commands.");
})();