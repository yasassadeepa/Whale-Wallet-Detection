const TelegramBot = require("node-telegram-bot-api");
const { Wallet, Transaction } = require("../models");
const logger = require("../utils/logger");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

function start() {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "Welcome to the Insider Wallet Detection Bot! Use /help to see available commands."
    );
  });

  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      `
Available commands:
/whales - Get a list of top whale wallets
/transactions - Get recent transactions
/stats - Get current statistics
    `
    );
  });

  bot.onText(/\/whales/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const whales = await Wallet.findAll({
        where: { isWhale: true },
        order: [["balance", "DESC"]],
        limit: 10,
      });

      let message = "Top 10 Whale Wallets:\n\n";
      whales.forEach((whale, index) => {
        message += `${index + 1}. Address: ${whale.address}\n   Balance: ${
          whale.balance
        } SOL\n\n`;
      });

      bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error("Error fetching whale data:", error);
      bot.sendMessage(chatId, "Sorry, there was an error fetching whale data.");
    }
  });

  bot.onText(/\/transactions/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const transactions = await Transaction.findAll({
        order: [["timestamp", "DESC"]],
        limit: 5,
      });

      let message = "Recent Transactions:\n\n";
      transactions.forEach((tx, index) => {
        message += `${index + 1}. From: ${tx.fromWallet}\n   To: ${
          tx.toWallet
        }\n   Amount: ${tx.amount} SOL\n   Time: ${tx.timestamp}\n\n`;
      });

      bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error("Error fetching transaction data:", error);
      bot.sendMessage(
        chatId,
        "Sorry, there was an error fetching transaction data."
      );
    }
  });

  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const whaleCount = await Wallet.count({ where: { isWhale: true } });
      const totalWallets = await Wallet.count();
      const totalTransactions = await Transaction.count();

      const message = `Current Statistics:
Total Wallets: ${totalWallets}
Whale Wallets: ${whaleCount}
Total Transactions: ${totalTransactions}`;

      bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error("Error fetching stats:", error);
      bot.sendMessage(chatId, "Sorry, there was an error fetching statistics.");
    }
  });

  logger.info("Telegram bot started");
}

module.exports = { start };
