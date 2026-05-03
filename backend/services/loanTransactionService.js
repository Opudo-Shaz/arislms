const LoanTransaction = require('../models/loanTransactionModel');
const logger = require('../config/logger');

const loanTransactionService = {

  /**
   * Persist a single LoanTransaction row.
   * Called directly OR via the loanTransactionEmitter event listener.
   *
   * @param {Object} payload
   * @param {number}  payload.loanId
   * @param {string}  payload.transactionType
   * @param {string}  payload.direction        - 'DEBIT' | 'CREDIT'
   * @param {number}  payload.amount
   * @param {string}  [payload.currency]
   * @param {number}  [payload.principalBalance]
   * @param {number}  [payload.interestBalance]
   * @param {number}  [payload.feesBalance]
   * @param {number}  [payload.penaltiesBalance]
   * @param {number}  [payload.totalBalance]
   * @param {boolean} [payload.isReversed]
   * @param {number}  [payload.reversedTransactionId]
   * @param {number}  [payload.referenceId]
   * @param {string}  [payload.referenceType]
   * @param {Date}    [payload.transactionDate]
   * @param {string}  [payload.notes]
   * @param {number}  [payload.createdBy]
   * @param {Object}  [payload.transaction]    - Sequelize transaction
   * @returns {Promise<LoanTransaction>}
   */
  async recordTransaction(payload) {
    const {
      loanId,
      transactionType,
      direction,
      amount,
      currency = 'KES',
      principalBalance = 0,
      interestBalance = 0,
      feesBalance = 0,
      penaltiesBalance = 0,
      totalBalance = 0,
      isReversed = false,
      reversedTransactionId = null,
      referenceId = null,
      referenceType = null,
      transactionDate = new Date(),
      notes = null,
      createdBy = null,
      transaction = null,
    } = payload;

    if (!loanId || !transactionType || !direction || amount == null) {
      throw new Error('recordTransaction: loanId, transactionType, direction, and amount are required');
    }

    const options = transaction ? { transaction } : {};

    const record = await LoanTransaction.create({
      loanId,
      transactionType,
      direction,
      amount,
      currency,
      principalBalance,
      interestBalance,
      feesBalance,
      penaltiesBalance,
      totalBalance,
      isReversed,
      reversedTransactionId,
      referenceId,
      referenceType,
      transactionDate,
      notes,
      createdBy,
    }, options);

    logger.info(
      `[loanTransactionService] Recorded ${transactionType} ${direction} of ${amount} for loan ${loanId} (tx id: ${record.id})`
    );

    return record;
  },

  /**
   * Reverse a transaction: mark the original as reversed and create a
   * mirror REVERSAL row that restores the balance.
   *
   * @param {number} originalTransactionId
   * @param {Object} options
   * @param {string}  [options.notes]
   * @param {number}  [options.actorId]
   * @param {Object}  [options.transaction]    - Sequelize transaction
   * @returns {Promise<LoanTransaction>} The new REVERSAL row
   */
  async reverseTransaction(originalTransactionId, { notes, actorId, transaction } = {}) {
    const LoanTransactionType = require('../enums/loanTransactionType');
    const options = transaction ? { transaction } : {};

    const original = await LoanTransaction.findByPk(originalTransactionId, options);
    if (!original) throw new Error(`LoanTransaction ${originalTransactionId} not found`);
    if (original.isReversed) throw new Error(`LoanTransaction ${originalTransactionId} is already reversed`);

    // Mark original as reversed
    await original.update({ isReversed: true, updatedBy: actorId || null }, options);

    // Create the reversal row — opposite direction, same amount, same balances
    const reversalDirection = original.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
    const reversal = await LoanTransaction.create({
      loanId: original.loanId,
      transactionType: LoanTransactionType.REVERSAL,
      direction: reversalDirection,
      amount: original.amount,
      currency: original.currency,
      principalBalance: original.principalBalance,
      interestBalance: original.interestBalance,
      feesBalance: original.feesBalance,
      penaltiesBalance: original.penaltiesBalance,
      totalBalance: original.totalBalance,
      isReversed: false,
      reversedTransactionId: original.id,
      referenceId: original.referenceId,
      referenceType: original.referenceType,
      transactionDate: new Date(),
      notes: notes || `Reversal of transaction ${original.id}`,
      createdBy: actorId || null,
    }, options);

    logger.info(
      `[loanTransactionService] Reversed transaction ${original.id} → reversal row ${reversal.id} for loan ${original.loanId}`
    );

    return reversal;
  },

  /**
   * Fetch all transactions for a loan, ordered chronologically.
   *
   * @param {number} loanId
   * @returns {Promise<LoanTransaction[]>}
   */
  async getTransactionsByLoan(loanId) {
    return LoanTransaction.findAll({
      where: { loanId },
      order: [['transaction_date', 'ASC'], ['id', 'ASC']],
      include: [
        { association: 'creator', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { association: 'reversedTransaction', required: false },
      ],
    });
  },

  /**
   * Fetch a single transaction by id.
   *
   * @param {number} id
   * @returns {Promise<LoanTransaction|null>}
   */
  async getTransactionById(id) {
    return LoanTransaction.findByPk(id, {
      include: [
        { association: 'creator', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { association: 'reversedTransaction', required: false },
      ],
    });
  },
};

module.exports = loanTransactionService;
