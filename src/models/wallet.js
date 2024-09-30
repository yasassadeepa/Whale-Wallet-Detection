const { DataTypes } = require("sequelize");
// models/Wallet.js
module.exports = (sequelize) => {
  const Wallet = sequelize.define(
    "Wallet",
    {
      address: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      balance: DataTypes.DECIMAL(20, 8),
      lastActivity: DataTypes.DATE,
      dexActivityCount: DataTypes.INTEGER,
      isWhale: DataTypes.BOOLEAN,
    },
    {
      indexes: [
        {
          unique: true,
          fields: ["address"],
        },
      ],
    }
  );

  return Wallet;
};
