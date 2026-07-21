const fs = require("node:fs");
const path = require("node:path");

const CONFIG_CANDIDATES = ["bot.config.json", "config.json"];

function readJsonConfig() {
  for (const fileName of CONFIG_CANDIDATES) {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) continue;

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  return {};
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function getBotConfig() {
  const config = readJsonConfig();

  return {
    token: pickFirst(
      process.env.DISCORD_TOKEN,
      process.env.TOKEN,
      config.discordToken,
      config.token,
      config.botToken
    ),
    clientId: pickFirst(
      process.env.CLIENT_ID,
      process.env.APPLICATION_ID,
      process.env.APP_ID,
      config.clientId,
      config.applicationId,
      config.appId
    ),
  };
}

module.exports = { getBotConfig };
