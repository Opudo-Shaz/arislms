const { Op } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const JournalEntry = require('../models/journalEntryModel');
const JournalEntryLine = require('../models/journalEntryLineModel');
const ChartOfAccount = require('../models/chartOfAccountModel');
const JournalEntryStatus = require('../enums/journalEntryStatus');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a sequential reference like "JE-00042".
 * Reads the latest entry from the DB to determine the next number.
 */
async function generateReference(transaction) {
  const latest = await JournalEntry.findOne({
    order: [['id', 'DESC']],
    transaction,
  });
  const next = latest ? latest.id + 1 : 1;
  return `JE-${String(next).padStart(5, '0')}`;
}

/**
 * Resolves an account code to its DB id.
 * Throws if the code does not exist.
 */
async function resolveAccountId(code, transaction) {
  const account = await ChartOfAccount.findOne({ where: { code }, transaction });
  if (!account) throw new Error(`Chart of account '${code}' not found`);
  return account.id;
}

// ─── core post ────────────────────────────────────────────────────────────────

/**
 * Posts a balanced journal entry.
 *
 * @param {object} opts
 * @param {string}   opts.entryDate   - ISO date string
 * @param {string}   opts.description
 * @param {string}   opts.sourceType  - LOAN_DISBURSEMENT | PAYMENT | CONTRIBUTION | MANUAL | FEE | EXPENSE | REVERSAL
 * @param {number}   [opts.sourceId]  - FK to the originating record
 * @param {number}   [opts.createdBy]
 * @param {number}   [opts.reversalOfId] - set when reversing an existing entry
 * @param {Array<{
 *   accountCode: string,
 *   debit?:  number,
 *   credit?: number,
 *   description?: string,
 *   loanId?: number,
 *   clientId?: number
 * }>} opts.lines
 * @param {object}   [externalTransaction] - existing Sequelize transaction to join
 */
async function postEntry(opts, externalTransaction) {
  const { entryDate, description, sourceType, sourceId, createdBy, reversalOfId, source, lines } = opts;

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Journal entry is not balanced: debits=${totalDebit.toFixed(2)}, credits=${totalCredit.toFixed(2)}`
    );
  }

  const useOwnTransaction = !externalTransaction;
  const t = externalTransaction || await sequelize.transaction();

  try {
    const reference = await generateReference(t);

    const entry = await JournalEntry.create({
      reference,
      entryDate,
      description,
      status: JournalEntryStatus.POSTED,
      sourceType,
      sourceId: sourceId || null,
      reversalOfId: reversalOfId || null,
      createdBy: createdBy || null,
    }, { transaction: t });

    const lineRecords = await Promise.all(lines.map(async (l) => {
      const accountId = await resolveAccountId(l.accountCode, t);
      return JournalEntryLine.create({
        journalEntryId: entry.id,
        accountId,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        description: l.description || null,
        loanId: l.loanId || null,
        clientId: l.clientId || null,
      }, { transaction: t });
    }));

    if (useOwnTransaction) await t.commit();

    logger.info(`Journal entry ${entry.reference} posted (${sourceType}, ${lines.length} lines)`);

    await AuditLogger.log({
      entityType: 'JOURNAL_ENTRY',
      entityId: entry.id,
      action: 'CREATE',
      data: { reference: entry.reference, sourceType, sourceId: sourceId || null, lineCount: lines.length },
      actorId: createdBy || AuditLogger.SYSTEM_USER_ID,
      options: { actorType: createdBy ? 'USER' : 'SYSTEM', source: source || 'system' },
    });

    return { entry, lines: lineRecords };

  } catch (err) {
    if (useOwnTransaction) await t.rollback();
    logger.error(`Failed to post journal entry: ${err.message}`);
    throw err;
  }
}

// ─── auto-posting templates ───────────────────────────────────────────────────

/**
 * Posts the disbursement entry for a loan.
 * DR 1100 Loans Receivable (principal)
 * CR 1001 Cash / Bank       (principal)
 * DR 1001 Cash / Bank       (fees, if any)  — fees collected upfront
 * CR 4002 Loan Service Fees  (fees, if any)
 */
async function postDisbursementEntry(loan, transaction) {
  const principal = Number(loan.principalAmount);
  const fees = Number(loan.fees || 0);
  const entryDate = loan.disbursementDate || new Date().toISOString().split('T')[0];

  const lines = [
    {
      accountCode: '1100',
      debit: principal,
      description: `Principal disbursed – Loan #${loan.id}`,
      loanId: loan.id,
      clientId: loan.clientId,
    },
    {
      accountCode: '1001',
      credit: principal,
      description: `Cash out – Loan #${loan.id} disbursement`,
      loanId: loan.id,
    },
  ];

  if (fees > 0) {
    lines.push(
      {
        accountCode: '1001',
        debit: fees,
        description: `Origination fees collected – Loan #${loan.id}`,
        loanId: loan.id,
      },
      {
        accountCode: '4002',
        credit: fees,
        description: `Loan service fee income – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      }
    );
  }

  return postEntry({
    entryDate,
    description: `Loan #${loan.id} disbursement to client #${loan.clientId}`,
    sourceType: 'LOAN_DISBURSEMENT',
    sourceId: loan.id,
    createdBy: AuditLogger.SYSTEM_USER_ID,
    source: 'system',
    lines,
  }, transaction);
}

