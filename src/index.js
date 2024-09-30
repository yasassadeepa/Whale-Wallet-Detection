const express = require("express");
const { sequelize } = require("./models");
const { monitorTransactions } = require("./services/solanaMonitor");
const telegramBot = require("./services/telegramBot");
const routes = require("./routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Use routes
app.use("/api", routes);

// Error handling middleware
app.use(errorHandler);

sequelize
  .authenticate()
  .then(() => {
    console.log("Database connection has been established successfully.");
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

sequelize
  .sync({ force: true })
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      monitorTransactions().catch((err) => {
        logger.error("Error in monitoring transactions:", err);
      });
      telegramBot.start();
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });
