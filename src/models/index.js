// src/models/index.js
const { Sequelize } = require("sequelize");
const env = process.env.NODE_ENV || "development";
const config = require("../config/database")[env];

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

const Wallet = require("./wallet")(sequelize);
const Transaction = require("./transaction")(sequelize);

const models = {
  Wallet,
  Transaction,
};

Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = {
  ...models,
  sequelize,
};
