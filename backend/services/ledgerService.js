const { Op } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const JournalEntry = require('../models/journalEntryModel');
const JournalEntryLine = require('../models/journalEntryLineModel');
const ChartOfAccount = require('../models/chartOfAccountModel');
const JournalEntryStatus = require('../enums/journalEntryStatus');
const logger = require('../config/logger');
const AuditLogger = require('../utils/auditLogger');
const { CURRENCY_EPSILON } = require('../utils/helpers');

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

  // Build date filter on JournalEntry (the main model) — same approach as
  // getAllJournalEntries which is known to filter correctly.
  const entryWhere = { status: JournalEntryStatus.POSTED };
  if (fromDate || toDate) {
    entryWhere.entryDate = {};
    if (fromDate) entryWhere.entryDate[Op.gte] = fromDate; // DATEONLY — plain string, no new Date()
    if (toDate) entryWhere.entryDate[Op.lte] = toDate;
  }

  const entries = await JournalEntry.findAll({
    where: entryWhere,
    include: [{
      model: JournalEntryLine,
      as: 'lines',
      where: { accountId: account.id },
      required: true,
    }],
    order: [['entry_date', 'ASC'], ['id', 'ASC']],
  });

  let runningBalance = 0;
  const rows = [];

  for (const entry of entries) {
    for (const l of entry.lines) {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      runningBalance += account.normalBalance === 'DEBIT' ? (debit - credit) : (credit - debit);
      rows.push({
        date: entry.entryDate,
        reference: entry.reference,
        description: l.description || entry.description,
        debit,
        credit,
        balance: Number(runningBalance.toFixed(2)),
        loanId: l.loanId,
        clientId: l.clientId,
      });
    }
  }

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

// ─── write-off / provision templates ─────────────────────────────────────────

/**
 * Posts the bad-debt provision entry when a loan is identified as uncollectable.
 * Called automatically when a loan transitions to DEFAULTED status.
 *
 * DR 5002  Bad Debt Expense          (P&L hit — loss recognised now)
 * CR 1300  Provision for Bad Debts   (contra-asset grows)
 *
 * @param {object} loan              - Loan instance
 * @param {number} provisionAmount   - Amount to provision (sum of overdue installments)
 * @param {number} [createdBy]       - User ID (null → system)
 * @param {object} [transaction]     - Sequelize transaction
 */