/**
 * Posts the payment received entry.
 * DR 1001 Cash / Bank           (total payment = loan portion + surplus)
 * CR 1100 Loans Receivable       (principal portion)
 * CR 4001 Interest Income        (interest portion)
 * CR 3001 Member Contributions   (overpayment surplus, if any)
 *
 * @param {object} payment
 * @param {object} loan
 * @param {object} transaction
 * @param {number} [surplus=0] - Overpayment amount to credit to member contributions (account 3001)
 */
async function postPaymentEntry(payment, loan, transaction, surplus = 0) {
  const total = Number(payment.amount);
  const principal = Number(payment.appliedToPrincipal);
  const interest = Number(payment.appliedToInterest);
  const overpayment = Number(surplus || 0);
  const entryDate = (payment.paymentDate || new Date()).toISOString
    ? new Date(payment.paymentDate || new Date()).toISOString().split('T')[0]
    : String(payment.paymentDate);

  const lines = [
    {
      accountCode: '1001',
      debit: total,
      description: `Payment received  Payment #${payment.id} on Loan #${loan.id}`,
      loanId: loan.id,
      clientId: loan.clientId,
    },
  ];

  if (principal > 0) {
    lines.push({
      accountCode: '1100',
      credit: principal,
      description: `Principal repaid – Payment #${payment.id}`,
      loanId: loan.id,
      clientId: loan.clientId,
    });
  }

  if (interest > 0) {
    lines.push({
      accountCode: '4001',
      credit: interest,
      description: `Interest income – Payment #${payment.id}`,
      loanId: loan.id,
      clientId: loan.clientId,
    });
  }

  if (overpayment > 0) {
    lines.push({
      accountCode: '3001',
      credit: overpayment,
      description: `Overpayment credit – Payment #${payment.id} on Loan #${loan.id}`,
      clientId: loan.clientId,
    });
  }

  // Guard: absorb any floating-point rounding gap (< 1 cent) into the last credit line
  const creditSum = principal + interest + overpayment;
  if (Math.abs(total - creditSum) > 0.001 && creditSum > 0) {
    const diff = Number((total - creditSum).toFixed(2));
    lines[lines.length - 1].credit = Number((lines[lines.length - 1].credit + diff).toFixed(2));
  }

  return postEntry({
    entryDate,
    description: `Payment #${payment.id} on Loan #${loan.id}`,
    sourceType: 'PAYMENT',
    sourceId: payment.id,
    createdBy: AuditLogger.SYSTEM_USER_ID,
    source: 'system',
    lines,
  }, transaction);
}

