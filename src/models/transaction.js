// models/Transaction.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Transaction = sequelize.define(
    "Transaction",
    {
      signature: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      fromWallet: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      toWallet: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      involvesWhale: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      indexes: [
        {
          fields: ["fromWallet"],
        },
        {
          fields: ["toWallet"],
        },
        {
          fields: ["timestamp"],
        },
      ],
    }
  );

  return Transaction;
};
