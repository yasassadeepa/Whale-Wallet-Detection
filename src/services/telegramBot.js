const TelegramBot = require("node-telegram-bot-api");
const { Wallet, Transaction } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

let bot;

function startBot() {
  // Replace 'YOUR_TELEGRAM_BOT_TOKEN' with your actual bot token
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  // Start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "Welcome to the DEX Whale Wallet Detector Bot! Use /help to see available commands."
    );
  });

  // Help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
Available commands:
/start - Start the bot
/help - Show this help message
/dexwhales - List top DEX whale wallets
/stats - Show general statistics
/recentactivity - Show recent DEX whale activity
/search <address> - Search for a specific wallet
  `;
    bot.sendMessage(chatId, helpMessage);
  });

  // DEX Whales command
  bot.onText(/\/dexwhales/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const whales = await Wallet.findAll({
        where: {
          isWhale: true,
          dexActivityCount: { [Op.gte]: 5 },
        },
        order: [["balance", "DESC"]],
        limit: 10,
      });

      let message = "Top 10 DEX Whale Wallets:\n\n";
      whales.forEach((whale, index) => {
        message += `${index + 1}. Address: ${
          whale.address
        }\n   Balance: ${whale.balance.toFixed(2)} SOL\n   DEX Activities: ${
          whale.dexActivityCount
        }\n\n`;
      });

      bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error("Error fetching DEX whale data:", error);
      bot.sendMessage(
        chatId,
        "Sorry, there was an error fetching DEX whale data."
      );
    }
  });

  // Stats command
  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const totalWallets = await Wallet.count();
      const whaleWallets = await Wallet.count({
        where: { isWhale: true, dexActivityCount: { [Op.gte]: 5 } },
      });
      const totalTransactions = await Transaction.count();
      const latestTransaction = await Transaction.findOne({
        order: [["timestamp", "DESC"]],
      });

      const message = `
DEX Whale Wallet Statistics:
Total Wallets Tracked: ${totalWallets}
DEX Whale Wallets: ${whaleWallets}
Total Transactions Processed: ${totalTransactions}
Latest Transaction: ${
        latestTransaction
          ? new Date(latestTransaction.timestamp).toISOString()
          : "N/A"
      }
    `;

      bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error("Error fetching stats:", error);
      bot.sendMessage(chatId, "Sorry, there was an error fetching statistics.");
    }
  });

  // Recent Activity command
  bot.onText(/\/recentactivity/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const recentTransactions = await Transaction.findAll({
        include: [
          {
            model: Wallet,
            as: "fromWallet",
            where: { isWhale: true, dexActivityCount: { [Op.gte]: 5 } },
          },
        ],
        order: [["timestamp", "DESC"]],
        limit: 5,
      });

      let message = "Recent DEX Whale Activity:\n\n";
      for (const tx of recentTransactions) {
        message += `Whale: ${tx.fromWallet.address}\n`;
        message += `Amount: ${tx.amount.toFixed(2)} SOL\n`;
        message += `Timestamp: ${new Date(tx.timestamp).toISOString()}\n\n`;
      }

      bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error("Error fetching recent activity:", error);
      bot.sendMessage(
        chatId,
        "Sorry, there was an error fetching recent activity."
      );
    }
  });

  // Search command
  bot.onText(/\/search (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const address = match[1];
    try {
      const wallet = await Wallet.findByPk(address);

      if (wallet) {
        const message = `
Wallet Information:
Address: ${wallet.address}
Balance: ${wallet.balance.toFixed(2)} SOL
DEX Activities: ${wallet.dexActivityCount}
Is Whale: ${wallet.isWhale ? "Yes" : "No"}
Last Activity: ${new Date(wallet.lastActivity).toISOString()}
      `;
        bot.sendMessage(chatId, message);
      } else {
        bot.sendMessage(chatId, "Wallet not found or not tracked.");
      }
    } catch (error) {
      logger.error("Error searching for wallet:", error);
      bot.sendMessage(
        chatId,
        "Sorry, there was an error searching for the wallet."
      );
    }
  });

  // Error handling
  bot.on("polling_error", (error) => {
    logger.error("Telegram Bot polling error:", error);
  });

  logger.info("Telegram bot started");
}

module.exports = { startBot };
