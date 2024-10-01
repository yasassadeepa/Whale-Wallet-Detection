const TelegramBot = require("node-telegram-bot-api");
const { Wallet, Transaction } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

// Configuration constants
const DEX_WHALE_BALANCE_THRESHOLD = 10000; // in SOL
const DEX_WHALE_TRANSACTION_THRESHOLD = 1000; // in SOL
const MIN_BALANCE_TO_TRACK = 10; // in SOL

let bot;

function startBot() {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  // Start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "Welcome to the Solana DEX Whale Detector Bot! Use /help to see available commands."
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
/stats - Show general DEX whale statistics
/recentactivity - Show recent DEX whale activity
/search <address> - Search for a specific DEX whale wallet
/criteria - Show current DEX whale criteria
    `;
    bot.sendMessage(chatId, helpMessage);
  });

  // DEX Whales command
  bot.onText(/\/dexwhales/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const whales = await Wallet.findAll({
        order: [["balance", "DESC"]],
        limit: 10,
      });

      let message = "Top 10 DEX Whale Wallets:\n\n";
      whales.forEach((whale, index) => {
        message += `${index + 1}. Address: ${
          whale.address
        }\n   Balance: ${parseFloat(whale.balance).toFixed(
          2
        )} SOL\n   DEX Transactions: ${
          whale.dexTransactionCount
        }\n   Largest DEX Transaction: ${parseFloat(
          whale.largestDEXTransaction
        ).toFixed(2)} SOL\n\n`;
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
      const totalTransactions = await Transaction.count();
      const latestTransaction = await Transaction.findOne({
        order: [["timestamp", "DESC"]],
      });

      const message = `
DEX Whale Statistics:
Total DEX Whale Wallets: ${totalWallets}
Total DEX Whale Transactions: ${totalTransactions}
Latest Transaction: ${
        latestTransaction
          ? new Date(latestTransaction.timestamp).toISOString()
          : "N/A"
      }
DEX Whale Balance Threshold: ${DEX_WHALE_BALANCE_THRESHOLD} SOL
DEX Whale Transaction Threshold: ${DEX_WHALE_TRANSACTION_THRESHOLD} SOL
Minimum Balance to Track: ${MIN_BALANCE_TO_TRACK} SOL
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
        order: [["timestamp", "DESC"]],
        limit: 5,
      });

      let message = "Recent DEX Whale Activity:\n\n";
      for (const tx of recentTransactions) {
        message += `Signature: ${tx.signature}\n`;
        message += `From: ${tx.fromWallet}\n`;
        message += `To: ${tx.toWallet}\n`;
        message += `Amount: ${parseFloat(tx.amount).toFixed(2)} SOL\n`;
        message += `Timestamp: ${new Date(tx.timestamp).toISOString()}\n`;
        message += `Involved Whales: ${tx.involvedWhales}\n\n`;
      }

      bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error("Error fetching recent DEX activity:", error);
      bot.sendMessage(
        chatId,
        "Sorry, there was an error fetching recent DEX activity."
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
DEX Whale Wallet Information:
Address: ${wallet.address}
Balance: ${parseFloat(wallet.balance).toFixed(2)} SOL
DEX Transactions: ${wallet.dexTransactionCount}
Largest DEX Transaction: ${parseFloat(wallet.largestDEXTransaction).toFixed(
          2
        )} SOL
Last Activity: ${new Date(wallet.lastActivity).toISOString()}
        `;
        bot.sendMessage(chatId, message);
      } else {
        bot.sendMessage(chatId, "Wallet not found or not a DEX whale.");
      }
    } catch (error) {
      logger.error("Error searching for wallet:", error);
      bot.sendMessage(
        chatId,
        "Sorry, there was an error searching for the wallet."
      );
    }
  });

  // Criteria command
  bot.onText(/\/criteria/, (msg) => {
    const chatId = msg.chat.id;
    const message = `
Current DEX Whale Criteria:
1. Balance Threshold: ${DEX_WHALE_BALANCE_THRESHOLD} SOL or more
2. Transaction Threshold: ${DEX_WHALE_TRANSACTION_THRESHOLD} SOL or more in a single DEX transaction
3. Minimum Balance to Track: ${MIN_BALANCE_TO_TRACK} SOL
4. Include Only DEX Wallets
5. Ignore Staking Wallets

A wallet is considered a DEX whale if it meets either the balance or transaction threshold and has at least the minimum balance to track.
    `;
    bot.sendMessage(chatId, message);
  });

  // Error handling
  bot.on("polling_error", (error) => {
    logger.error("Telegram Bot polling error:", error);
  });

  logger.info("Telegram bot started");
}

module.exports = { startBot };
