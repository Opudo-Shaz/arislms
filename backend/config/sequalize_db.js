require('dotenv').config(); 
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT,
    logging: false,
    dialectOptions: {
      connectTimeout: 5000, // ms — TCP connect timeout
    },
    pool: {
      acquire: 10000, // ms — max time to acquire a connection before throwing
      idle: 10000,
    },
  }
);

module.exports = sequelize;
