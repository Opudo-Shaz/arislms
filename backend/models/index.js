const sequelize = require('../config/sequalize_db');

// Import models so they are registered with Sequelize
const Role = require('./roleModel');
const User = require('./userModel');
const Loan = require('./loanModel');
const Client = require('./clientModel');
const Payment = require('./paymentModel');
const AuditLog = require('./auditLogModel');
const RepaymentSchedule = require('./repaymentScheduleModel');
const CreditScore = require('./creditScoreModel');
const ChartOfAccount = require('./chartOfAccountModel');
const JournalEntry = require('./journalEntryModel');
const JournalEntryLine = require('./journalEntryLineModel');
const MemberContribution = require('./memberContributionModel');
const LoanTransaction = require('./loanTransactionModel');

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
  Loan.hasMany(RepaymentSchedule, { foreignKey: 'loan_id' });
  RepaymentSchedule.belongsTo(Loan, { foreignKey: 'loan_id' });
}

// Credit Score associations
if (typeof Client !== 'undefined' && typeof CreditScore !== 'undefined') {
  Client.hasMany(CreditScore, { foreignKey: 'client_id', as: 'creditScores' });
  CreditScore.belongsTo(Client, { foreignKey: 'client_id' });
}

if (typeof Loan !== 'undefined' && typeof CreditScore !== 'undefined') {
  Loan.hasOne(CreditScore, { foreignKey: 'loan_id', as: 'creditScore' });
  CreditScore.belongsTo(Loan, { foreignKey: 'loan_id' });
}

// ChartOfAccount self-reference (sub-accounts)
ChartOfAccount.belongsTo(ChartOfAccount, { foreignKey: 'parent_account_id', as: 'parentAccount' });
ChartOfAccount.hasMany(ChartOfAccount, { foreignKey: 'parent_account_id', as: 'subAccounts' });

// JournalEntry <-> JournalEntryLine
JournalEntry.hasMany(JournalEntryLine, { foreignKey: 'journal_entry_id', as: 'lines' });
JournalEntryLine.belongsTo(JournalEntry, { foreignKey: 'journal_entry_id' });

// JournalEntryLine -> ChartOfAccount
JournalEntryLine.belongsTo(ChartOfAccount, { foreignKey: 'account_id', as: 'account' });

// JournalEntryLine optional subsidiary ledger links
JournalEntryLine.belongsTo(Loan, { foreignKey: 'loan_id', as: 'loan', constraints: false });
JournalEntryLine.belongsTo(Client, { foreignKey: 'client_id', as: 'client', constraints: false });

// MemberContribution associations
MemberContribution.belongsTo(Client, { foreignKey: 'client_id', as: 'client' });
MemberContribution.belongsTo(JournalEntry, { foreignKey: 'journal_entry_id', as: 'journalEntry' });
Client.hasMany(MemberContribution, { foreignKey: 'client_id', as: 'contributions' });

module.exports = {
  sequelize,
  Role,
  User,
  Loan,
  Client,
  Payment,
  AuditLog,
  RepaymentSchedule,
  CreditScore,
  ChartOfAccount,
  JournalEntry,
  JournalEntryLine,
  MemberContribution,
  LoanTransaction,
};
