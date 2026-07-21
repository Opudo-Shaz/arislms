const loadEnv = require('./config/env');
loadEnv();

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const sequelize = require('./config/sequalize_db');
const logger = require('./config/logger'); 
const morgan = require('morgan'); 
const { swaggerUi, swaggerSpec } = require("./swagger");

const app = express();
app.disable('x-powered-by');

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// NOTE: uploads/ is intentionally NOT served via express.static.
// Files are served through the authenticated GET /api/documents/:id/download endpoint.

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


//Integrating Morgan to pipe HTTP logs into Winston
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// routes
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const roleRoutes = require('./routes/roleRoutes');
const loanRoutes = require('./routes/loanRoutes');
const clientRoutes = require('./routes/clientRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const loanProductRoutes = require('./routes/loanProductRoutes');
const collateralRoutes = require('./routes/collateralRoutes');
const auditRoutes = require('./routes/auditRoutes');
const creditScoreRoutes = require('./routes/creditScoreRoutes');
const chartOfAccountRoutes = require('./routes/chartOfAccountRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const memberContributionRoutes = require('./routes/memberContributionRoutes');
const documentRoutes = require('./routes/documentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const systemConfigRoutes = require('./routes/systemConfigRoutes');


app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/loan-products', loanProductRoutes);
app.use('/api/collaterals', collateralRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/credit-scores', creditScoreRoutes);
app.use('/api/chart-of-accounts', chartOfAccountRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/member-contributions', memberContributionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/system-configs', systemConfigRoutes);



require('./models');

// Register business event listeners (after models are loaded)
const { registerLoanTransactionListeners } = require('./utils/loanTransactionEmitter');
registerLoanTransactionListeners();

// Database Connection
const withTimeout = (promise, ms, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const formatServerUrl = (addressInfo, preferredHost) => {
  if (!addressInfo) {
    return null;
  }

  if (typeof addressInfo === 'string') {
    return addressInfo;
  }

  const normalizedPreferredHost = preferredHost?.trim();
  const usePreferredHost = normalizedPreferredHost
    && !['0.0.0.0', '::'].includes(normalizedPreferredHost);

  const host = usePreferredHost
    ? normalizedPreferredHost
    : ['::', '0.0.0.0', '::1', '127.0.0.1'].includes(addressInfo.address)
      ? 'localhost'
      : addressInfo.family === 'IPv6'
        ? `[${addressInfo.address}]`
        : addressInfo.address;

  return `http://${host}:${addressInfo.port}`;
};

(async () => {
  try {
    await withTimeout(sequelize.authenticate(), 10000, 'DB authentication');
    logger.info('Connected to PostgreSQL via Sequelize');

    await sequelize.sync({ alter: true });
    logger.info('Database models synchronized');

    // Seed read-only infra configs from environment variables
    const { seedInfraConfigs } = require('./services/systemConfigService');
    await seedInfraConfigs();

    // Seed loan lifecycle threshold configs and register daily cron job
    const loanStatusCronJob = require('./utils/loanStatusCronJob');
    loanStatusCronJob.register();

    // Start server after DB is ready
    const SERVER_PORT = Number.parseInt(process.env.SERVER_PORT, 10) || 6505;
    const SERVER_HOST = process.env.SERVER_HOST || process.env.HOST;
    const server = SERVER_HOST
      ? app.listen(SERVER_PORT, SERVER_HOST, () => {
          logger.info(`Server running on ${formatServerUrl(server.address(), SERVER_HOST) || `http://${SERVER_HOST}:${SERVER_PORT}`}`);
        })
      : app.listen(SERVER_PORT, () => {
          logger.info(`Server running on ${formatServerUrl(server.address()) || `http://localhost:${SERVER_PORT}`}`);
        });
  } catch (error) {
    logger.error(`Database connection error: ${error}`);
    process.exit(1);
  }
})();


app.get('/', (req, res) => {
  res.send('API server is running.');
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`${req.method} ${req.url} - ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});
