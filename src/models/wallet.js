const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Wallet = sequelize.define("Wallet", {
    address: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    lastActivity: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    isWhale: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    activityCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    dailyTransactionVolume: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    dailyTransactionCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });

  return Wallet;
};
