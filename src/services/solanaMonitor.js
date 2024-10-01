const web3 = require("@solana/web3.js");
const { Wallet, Transaction } = require("../models");
const logger = require("../utils/logger");
const { StakeProgram } = web3;

// Configuration
const DEX_WHALE_BALANCE_THRESHOLD = 10000; // in SOL
const DEX_WHALE_TRANSACTION_THRESHOLD = 1000; // in SOL
const MIN_BALANCE_TO_TRACK = 10; // in SOL, adjust as needed
const BLOCKS_PER_SAMPLE = 10;
const COOLDOWN_PERIOD = 60000; // 10 minutes (in milliseconds)
const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // 500 ms

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

function isDEXTransaction(transaction) {
  if (
    transaction &&
    transaction.transaction &&
    transaction.transaction.message &&
    transaction.transaction.message.accountKeys
  ) {
    const programIds = transaction.transaction.message.accountKeys.map((key) =>
      key.toString()
    );
    return programIds.some((id) => DEX_PROGRAM_IDS.includes(id));
  }
  return false;
}

const STAKE_PROGRAM_ID = new web3.PublicKey(
  "Stake11111111111111111111111111111111111111"
);

async function isStakingAccount(address) {
  try {
    const pubkey = new web3.PublicKey(address);

    const stakeAccounts = await connection.getParsedProgramAccounts(
      StakeProgram.programId,
      {
        filters: [
          {
            memcmp: {
              offset: 12,
              bytes: pubkey.toBase58(),
            },
          },
        ],
      }
    );

    if (stakeAccounts.length > 0) {
      return true;
    } else {
      return false;
    }

    // const accountInfo = await connection.getAccountInfo(pubkey);

    // if (!accountInfo) {
    //   return false;
    // }

    // return accountInfo.owner.equals(STAKE_PROGRAM_ID);
  } catch (error) {
    console.error(`Error checking if ${address} is a staking account:`, error);
    return false;
  }
}

// Helper function to determine if an account meets DEX whale criteria
function isDEXWhale(balance, transactionAmount) {
  return (
    (balance >= DEX_WHALE_BALANCE_THRESHOLD ||
      transactionAmount >= DEX_WHALE_TRANSACTION_THRESHOLD) &&
    balance >= MIN_BALANCE_TO_TRACK
  ); // Add this if you want to ignore very small accounts
}

async function updateWallet(
  address,
  balance,
  balanceChange,
  transactionAmount
) {
  try {
    // Only proceed if it's a DEX whale
    if (isDEXWhale(balance, transactionAmount)) {
      let [wallet, created] = await Wallet.findOrCreate({
        where: { address },
        defaults: {
          balance,
          lastActivity: new Date(),
          dexTransactionCount: 1,
          largestDEXTransaction: transactionAmount,
        },
      });

      if (!created) {
        await wallet.update({
          balance,
          lastActivity: new Date(),
          dexTransactionCount: wallet.dexTransactionCount + 1,
          largestDEXTransaction: Math.max(
            Number(wallet.largestDEXTransaction),
            transactionAmount
          ),
        });
      }

      // Ensure we're working with numbers for the log message
      const logLargestTransaction = Number(
        created ? transactionAmount : wallet.largestDEXTransaction
      );

      logger.info(
        `${
          created ? "New" : "Updated"
        } DEX whale wallet: ${address}, Balance: ${balance.toFixed(
          2
        )} SOL, DEX Transactions: ${
          wallet.dexTransactionCount
        }, Largest Transaction: ${logLargestTransaction.toFixed(2)} SOL`
      );

      return wallet;
    }
    return null; // Return null if it's not a DEX whale
  } catch (error) {
    logger.error("Error updating wallet:", error);
    return null;
  }
}

function calculateTransactionAmount(transaction) {
  let totalChange = 0;
  const preBalances = transaction.meta.preBalances;
  const postBalances = transaction.meta.postBalances;

  for (let i = 0; i < preBalances.length; i++) {
    const change = postBalances[i] - preBalances[i];
    totalChange += Math.abs(change);
  }

  return totalChange / web3.LAMPORTS_PER_SOL;
}

