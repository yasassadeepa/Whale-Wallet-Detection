// src/services/solanaMonitor.js

const web3 = require("@solana/web3.js");
const { Wallet, Transaction } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

// Configuration
const WHALE_BALANCE_THRESHOLD = 10000; // in SOL
const WHALE_TRANSACTION_VOLUME_THRESHOLD = 100000; // in SOL per day
const WHALE_TRANSACTION_COUNT_THRESHOLD = 50; // transactions per day
const MIN_TX_AMOUNT_TO_CHECK = 1000; // in SOL
const BLOCKS_PER_SAMPLE = 10;
const MAX_RETRIES = 3;

// Solana connection
const connection = new web3.Connection(web3.clusterApiUrl("mainnet-beta"), {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000,
});

// Utility functions
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main monitoring function
async function monitorTransactions() {
  logger.info("Starting continuous monitoring...");

  while (true) {
    let whalesDetectedInCurrentCycle = 0;

    for (let i = 0; i < BLOCKS_PER_SAMPLE; i++) {
      let retries = 0;
      while (retries < MAX_RETRIES) {
        try {
          const slot = await connection.getSlot();
          logger.info(`Fetching block at slot ${slot}`);

          const block = await connection.getBlock(slot, {
            maxSupportedTransactionVersion: 0,
          });

          if (
            block &&
            block.transactions &&
            Array.isArray(block.transactions)
          ) {
            logger.info(
              `Processing ${block.transactions.length} transactions in block ${slot}`
            );
            for (const tx of block.transactions) {
              const newWhales = await processTransaction(tx);
              whalesDetectedInCurrentCycle += newWhales;
            }
            break; // Success, move to next block
          } else {
            logger.info(
              "No transactions in this block or unexpected block structure."
            );
          }
        } catch (error) {
          logger.error("Error fetching block:", error.message);
          retries++;
          if (retries >= MAX_RETRIES) {
            logger.warn("Max retries reached. Moving to next block.");
          } else {
            logger.info(
              `Retrying in 10 seconds... (Attempt ${
                retries + 1
              }/${MAX_RETRIES})`
            );
            await sleep(10000);
          }
        }
      }
      // Wait 1 second between each block to avoid rate limiting
      if (i < BLOCKS_PER_SAMPLE - 1) {
        await sleep(1000);
      }
    }

    logger.info(
      `Cycle complete. Detected ${whalesDetectedInCurrentCycle} new whale wallets in this cycle.`
    );
    // Immediately start the next cycle
  }
}

// Process individual transactions
async function processTransaction(transaction) {
  let whalesDetected = 0;
  try {
    if (
      transaction &&
      transaction.meta &&
      transaction.meta.postBalances &&
      transaction.transaction &&
      transaction.transaction.message &&
      transaction.transaction.message.accountKeys
    ) {
      const accounts = transaction.transaction.message.accountKeys;
      const postBalances = transaction.meta.postBalances;
      const preBalances = transaction.meta.preBalances;

      for (let i = 0; i < accounts.length; i++) {
        const address = accounts[i].toString();
        const balanceInLamports = postBalances[i];
        const balanceInSOL = balanceInLamports / web3.LAMPORTS_PER_SOL;
        const balanceChangeInSOL =
          Math.abs(postBalances[i] - preBalances[i]) / web3.LAMPORTS_PER_SOL;

        if (
          balanceInSOL >= MIN_TX_AMOUNT_TO_CHECK ||
          balanceChangeInSOL >= MIN_TX_AMOUNT_TO_CHECK
        ) {
          const isWhale = await updateWallet(
            address,
            balanceInSOL,
            balanceChangeInSOL
          );
          if (isWhale) whalesDetected++;
        }
      }

      // Store the transaction
      await storeTransaction(transaction);
    }
  } catch (error) {
    logger.error("Error processing transaction:", error);
  }
  return whalesDetected;
}

