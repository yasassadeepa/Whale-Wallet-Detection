const web3 = require("@solana/web3.js");
const { Wallet, Transaction } = require("../models");
const logger = require("../utils/logger");

// Configuration
const WHALE_BALANCE_THRESHOLD = 100; // Reduced from 10000 to 1000 SOL
const MIN_TX_AMOUNT_TO_CHECK = 10; // Reduced from 1000 to 100 SOL
const BLOCKS_PER_SAMPLE = 10;
const COOLDOWN_PERIOD = 60000; // 10 minutes (in milliseconds)
const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // 500 ms
const MIN_DEX_ACTIVITY_FOR_WHALE = 2; // Reduced from 5 to 2

const DEX_PROGRAM_IDS = [
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  "H8W3ctz92svYg6mkn1UtGfu2aQr2fnUFHM1RhScEtQDt",
  "CTMAxxk34HjKWxQ3QLZK1HpaLXmBveao3ESePXbiyfzh",
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb",
  "swapNyd8XiQwJ6ianp9snpu4brUqFxadzvHebnAXjJZ",
  "DecZY86MU5Gj7kppfUCEmd4LbXXuyZH1yHaP2NTqdiZB",
  "GFXsSL5sSaDfNFQUYsHekbWBW1TsFdjDYzACh62tEHxn",
  "Dooar9JkhdZ7J3LHN3A7YCuoGRUggXhQaG4kijfLGU2j",
  "SwaPpA9LAaLfeLi3a68M4DjnLqgtticKg6CnyNwgAC8",
  "PSwapMdSai8tjrEXcxFeQth87xC4rRsa4VA5mhGhXkP",
  "SSwapUtytfBdBn1b9NUGG6foMVPtcWgpRU32HToDUZr",
  "DEXYosS6oEGvk8uCDayvwEZz4qEyDJRf9nFgYCaqPMTm",
  "MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG",
  "CLMM9tUoggJu2wagPkkqs9eFG4BWhVBZWkP1qv3Sp7tR",
  "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "FLUXubRmkEi2q6K3Y9kBPg9248ggaZVsoSFhtJHSrm1X",
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
  "SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ",
  "DSwpgjMvXhtGn6BsbqmacdBZyfLj6jSWf3HJpdJtmg6N",
  "MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
  "HyaB3W9q6XdA5xwpU4XnSZV94htfmbmqJXZcEbRaJutt",
  "BSwp6bEBihVLdqJRKGgzjcGLHkcTuzmSo1TQkHepzH8p",
  "2wT8Yq49kHgDzXuPxZSaeLaH1qbmGXtEyPy64bL7aD3c",
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
  "EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S",
  "treaf4wWBBty3fHdyBpo35Mz84M8k3heKXmjmi9vFt5",
  "swapFpHZwjELNnjvThjajtiVmkz3yPQEHjLtka2fwHW",
  "stkitrT1Uoy18Dk1fTrgPw8W6MVzoCfYoAFT4MLsmhq",
  "9tKE7Mbmj4mxDjWatikzGAtkoWosiiZX9y6J4Hfm2R8H",
  "Gswppe6ERWKpUTXvRPfXdzHhiCyJvLadVvXGfdpBqcE1",
  "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY",
  "PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu",
  "AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6",
  "obriQD1zbpyLz95G5n7nJe6a4DPjpFwa5XYPoNm113y",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX",
  "CURVGoZn8zycx6FXwwevgBTB2gVvdbGTEpvMJDbgs2t4",
  "5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx",
];

// Solana connection
const connection = new web3.Connection(web3.clusterApiUrl("mainnet-beta"), {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000,
});

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function monitorTransactions() {
  while (true) {
    logger.info("Starting a new sampling cycle...");
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
              const isWhale = await processTransaction(tx);
              if (isWhale) whalesDetectedInCurrentCycle++;
            }
            break; // Success, move to next block
          } else {
            logger.info(
              "No transactions in this block or unexpected block structure."
            );
          }
        } catch (error) {
          if (error.message.includes("429 Too Many Requests")) {
            logger.warn(
              `Rate limit hit. Retrying after ${RETRY_DELAY}ms delay...`
            );
            await sleep(RETRY_DELAY);
          } else {
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
      }
      // Wait 5 seconds between each block to avoid rate limiting
      if (i < BLOCKS_PER_SAMPLE - 1) {
        await sleep(5000);
      }
    }

    logger.info(
      `Sampling cycle complete. Detected ${whalesDetectedInCurrentCycle} new whale wallets in this cycle.`
    );
    logger.info(`Cooling down for ${COOLDOWN_PERIOD / 60000} minutes.`);
    await sleep(COOLDOWN_PERIOD);
  }
}

