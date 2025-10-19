require('dotenv').config();
const express = require('express');
const path = require('path');
const sequelize = require('./config/sequalize_db');
const logger = require('./config/logger'); 
const morgan = require('morgan'); 

const app = express();


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
const loanRoutes = require('./routes/loanRoutes');




app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/loans', loanRoutes);



// Database Connection
(async () => {
  try {
    await sequelize.authenticate();
    logger.info('Connected to PostgreSQL via Sequelize');

    await sequelize.sync({ alter: false });
    logger.info('Database models synchronized');
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
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

// Start server
const SERVER_PORT = parseInt(process.env.SERVER_PORT, 10) || 3002;

app.listen(SERVER_PORT, () => {
  logger.info(`Server running on http://localhost:${SERVER_PORT}`);
});