async function postProvisionEntry(loan, provisionAmount, createdBy, transaction) {
  const amount = Number(provisionAmount);
  if (amount <= 0) return null;

  const entryDate = new Date().toISOString().split('T')[0];

  return postEntry({
    entryDate,
    description: `Bad debt provision – Loan #${loan.id} (${loan.referenceCode})`,
    sourceType: 'PROVISION',
    sourceId: loan.id,
    createdBy: createdBy || AuditLogger.SYSTEM_USER_ID,
    source: createdBy ? 'user' : 'system',
    lines: [
      {
        accountCode: '5002',
        debit: amount,
        description: `Bad debt expense – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
      {
        accountCode: '1300',
        credit: amount,
        description: `Provision for bad debts – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
    ],
  }, transaction);
}

/**
 * Reverses a previously posted provision when a defaulted loan recovers.
 * Called automatically when loan transitions back to ACTIVE / PARTIALLY_PAID.
 *
 * DR 1300  Provision for Bad Debts   (contra-asset shrinks)
 * CR 5002  Bad Debt Expense          (P&L partially restored)
 *
 * @param {object} loan              - Loan instance
 * @param {number} reversalAmount    - Amount to reverse (= loan.provisionedAmount)
 * @param {number} [createdBy]
 * @param {object} [transaction]
 */
async function postProvisionReversalEntry(loan, reversalAmount, createdBy, transaction) {
  const amount = Number(reversalAmount);
  if (amount <= 0) return null;

  const entryDate = new Date().toISOString().split('T')[0];

  return postEntry({
    entryDate,
    description: `Provision reversal – Loan #${loan.id} recovered (${loan.referenceCode})`,
    sourceType: 'PROVISION_REVERSAL',
    sourceId: loan.id,
    createdBy: createdBy || AuditLogger.SYSTEM_USER_ID,
    source: createdBy ? 'user' : 'system',
    lines: [
      {
        accountCode: '1300',
        debit: amount,
        description: `Provision reversal – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
      {
        accountCode: '5002',
        credit: amount,
        description: `Bad debt expense reversed – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
    ],
  }, transaction);
}

/**
 * Posts the formal write-off entry. Zero P&L impact — purely a balance sheet cleanup.
 * If writeOffAmount > provisionedAmount, a top-up provision is posted first (gap → DR 5002 / CR 1300).
 * Then the actual write-off clears the provision against Loans Receivable.
 *
 * Top-up (if needed):
 *   DR 5002  Bad Debt Expense          (gap)
 *   CR 1300  Provision for Bad Debts   (gap)
 *
 * Write-off:
 *   DR 1300  Provision for Bad Debts   = writeOffAmount
 *   CR 1100  Loans Receivable          = writeOffAmount
 *
 * @param {object} loan              - Loan instance (must have provisionedAmount)
 * @param {number} writeOffAmount    - Amount being written off
 * @param {number} [createdBy]
 * @param {object} [transaction]
 * @returns {Promise<{topUp?: object, writeOff: object}>}
 */
async function postWriteOffEntry(loan, writeOffAmount, createdBy, transaction) {
  const amount = Number(writeOffAmount);
  const provisioned = Number(loan.provisionedAmount || 0);
  const entryDate = new Date().toISOString().split('T')[0];
  const result = {};

  // Auto-top-up provision if writeOffAmount exceeds existing provision
  const gap = Number((amount - provisioned).toFixed(2));
  if (gap > CURRENCY_EPSILON) {
    result.topUp = await postEntry({
      entryDate,
      description: `Provision top-up before write-off – Loan #${loan.id} (${loan.referenceCode})`,
      sourceType: 'PROVISION',
      sourceId: loan.id,
      createdBy: createdBy || AuditLogger.SYSTEM_USER_ID,
      source: createdBy ? 'user' : 'system',
      lines: [
        {
          accountCode: '5002',
          debit: gap,
          description: `Bad debt expense top-up – Loan #${loan.id}`,
          loanId: loan.id,
          clientId: loan.clientId,
        },
        {
          accountCode: '1300',
          credit: gap,
          description: `Provision top-up – Loan #${loan.id}`,
          loanId: loan.id,
          clientId: loan.clientId,
        },
      ],
    }, transaction);
  }

  // Formal write-off: DR 1300, CR 1100 (balance sheet only — no P&L impact)
  result.writeOff = await postEntry({
    entryDate,
    description: `Loan write-off – Loan #${loan.id} (${loan.referenceCode})`,
    sourceType: 'WRITE_OFF',
    sourceId: loan.id,
    createdBy: createdBy || AuditLogger.SYSTEM_USER_ID,
    source: createdBy ? 'user' : 'system',
    lines: [
      {
        accountCode: '1300',
        debit: amount,
        description: `Provision used for write-off – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
      {
        accountCode: '1100',
        credit: amount,
        description: `Loans Receivable written off – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
    ],
  }, transaction);

  return result;
}

/**
 * Posts a recovery entry when cash is received on a previously written-off loan.
 *
 * DR 1001  Cash / Bank               = recoveryAmount
 * CR 1300  Provision for Bad Debts   = recoveryAmount   (partially restores the contra-asset)
 *
 * @param {object} loan              - Loan instance
 * @param {number} recoveryAmount    - Cash received
 * @param {number} [paymentId]       - Source payment record ID
 * @param {number} [createdBy]
 * @param {object} [transaction]
 */
async function postRecoveryEntry(loan, recoveryAmount, paymentId, createdBy, transaction) {
  const amount = Number(recoveryAmount);
  if (amount <= 0) return null;

  const entryDate = new Date().toISOString().split('T')[0];

  return postEntry({
    entryDate,
    description: `Recovery on written-off Loan #${loan.id} (${loan.referenceCode})`,
    sourceType: 'RECOVERY',
    sourceId: paymentId || loan.id,
    createdBy: createdBy || AuditLogger.SYSTEM_USER_ID,
    source: createdBy ? 'user' : 'system',
    lines: [
      {
        accountCode: '1001',
        debit: amount,
        description: `Cash recovery – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
      {
        accountCode: '1300',
        credit: amount,
        description: `Provision reduced by recovery – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
    ],
  }, transaction);
}

/**
 * Posts the collection of a loan downpayment received before disbursement.
 *
 * DR 1001  Cash / Bank              = amount
 * CR 2100  Loan Downpayments Held   = amount   (liability until disbursement / refund)
 *
 * @param {object} loan          - Loan instance
 * @param {number} amount        - Downpayment collected
 * @param {number} [createdBy]
 * @param {object} [transaction]
 */
async function postDownPaymentCollectionEntry(loan, amount, createdBy, transaction) {
  const value = Number(amount);
  if (value <= 0) return null;

  return postEntry({
    entryDate: new Date().toISOString().split('T')[0],
    description: `Downpayment received – Loan #${loan.id} (${loan.referenceCode})`,
    sourceType: 'DOWNPAYMENT',
    sourceId: loan.id,
    createdBy: createdBy || AuditLogger.SYSTEM_USER_ID,
    source: createdBy ? 'user' : 'system',
    lines: [
      {
        accountCode: '1001',
        debit: value,
        description: `Cash received – downpayment Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
      {
        accountCode: '2100',
        credit: value,
        description: `Downpayment held – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
    ],
  }, transaction);
}

/**
 * Applies a held downpayment against the loan principal at disbursement. The
 * repayment schedule is generated on the net (post-downpayment) principal, so
 * this entry reduces the receivable to match. Principal only — no interest.
 *
 * DR 2100  Loan Downpayments Held   = amount   (clears the liability)
 * CR 1100  Loans Receivable         = amount   (reduces principal owed)
 *
 * @param {object} loan          - Loan instance
 * @param {number} amount        - Held downpayment being applied
 * @param {number} [createdBy]
 * @param {object} [transaction]
 */
async function postDownPaymentApplicationEntry(loan, amount, createdBy, transaction) {
  const value = Number(amount);
  if (value <= 0) return null;

  return postEntry({
    entryDate: loan.disbursementDate || new Date().toISOString().split('T')[0],
    description: `Downpayment applied to principal – Loan #${loan.id} (${loan.referenceCode})`,
    sourceType: 'DOWNPAYMENT',
    sourceId: loan.id,
    createdBy: createdBy || AuditLogger.SYSTEM_USER_ID,
    source: createdBy ? 'user' : 'system',
    lines: [
      {
        accountCode: '2100',
        debit: value,
        description: `Downpayment released – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
      {
        accountCode: '1100',
        credit: value,
        description: `Principal reduced by downpayment – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
    ],
  }, transaction);
}

/**
 * Transfers a held downpayment to member contributions when a loan is deleted
 * before disbursement (the borrower's money becomes their savings/equity).
 *
 * DR 2100  Loan Downpayments Held   = amount   (clears the liability)
 * CR 3001  Member Contributions     = amount   (borrower equity)
 *
 * @param {object} loan          - Loan instance
 * @param {number} amount        - Held downpayment being transferred
 * @param {number} [createdBy]
 * @param {object} [transaction]
 */
async function postDownPaymentToContributionEntry(loan, amount, createdBy, transaction) {
  const value = Number(amount);
  if (value <= 0) return null;

  return postEntry({
    entryDate: new Date().toISOString().split('T')[0],
    description: `Downpayment transferred to member contributions – Loan #${loan.id} (${loan.referenceCode})`,
    sourceType: 'DOWNPAYMENT',
    sourceId: loan.id,
    createdBy: createdBy || AuditLogger.SYSTEM_USER_ID,
    source: createdBy ? 'user' : 'system',
    lines: [
      {
        accountCode: '2100',
        debit: value,
        description: `Downpayment released on deletion – Loan #${loan.id}`,
        loanId: loan.id,
        clientId: loan.clientId,
      },
      {
        accountCode: '3001',
        credit: value,
        description: `Member contribution from downpayment – Loan #${loan.id}`,
        clientId: loan.clientId,
      },
    ],
  }, transaction);
}

module.exports = {
  postEntry,
  postDisbursementEntry,
  postPaymentEntry,
  postProvisionEntry,
  postProvisionReversalEntry,
  postWriteOffEntry,
  postRecoveryEntry,
  postDownPaymentCollectionEntry,
  postDownPaymentApplicationEntry,
  postDownPaymentToContributionEntry,
  reverseEntry,
  getAvailableFunds,
  getTrialBalance,
  getAccountStatement,
  getIncomeSummary,
  getAllJournalEntries,
};
