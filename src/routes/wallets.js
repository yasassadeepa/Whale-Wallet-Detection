const express = require("express");
const { Wallet } = require("../models");
const logger = require("../utils/logger");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const wallets = await Wallet.findAll();
    res.json(wallets);
  } catch (error) {
    logger.error("Error fetching wallets:", error);
    next(error);
  }
});

router.get("/whales", async (req, res, next) => {
  try {
    const whales = await Wallet.findAll({
      where: { isWhale: true },
      order: [["balance", "DESC"]],
      limit: 10,
    });
    res.json(whales);
  } catch (error) {
    logger.error("Error fetching whale wallets:", error);
    next(error);
  }
});

module.exports = router;
