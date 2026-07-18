const { createCanvas, loadImage } = require("canvas");
const levelManager = require("./levelManager.js");

module.exports = {
  async generateCard(targetUser, stats, reqMessages) {
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#12141c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    bgGradient.addColorStop(0, "#1a1c29");
    bgGradient.addColorStop(1, "#12141c");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.fillStyle = "#d6aded";
    ctx.fillRect(10, 10, 6, canvas.height - 20);

    const avatarSize = 130;
    const avatarX = 50;
    const avatarY = (canvas.height - avatarSize) / 2;

    let avatarImg;
    try {
      avatarImg = await loadImage(targetUser.displayAvatarURL({ extension: "png", size: 256 }));
    } catch {
      avatarImg = await loadImage("https://discord.com/assets/f9bb36ef302c5353ebc9.png");
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    ctx.strokeStyle = "rgba(138, 92, 255, 0.4)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2, true);
    ctx.stroke();

    const textStartX = avatarX + avatarSize + 40;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(targetUser.displayName, textStartX, 120);

    ctx.fillStyle = "#d6aded";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`LEVEL ${stats.level}`, textStartX, 155);

    const currentLevelBase = stats.level === 0 ? 0 : levelManager.getRequiredForLevel(stats.level - 1);
    const levelProgress = stats.messages - currentLevelBase;
    const levelNeeded = reqMessages - currentLevelBase;
    const progressPercent = Math.min(Math.max(levelProgress / levelNeeded, 0), 1);

    ctx.fillStyle = "#a0a5bc";
    ctx.font = "18px sans-serif";

    const progressString = `${levelProgress} / ${levelNeeded} msgs to level ${stats.level + 1}`;
    
    ctx.fillText(progressString, canvas.width - ctx.measureText(progressString).width - 40, 155);

    const barX = textStartX;
    const barY = 170;
    const barWidth = canvas.width - barX - 40;
    const barHeight = 22;
    const radius = 11;

    ctx.fillStyle = "#252836";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, radius);
    ctx.fill();

    const activeFillWidth = barWidth * progressPercent;

    if (activeFillWidth > 0) {
      const progressGradient = ctx.createLinearGradient(barX, 0, barX + activeFillWidth, 0);
      progressGradient.addColorStop(0, "#b988e9");
      progressGradient.addColorStop(1, "#d6aded");

      ctx.fillStyle = progressGradient;
      ctx.beginPath();
      ctx.roundRect(barX, barY, activeFillWidth, barHeight, radius);
      ctx.fill();
    }

    return canvas.toBuffer("image/png");
  }
};