// Update or add whale wallet information
async function updateWallet(address, balance, transactionAmount) {
  try {
    // First, check if this transaction would make the wallet a whale
    const isWhaleNow = await checkWhaleStatus(
      address,
      balance,
      transactionAmount
    );

    if (isWhaleNow) {
      // If it's a whale, update or insert the wallet
      const [wallet, created] = await Wallet.findOrCreate({
        where: { address },
        defaults: {
          balance: parseFloat(balance.toFixed(8)),
          lastActivity: new Date(),
          isWhale: true,
          activityCount: 1,
          dailyTransactionVolume: parseFloat(transactionAmount.toFixed(8)),
          dailyTransactionCount: 1,
        },
      });

      if (!created) {
        // Update existing whale wallet
        const updatedData = {
          balance: parseFloat(balance.toFixed(8)),
          lastActivity: new Date(),
          activityCount: wallet.activityCount + 1,
          dailyTransactionVolume: parseFloat(
            (
              parseFloat(wallet.dailyTransactionVolume) + transactionAmount
            ).toFixed(8)
          ),
          dailyTransactionCount: wallet.dailyTransactionCount + 1,
        };

        // Reset daily counters if it's a new day
        if (isNewDay(wallet.lastActivity)) {
          updatedData.dailyTransactionVolume = parseFloat(
            transactionAmount.toFixed(8)
          );
          updatedData.dailyTransactionCount = 1;
        }

        await wallet.update(updatedData);
      }

      logger.info(
        `🐳 Whale wallet updated: ${address}, Balance: ${balance.toFixed(
          8
        )} SOL`
      );
      return true;
    } else {
      // If it's not a whale, check if it was previously a whale and remove if necessary
      const existingWhale = await Wallet.findOne({
        where: { address, isWhale: true },
      });
      if (existingWhale) {
        await existingWhale.destroy();
        logger.info(
          `Wallet no longer classified as whale and removed: ${address}`
        );
      }
    }
  } catch (error) {
    logger.error("Error updating wallet:", error);
    logger.error(
      "Error details:",
      JSON.stringify({
        address,
        balance,
        transactionAmount,
        error: error.message,
      })
    );
  }
  return false;
}

