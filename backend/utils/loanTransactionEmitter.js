/**
 * loanTransactionEmitter
 *
 * A singleton EventEmitter that acts as an in-process business event bus for
 * loan transaction events. Any service can emit a `loan.transaction` event
 * after a business operation and the listener registered here will persist
 * the corresponding LoanTransaction row automatically.
 *
 * Usage — emitting:
 *   const { emitLoanTransaction } = require('../utils/loanTransactionEmitter');
 *   emitLoanTransaction({ loanId, transactionType, direction, amount, ... });
 *
 * The emitter is registered (listeners wired up) by calling
 * `registerLoanTransactionListeners()` once at application startup (server.js).
 */

const EventEmitter = require('events');
const logger = require('../config/logger');

const emitter = new EventEmitter();
emitter.setMaxListeners(20);

const LOAN_TRANSACTION_EVENT = 'loan.transaction';

/**
 * Emit a loan transaction business event.
 *
 * @param {Object} payload
 * @param {number}  payload.loanId
 * @param {string}  payload.transactionType    - LoanTransactionType enum value
 * @param {string}  payload.direction          - 'DEBIT' | 'CREDIT'
 * @param {number}  payload.amount
 * @param {string}  [payload.currency]
 * @param {number}  [payload.principalBalance]
 * @param {number}  [payload.interestBalance]
 * @param {number}  [payload.feesBalance]
 * @param {number}  [payload.penaltiesBalance]
 * @param {number}  [payload.totalBalance]
 * @param {number}  [payload.referenceId]
 * @param {string}  [payload.referenceType]
 * @param {Date}    [payload.transactionDate]
 * @param {string}  [payload.notes]
 * @param {number}  [payload.createdBy]
 * @param {Object}  [payload.transaction]      - Sequelize transaction for atomicity
 */
function emitLoanTransaction(payload) {
  emitter.emit(LOAN_TRANSACTION_EVENT, payload);
}

/**
 * Register all loan transaction event listeners.
 * Call this once at server startup AFTER models are loaded.
 */
function registerLoanTransactionListeners() {
  const loanTransactionService = require('../services/loanTransactionService');

  emitter.on(LOAN_TRANSACTION_EVENT, async (payload) => {
    try {
      await loanTransactionService.recordTransaction(payload);
    } catch (err) {
      // Log but never crash the calling service — transactions are
      // secondary records and should not block the primary operation.
      logger.error(`[loanTransactionEmitter] Failed to record loan transaction: ${err.message}`, {
        loanId: payload?.loanId,
        transactionType: payload?.transactionType,
        error: err.message,
      });
    }
  });

  logger.info('[loanTransactionEmitter] Loan transaction listeners registered');
}

module.exports = { emitLoanTransaction, registerLoanTransactionListeners, LOAN_TRANSACTION_EVENT };