/**
 * Reverses a POSTED journal entry by creating an equal-and-opposite entry
 * and marking the original as REVERSED.
 */
async function reverseEntry(journalEntryId, description, createdBy, source) {
  const t = await sequelize.transaction();
  try {
    const original = await JournalEntry.findByPk(journalEntryId, {
      include: [{ association: 'lines', include: [{ association: 'account' }] }],
      transaction: t,
    });

    if (!original) throw new Error(`Journal entry ${journalEntryId} not found`);
    if (original.status !== JournalEntryStatus.POSTED) {
      throw new Error(`Only POSTED entries can be reversed. Current status: ${original.status}`);
    }

    // Flip debit/credit on every line
    const reversalLines = original.lines.map(l => ({
      accountCode: l.account.code,
      debit: Number(l.credit),
      credit: Number(l.debit),
      description: l.description,
      loanId: l.loanId,
      clientId: l.clientId,
    }));

    const { entry: reversalEntry } = await postEntry({
      entryDate: new Date().toISOString().split('T')[0],
      description: description || `Reversal of ${original.reference}`,
      sourceType: 'REVERSAL',
      sourceId: original.id,
      reversalOfId: original.id,
      createdBy,
      source,
      lines: reversalLines,
    }, t);

    await original.update({ status: JournalEntryStatus.REVERSED }, { transaction: t });

    await t.commit();
    logger.info(`Entry ${original.reference} reversed → ${reversalEntry.reference}`);

    await AuditLogger.log({
      entityType: 'JOURNAL_ENTRY',
      entityId: original.id,
      action: 'REVERSE',
      data: {
        originalReference: original.reference,
        reversalReference: reversalEntry.reference,
        reversalEntryId: reversalEntry.id,
        reason: description || null,
      },
      actorId: createdBy || AuditLogger.SYSTEM_USER_ID,
      options: { actorType: createdBy ? 'USER' : 'SYSTEM', source: source || 'system' },
    });

    return { original, reversal: reversalEntry };

  } catch (err) {
    await t.rollback();
    logger.error(`Error reversing entry ${journalEntryId}: ${err.message}`);
    throw err;
  }
}

// ─── reporting queries ────────────────────────────────────────────────────────

/**
 * Returns the cash balance of account 1001 — the exact amount available
 * for lending or operations.
 */
async function getAvailableFunds() {
  const chartOfAccountService = require('./chartOfAccountService');
  return chartOfAccountService.getAccountBalance('1001');
}

/**
 * Returns balances for every active account as of a given date.
 * sum(all debits) should equal sum(all credits) — use this to verify books.
 */
async function getTrialBalance(asOfDate) {
  const accounts = await ChartOfAccount.findAll({
    where: { isActive: true },
    order: [['code', 'ASC']],
  });

  const dateFilter = asOfDate ? { [Op.lte]: new Date(asOfDate) } : undefined;

  const rows = await Promise.all(accounts.map(async (account) => {
    const lines = await JournalEntryLine.findAll({
      where: { accountId: account.id },
      include: [{
        model: JournalEntry,
        where: {
          status: JournalEntryStatus.POSTED,
          ...(dateFilter ? { entryDate: dateFilter } : {}),
        },
        required: true,
      }],
    });

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
    const balance = account.normalBalance === 'DEBIT'
      ? totalDebit - totalCredit
      : totalCredit - totalDebit;

    return {
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      balance: Number(balance.toFixed(2)),
    };
  }));

  const grandDebit = Number(rows.reduce((s, r) => s + r.totalDebit, 0).toFixed(2));
  const grandCredit = Number(rows.reduce((s, r) => s + r.totalCredit, 0).toFixed(2));

  return { accounts: rows, grandDebit, grandCredit, balanced: Math.abs(grandDebit - grandCredit) <= 0.01 };
}

/**
 * Returns all journal entry lines for one account within a date range,
 * useful for a bank/ledger statement view.
 */
