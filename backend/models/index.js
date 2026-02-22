const sequelize = require('../config/sequalize_db');

// Import models so they are registered with Sequelize
const Role = require('./roleModel');
const User = require('./userModel');
const Loan = require('./loanModel');
const Client = require('./clientModel');
const Payment = require('./paymentModel');
const AuditLog = require('./auditLogModel');
const RepaymentSchedule = require('./repaymentScheduleModel');

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
//user and role association
if (typeof User !== 'undefined' && typeof Role !== 'undefined') {
  User.belongsTo(Role, { foreignKey: 'role_id', targetKey: 'id' });
}

if (typeof User !== 'undefined' && typeof AuditLog !== 'undefined') {
  Role.hasMany(User, { foreignKey: 'role_id', sourceKey: 'id' });
  User.belongsTo(Role, { foreignKey: 'role_id', targetKey: 'id' });
}

// Repayment Schedule associations
if (typeof Loan !== 'undefined' && typeof RepaymentSchedule !== 'undefined') {
  Loan.hasMany(RepaymentSchedule, { foreignKey: 'loan_id', as: 'repaymentSchedules' });
  RepaymentSchedule.belongsTo(Loan, { foreignKey: 'loan_id' });
}

module.exports = {
  sequelize,
  Role,
  User,
  Loan,
  Client,
  Payment,
  AuditLog,
  RepaymentSchedule,
};