async function processTransaction(transaction) {
  let whalesDetected = 0;
  let whaleInvolved = false;
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
        const balanceInSOL = postBalances[i] / web3.LAMPORTS_PER_SOL;
        const preBalanceInSOL = preBalances[i] / web3.LAMPORTS_PER_SOL;
        const balanceChangeInSOL = Math.abs(balanceInSOL - preBalanceInSOL);

        if (
          balanceInSOL >= MIN_TX_AMOUNT_TO_CHECK ||
          balanceChangeInSOL >= MIN_TX_AMOUNT_TO_CHECK
        ) {
          const isWhale = await updateWallet(
            address,
            balanceInSOL,
            balanceChangeInSOL
          );
          if (isWhale) {
            whalesDetected++;
            whaleInvolved = true;
          }
        }
      }

      // If a whale was involved in this transaction, store it
      if (whaleInvolved) {
        await storeTransaction(transaction);
      }
    }
  } catch (error) {
    logger.error("Error processing transaction:", error);
    logger.debug(
      "Problematic transaction:",
      JSON.stringify(transaction, null, 2)
    );
  }
  return whalesDetected;
}

async function updateWallet(address, balance, balanceChange) {
  try {
    logger.debug(
      `Checking wallet: ${address}, Balance: ${balance}, Balance Change: ${balanceChange}`
    );

    // Check if this wallet would be classified as a whale
    const isWhale =
      balance >= WHALE_BALANCE_THRESHOLD ||
      balanceChange >= WHALE_BALANCE_THRESHOLD;

    if (isWhale) {
      // Only interact with the database if it's a whale
      let [wallet, created] = await Wallet.findOrCreate({
        where: { address },
        defaults: {
          balance,
          lastActivity: new Date(),
          dexActivityCount: 1,
          isWhale: true,
          largestTransaction: balanceChange,
        },
      });

      if (!created) {
        // Update existing whale wallet
        await wallet.update({
          balance,
          lastActivity: new Date(),
          dexActivityCount: wallet.dexActivityCount + 1,
          isWhale: true,
          largestTransaction: Math.max(
            wallet.largestTransaction,
            balanceChange
          ),
        });
        logger.info(
          `🐳 Updated whale wallet: ${address}, Balance: ${balance.toFixed(
            2
          )} SOL, DEX Activities: ${
            wallet.dexActivityCount + 1
          }, Largest Transaction: ${Math.max(
            wallet.largestTransaction,
            balanceChange
          ).toFixed(2)} SOL`
        );
      } else {
        logger.info(
          `🐳 New whale wallet identified: ${address}, Balance: ${balance.toFixed(
            2
          )} SOL, DEX Activities: 1, Largest Transaction: ${balanceChange.toFixed(
            2
          )} SOL`
        );
      }

      return true;
    } else {
      // If it's not a whale, check if it was previously in the database and remove if necessary
      const existingWallet = await Wallet.findOne({ where: { address } });
      if (existingWallet) {
        await existingWallet.destroy();
        logger.info(
          `Wallet no longer classified as whale and removed: ${address}, Balance: ${balance.toFixed(
            2
          )} SOL`
        );
      }
      return false;
    }
  } catch (error) {
    logger.error("Error updating wallet:", error);
    logger.error(
      "Error details:",
      JSON.stringify({
        address,
        balance,
        balanceChange,
        error: error.message,
      })
    );
    return false;
  }
}

async function storeTransaction(txInfo) {
  try {
    const signature = txInfo.transaction.signatures[0];
    const fromWallet = txInfo.transaction.message.accountKeys[0].toString();
    const toWallet = txInfo.transaction.message.accountKeys[1].toString();
    const amount =
      (txInfo.meta.postBalances[1] - txInfo.meta.preBalances[1]) /
      web3.LAMPORTS_PER_SOL;
    const timestamp = txInfo.blockTime
      ? new Date(txInfo.blockTime * 1000)
      : new Date(); // Fallback to current date

    const transactionData = {
      signature,
      fromWallet,
      toWallet,
      amount: Math.abs(amount), // Ensure amount is positive
      timestamp,
    };

    logger.debug("Storing transaction:", JSON.stringify(transactionData));

    const [transaction, created] = await Transaction.findOrCreate({
      where: { signature },
      defaults: transactionData,
    });

    if (created) {
      logger.info(`Stored whale transaction: ${signature}`);
    } else {
      logger.debug(`Transaction ${signature} already exists in the database`);
    }
  } catch (error) {
    logger.error("Error storing transaction:", error);
    logger.error("Transaction info:", JSON.stringify(txInfo, null, 2));
  }
}

module.exports = { monitorTransactions };