async function getAccountStatement(accountCode, fromDate, toDate) {
  const account = await ChartOfAccount.findOne({ where: { code: accountCode } });
  if (!account) throw new Error(`Account '${accountCode}' not found`);

  const dateWhere = {};
  if (fromDate) dateWhere[Op.gte] = new Date(fromDate);
  if (toDate) dateWhere[Op.lte] = new Date(toDate);

  const lines = await JournalEntryLine.findAll({
    where: { accountId: account.id },
    include: [{
      model: JournalEntry,
      where: {
        status: JournalEntryStatus.POSTED,
        ...(Object.keys(dateWhere).length ? { entryDate: dateWhere } : {}),
      },
      required: true,
    }],
    order: [[JournalEntry, 'entryDate', 'ASC'], [JournalEntry, 'id', 'ASC']],
  });

  let runningBalance = 0;
  const rows = lines.map(l => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    runningBalance += account.normalBalance === 'DEBIT' ? (debit - credit) : (credit - debit);
    return {
      date: l.JournalEntry.entryDate,
      reference: l.JournalEntry.reference,
      description: l.description || l.JournalEntry.description,
      debit,
      credit,
      balance: Number(runningBalance.toFixed(2)),
      loanId: l.loanId,
      clientId: l.clientId,
    };
  });

  return { account, rows };
}

/**
 * Returns income vs expense summary for a period.
 */
async function getIncomeSummary(fromDate, toDate) {
  const AccountType = require('../enums/accountType');
  const accounts = await ChartOfAccount.findAll({
    where: { type: [AccountType.REVENUE, AccountType.EXPENSE], isActive: true },
    order: [['code', 'ASC']],
  });

  const dateWhere = {};
  if (fromDate) dateWhere[Op.gte] = new Date(fromDate);
  if (toDate) dateWhere[Op.lte] = new Date(toDate);

  const rows = await Promise.all(accounts.map(async (account) => {
    const lines = await JournalEntryLine.findAll({
      where: { accountId: account.id },
      include: [{
        model: JournalEntry,
        where: {
          status: JournalEntryStatus.POSTED,
          ...(Object.keys(dateWhere).length ? { entryDate: dateWhere } : {}),
        },
        required: true,
      }],
    });

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
    const balance = account.normalBalance === 'DEBIT'
      ? totalDebit - totalCredit
      : totalCredit - totalDebit;

    return { code: account.code, name: account.name, type: account.type, balance: Number(balance.toFixed(2)) };
  }));

  const totalRevenue = rows.filter(r => r.type === AccountType.REVENUE).reduce((s, r) => s + r.balance, 0);
  const totalExpenses = rows.filter(r => r.type === AccountType.EXPENSE).reduce((s, r) => s + r.balance, 0);

  return {
    accounts: rows,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    netIncome: Number((totalRevenue - totalExpenses).toFixed(2)),
  };
}

/**
 * Returns paginated journal entries, optionally filtered.
 */
async function getAllJournalEntries({ sourceType, fromDate, toDate, page = 1, limit = 20 } = {}) {
  const where = {};
  if (sourceType) where.sourceType = sourceType;
  if (fromDate || toDate) {
    where.entryDate = {};
    if (fromDate) where.entryDate[Op.gte] = new Date(fromDate);
    if (toDate) where.entryDate[Op.lte] = new Date(toDate);
  }

  const offset = (page - 1) * limit;
  const { count, rows } = await JournalEntry.findAndCountAll({
    where,
    include: [{ association: 'lines', include: [{ association: 'account' }] }],
    order: [['entry_date', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
  });

  return { total: count, page, limit, entries: rows };
}

module.exports = {
  postEntry,
  postDisbursementEntry,
  postPaymentEntry,
  reverseEntry,
  getAvailableFunds,
  getTrialBalance,
  getAccountStatement,
  getIncomeSummary,
  getAllJournalEntries,
};
