module.exports = {
  category: "Other",
  data: {
    name: "coinflip",
    description: "Flip a coin and see which side you get.",
  },
  async execute(interaction) {
    const sides = ["Heads", "Tails"];
    const result = sides[Math.floor(Math.random() * sides.length)];

    await interaction.reply(`🪙 You flipped: **${result}**`);
  },
};
