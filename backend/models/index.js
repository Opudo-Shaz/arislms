const sequelize = require('../config/sequalize_db');

// Import models so they are registered with Sequelize
const User = require('./userModel');
const Loan = require('./loanModel');
const Client = require('./clientModel');
const Payment = require('./paymentModel');
const AuditLog = require('./auditLogModel');

// Define associations if not already defined in models
// (models themselves may already call belongsTo/hasMany)
if (typeof Client !== 'undefined' && typeof Loan !== 'undefined') {
  Client.hasMany(Loan, { foreignKey: 'client_id', sourceKey: 'id' });
  Loan.belongsTo(Client, { foreignKey: 'client_id', targetKey: 'id' });
}

if (typeof User !== 'undefined' && typeof Loan !== 'undefined') {
  User.hasMany(Loan, { foreignKey: 'user_id', sourceKey: 'id' });
  Loan.belongsTo(User, { foreignKey: 'user_id', targetKey: 'id' });
}

// Payment associations
if (typeof Loan !== 'undefined' && typeof Payment !== 'undefined') {
  Loan.hasMany(Payment, { foreignKey: 'loan_id' });
  Payment.belongsTo(Loan, { foreignKey: 'loan_id' });
}

if (typeof User !== 'undefined' && typeof Payment !== 'undefined') {
  User.hasMany(Payment, { foreignKey: 'processed_by' });
  Payment.belongsTo(User, { foreignKey: 'processed_by' });
}

module.exports = {
  sequelize,
  User,
  Loan,
  Client,
  Payment,
  AuditLog,
};
