const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const LoanTransactionType = require('../enums/loanTransactionType');

/**
 * LoanTransaction — immutable ledger entries that act as a loan statement.
 *
 * Each row records what happened (transactionType), how much (amount),
 * and the running balances *after* this transaction so the full history
 * can reconstruct the loan balance at any point in time.
 *
 * A reversed transaction keeps its original row but gains isReversed=true.
 * The reversal itself is stored as a separate row of type REVERSAL with
 * reversedTransactionId pointing back to the original.
 */
const LoanTransaction = sequelize.define('LoanTransaction', {

  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  loanId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'loan_id',
  },

  transactionType: {
    type: DataTypes.ENUM(Object.values(LoanTransactionType)),
    allowNull: false,
    field: 'transaction_type',
  },

  /**
   * DEBIT  → increases what the borrower owes (e.g. disbursement, fee, penalty)
   * CREDIT → reduces what the borrower owes (e.g. repayment, write-off)
   */
  direction: {
    type: DataTypes.ENUM('DEBIT', 'CREDIT'),
    allowNull: false,
  },

  amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },

  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'KES',
  },

  // ── Running balance snapshot (state *after* this transaction) ──────────────

  principalBalance: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'principal_balance',
    comment: 'Outstanding principal balance after this transaction',
  },

  interestBalance: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'interest_balance',
    comment: 'Accrued interest balance after this transaction',
  },

  feesBalance: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'fees_balance',
    comment: 'Outstanding fees balance after this transaction',
  },

  penaltiesBalance: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'penalties_balance',
    comment: 'Outstanding penalties balance after this transaction',
  },

  totalBalance: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_balance',
    comment: 'Total outstanding balance (principal + interest + fees + penalties) after this transaction',
  },

  // ── Reversal tracking ──────────────────────────────────────────────────────

  /**
   * Set to true on the *original* transaction when it has been reversed.
   */
  isReversed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_reversed',
  },

  /**
   * On a REVERSAL row: the id of the transaction being reversed.
   * Null on all other transaction types.
   */
  reversedTransactionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reversed_transaction_id',
  },

  // ── Polymorphic reference to source record ─────────────────────────────────

  /**
   * ID of the originating record (e.g. a payment id, journal entry id, etc.)
   */
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reference_id',
  },

  /**
   * Discriminator for referenceId: 'payment', 'journal_entry', 'manual', etc.
   */
  referenceType: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'reference_type',
  },

  transactionDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'transaction_date',
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // ── Audit fields ───────────────────────────────────────────────────────────

  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by',
  },

  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'updated_by',
  },

}, {
  tableName: 'loan_transactions',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// ── Associations ──────────────────────────────────────────────────────────────

const Loan = require('./loanModel');
const User = require('./userModel');

Loan.hasMany(LoanTransaction, { foreignKey: 'loan_id', as: 'transactions' });
LoanTransaction.belongsTo(Loan, { foreignKey: 'loan_id' });

// Self-reference: reversal row → original transaction
LoanTransaction.belongsTo(LoanTransaction, {
  foreignKey: 'reversed_transaction_id',
  as: 'reversedTransaction',
  constraints: false,
});

LoanTransaction.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
LoanTransaction.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

module.exports = LoanTransaction;
