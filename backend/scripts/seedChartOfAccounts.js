/**
 * Seed script: populates the chart_of_accounts table with the default
 * accounts for the savings-group lending system.
 *
 * Usage:
 *   node backend/scripts/seedChartOfAccounts.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');
const ChartOfAccount = require('../models/chartOfAccountModel');
const AccountType = require('../enums/accountType');

const defaultAccounts = [
  {
    code: '1001',
    name: 'Cash / Bank Account',
    type: AccountType.ASSET,
    normalBalance: 'DEBIT',
    description: 'Tracks incoming member contributions, loan repayments and outgoing disbursements/expenses',
  },
  {
    code: '1100',
    name: 'Loans Receivable – Principal',
    type: AccountType.ASSET,
    normalBalance: 'DEBIT',
    description: 'Total principal lent out that is still owed by borrowers',
  },
  {
    code: '1200',
    name: 'Interest Receivable',
    type: AccountType.ASSET,
    normalBalance: 'DEBIT',
    description: 'Accrued interest earned but not yet received (used if switching to accrual basis)',
  },
  {
    code: '1300',
    name: 'Provision for Bad Debts',
    type: AccountType.ASSET,
    normalBalance: 'CREDIT',
    description: 'Contra-asset: estimated portion of Loans Receivable not expected to be collected',
  },
  {
    code: '2001',
    name: 'Accounts Payable',
    type: AccountType.LIABILITY,
    normalBalance: 'CREDIT',
    description: 'Short-term obligations for business expenses (software fees, legal fees, etc.)',
  },
  {
    code: '3001',
    name: 'Member Contributions',
    type: AccountType.EQUITY,
    normalBalance: 'CREDIT',
    description: 'Capital pooled by members; subsidiary ledger tracks per-member balance via clientId on journal lines',
  },
  {
    code: '3002',
    name: 'Retained Earnings / Surplus',
    type: AccountType.EQUITY,
    normalBalance: 'CREDIT',
    description: 'Accumulated earnings after expenses; increased at period-end close',
  },
  {
    code: '4001',
    name: 'Interest Income',
    type: AccountType.REVENUE,
    normalBalance: 'CREDIT',
    description: 'Interest earned on loans (cash basis: recognised when payment is received)',
  },
  {
    code: '4002',
    name: 'Loan Service Fees Income',
    type: AccountType.REVENUE,
    normalBalance: 'CREDIT',
    description: 'Origination, processing or underwriting fees collected at disbursement',
  },
  {
    code: '4003',
    name: 'Late Fee Income',
    type: AccountType.REVENUE,
    normalBalance: 'CREDIT',
    description: 'Penalties charged to borrowers for late payments',
  },
  {
    code: '5001',
    name: 'Office / Software Expenses',
    type: AccountType.EXPENSE,
    normalBalance: 'DEBIT',
    description: 'Costs for loan servicing software, office maintenance and similar operational expenses',
  },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    let created = 0;
    let skipped = 0;

    for (const account of defaultAccounts) {
      const [, wasCreated] = await ChartOfAccount.findOrCreate({
        where: { code: account.code },
        defaults: account,
      });
      if (wasCreated) {
        console.log(`  ✓ Created [${account.code}] ${account.name}`);
        created++;
      } else {
        console.log(`  – Skipped [${account.code}] ${account.name} (already exists)`);
        skipped++;
      }
    }

    console.log(`\nSeed complete: ${created} created, ${skipped} skipped.`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