async function processTransaction(transaction) {
  if (!isDEXTransaction(transaction)) return false;

  let dexWhaleInvolved = false;
  let whaleAddresses = [];

  if (
    transaction &&
    transaction.transaction &&
    transaction.transaction.message &&
    transaction.transaction.message.accountKeys &&
    transaction.meta &&
    transaction.meta.postBalances &&
    transaction.meta.preBalances
  ) {
    const accounts = transaction.transaction.message.accountKeys;
    const postBalances = transaction.meta.postBalances;
    const preBalances = transaction.meta.preBalances;

    const amount = calculateTransactionAmount(transaction);

    for (let i = 0; i < accounts.length; i++) {
      const address = accounts[i].toString();
      const balanceInSOL = postBalances[i] / web3.LAMPORTS_PER_SOL;
      const balanceChangeInSOL = Math.abs(
        balanceInSOL - preBalances[i] / web3.LAMPORTS_PER_SOL
      );

      try {
        // Check if the account meets DEX whale criteria
        if (isDEXWhale(balanceInSOL, amount)) {
          // Only proceed if it's not a staking account
          if (!(await isStakingAccount(address))) {
            const wallet = await updateWallet(
              address,
              balanceInSOL,
              balanceChangeInSOL,
              amount
            );
            if (wallet) {
              dexWhaleInvolved = true;
              whaleAddresses.push(address);
            }
          }
        }
      } catch (error) {
        logger.error(`Error processing account ${address}: ${error.message}`);
      }
      await sleep(2000);
    }
  }

  if (dexWhaleInvolved) {
    await storeTransaction(transaction, whaleAddresses);
  }

  return dexWhaleInvolved;
}

async function storeTransaction(txInfo, whaleAddresses) {
  try {
    const signature = txInfo.transaction.signatures[0];
    const fromWallet = txInfo.transaction.message.accountKeys[0].toString();
    const toWallet = txInfo.transaction.message.accountKeys[1].toString();
    const amount = calculateTransactionAmount(txInfo);
    const timestamp = txInfo.blockTime
      ? new Date(txInfo.blockTime * 1000)
      : new Date();

    // Only store if either the from or to wallet is a whale
    if (
      whaleAddresses.includes(fromWallet) ||
      whaleAddresses.includes(toWallet)
    ) {
      const transactionData = {
        signature,
        fromWallet,
        toWallet,
        amount,
        timestamp,
        involvedWhales: whaleAddresses.join(","), // Store involved whale addresses
      };

      logger.debug(
        "Storing DEX whale transaction:",
        JSON.stringify(transactionData)
      );

      const [transaction, created] = await Transaction.findOrCreate({
        where: { signature },
        defaults: transactionData,
      });

      if (created) {
        logger.info(`Stored DEX whale transaction: ${signature}`);
      } else {
        logger.debug(`Transaction ${signature} already exists in the database`);
      }
    } else {
      logger.debug(
        `Transaction ${signature} does not involve a whale wallet, not storing`
      );
    }
  } catch (error) {
    logger.error("Error storing transaction:", error);
    logger.error("Transaction info:", JSON.stringify(txInfo, null, 2));
  }
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
              try {
                const isWhale = await processTransaction(tx);
                if (isWhale) whalesDetectedInCurrentCycle++;
              } catch (txError) {
                logger.error(
                  `Error processing transaction: ${txError.message}`
                );
                logger.debug(`Transaction details: ${JSON.stringify(tx)}`);
              }
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
            logger.error(`Error fetching block: ${error.message}`);
            logger.debug(`Error stack: ${error.stack}`);
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
      `Sampling cycle complete. Detected ${whalesDetectedInCurrentCycle} new DEX whale wallets in this cycle.`
    );
    logger.info(`Cooling down for ${COOLDOWN_PERIOD / 60000} minutes.`);
    await sleep(COOLDOWN_PERIOD);
  }
}

module.exports = { monitorTransactions };
