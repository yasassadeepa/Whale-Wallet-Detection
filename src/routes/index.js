const express = require("express");
const walletRoutes = require("./wallets");
const transactionRoutes = require("./transactions");

const router = express.Router();

router.use("/wallets", walletRoutes);
router.use("/transactions", transactionRoutes);

module.exports = router;