async function checkWhaleStatus(
  address,
  currentBalance,
  currentTransactionAmount
) {
  // Check balance criterion
  if (currentBalance >= WHALE_BALANCE_THRESHOLD) return true;

  // Check transaction volume criterion
  const dailyTransactions = await Transaction.sum("amount", {
    where: {
      [Op.or]: [{ fromWallet: address }, { toWallet: address }],
      timestamp: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  const dailyVolume = (dailyTransactions || 0) + currentTransactionAmount;
  if (dailyVolume >= WHALE_TRANSACTION_VOLUME_THRESHOLD) return true;

  // Check transaction count criterion
  const dailyCount = await Transaction.count({
    where: {
      [Op.or]: [{ fromWallet: address }, { toWallet: address }],
      timestamp: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (dailyCount + 1 >= WHALE_TRANSACTION_COUNT_THRESHOLD) return true;

  // Check long-term activity (if applicable)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oldTransactions = await Transaction.findOne({
    where: {
      [Op.or]: [{ fromWallet: address }, { toWallet: address }],
      timestamp: { [Op.lt]: thirtyDaysAgo },
    },
  });
  if (oldTransactions && currentBalance >= WHALE_BALANCE_THRESHOLD / 2)
    return true;

  return false;
}

function isNewDay(lastActivity) {
  const now = new Date();
  return (
    lastActivity.getDate() !== now.getDate() ||
    lastActivity.getMonth() !== now.getMonth() ||
    lastActivity.getFullYear() !== now.getFullYear()
  );
}

async function storeTransaction(txInfo, retries = 3) {
  try {
    logger.debug("Raw txInfo:", JSON.stringify(txInfo, null, 2));

    if (
      !txInfo.transaction ||
      !txInfo.transaction.message ||
      !txInfo.transaction.message.accountKeys
    ) {
      logger.error("Invalid txInfo structure");
      return;
    }

    const fromWallet = txInfo.transaction.message.accountKeys[0].toString();
    const toWallet = txInfo.transaction.message.accountKeys[1].toString();

    logger.debug("From wallet:", fromWallet);
    logger.debug("To wallet:", toWallet);

    // Check if either the sender or receiver is a whale
    const [senderWallet, receiverWallet] = await Promise.all([
      Wallet.findOne({ where: { address: fromWallet, isWhale: true } }),
      Wallet.findOne({ where: { address: toWallet, isWhale: true } }),
    ]);

    if (senderWallet || receiverWallet) {
      if (
        !txInfo.meta ||
        !txInfo.meta.postBalances ||
        !txInfo.meta.preBalances
      ) {
        logger.error("Invalid txInfo.meta structure");
        return;
      }

      const amount =
        (txInfo.meta.postBalances[1] - txInfo.meta.preBalances[1]) /
        web3.LAMPORTS_PER_SOL;

      const transactionData = {
        signature: txInfo.transaction.signatures[0],
        fromWallet: fromWallet,
        toWallet: toWallet,
        amount: parseFloat(amount.toFixed(8)),
        timestamp: txInfo.blockTime
          ? new Date(txInfo.blockTime * 1000)
          : new Date(),
        involvesWhale: true,
      };

      logger.info(
        "Constructed transactionData:",
        JSON.stringify(transactionData, null, 2)
      );

      const createdTransaction = await Transaction.create(transactionData);

      logger.info(`Stored whale transaction: ${createdTransaction.signature}`);
    } else {
      logger.debug(
        "Transaction not involving a whale wallet, skipping storage"
      );
    }
  } catch (error) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
      parameters: error.parameters,
    };

    if (error.original) {
      errorDetails.original = {
        code: error.original.code,
        detail: error.original.detail,
        where: error.original.where,
        file: error.original.file,
        line: error.original.line,
        routine: error.original.routine,
      };
    }

    if (retries > 0) {
      logger.warn(
        `Error storing transaction, retrying... (${retries} attempts left)`
      );
      logger.error("Error details:", JSON.stringify(errorDetails, null, 2));
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before retrying
      return storeTransaction(txInfo, retries - 1);
    }
    logger.error(
      "Error storing transaction:",
      JSON.stringify(errorDetails, null, 2)
    );
    logger.error("Transaction info:", JSON.stringify(txInfo, null, 2));
  }
}

// Reporting functions
async function logStats() {
  const totalWallets = await Wallet.count();
  const whaleWallets = await Wallet.count({ where: { isWhale: true } });
  logger.info("--- Current Stats ---");
  logger.info(`Total wallets tracked: ${totalWallets}`);
  logger.info(`Total whale wallets: ${whaleWallets}`);
  logger.info("---------------------");
}

async function generateDetailedReport() {
  logger.info("=== Detailed Whale Wallet Report ===");
  const whales = await Wallet.findAll({ where: { isWhale: true } });
  for (const whale of whales) {
    const riskScore = calculateRiskScore(whale);
    logger.info(`Address: ${whale.address}`);
    logger.info(`  Balance: ${whale.balance.toFixed(2)} SOL`);
    logger.info(`  Last Seen: ${whale.lastActivity.toISOString()}`);
    logger.info(`  Activity Count: ${whale.activityCount}`);
    logger.info(
      `  Daily Transaction Volume: ${whale.dailyTransactionVolume.toFixed(
        2
      )} SOL`
    );
    logger.info(`  Daily Transaction Count: ${whale.dailyTransactionCount}`);
    logger.info(`  Risk Score: ${riskScore.toFixed(2)}`);
    logger.info("---");
  }
}

function calculateRiskScore(wallet) {
  const balanceScore = Math.min(
    wallet.balance / (WHALE_BALANCE_THRESHOLD * 2),
    1
  );
  const volumeScore = Math.min(
    wallet.dailyTransactionVolume / WHALE_TRANSACTION_VOLUME_THRESHOLD,
    1
  );
  const countScore = Math.min(
    wallet.dailyTransactionCount / WHALE_TRANSACTION_COUNT_THRESHOLD,
    1
  );
  return (balanceScore * 0.4 + volumeScore * 0.4 + countScore * 0.2) * 100; // Weighted average, scaled to 0-100
}

module.exports = {
  monitorTransactions,
  logStats,
  generateDetailedReport,
};
