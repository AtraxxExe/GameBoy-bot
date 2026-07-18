const voiceSessions = new Map();
const levelManager = require("../levelManager.js");

module.exports = (client) => {
  client.guilds.cache.forEach(guild => {
    guild.voiceStates.cache.forEach(state => {
      if (state.channelId && !voiceSessions.has(state.id)) {
        voiceSessions.set(state.id, Date.now());
      }
    });
  });

  client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;

  if (oldState.channelId && !newState.channelId) {
    const startTime = voiceSessions.get(userId);
    if (startTime) {
      const duration = Date.now() - startTime;
      levelManager.addVoiceTime(newState.guild.id, userId, duration);
      voiceSessions.delete(userId);
    }
  }
  else if (newState.channelId && oldState.channelId !== newState.channelId) {
    const startTime = voiceSessions.get(userId);
    if (startTime) {
      const duration = Date.now() - startTime;
      levelManager.addVoiceTime(newState.guild.id, userId, duration);
    }
    voiceSessions.set(userId, Date.now());
  }
});
};