const loadEnv = require('./env');
loadEnv();

const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;

const baseOptions = {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    connectTimeout: 5000, // ms — TCP connect timeout
  },
  pool: {
    acquire: 10000, // ms — max time to acquire a connection before throwing
    idle: 10000,
  },
};

if (databaseUrl) {
  baseOptions.dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false,
  };
}

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, baseOptions)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        ...baseOptions,
      }
    );

module.exports = sequelize;
