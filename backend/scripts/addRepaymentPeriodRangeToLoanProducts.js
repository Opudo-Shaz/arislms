/**
 * Migration: replace loan_products.repayment_period_months with a
 * min_repayment_period_months / max_repayment_period_months range.
 * Existing products get min = 1 and max = their old repayment period.
 *
 * Run once, BEFORE starting the server on this version:
 *   node scripts/addRepaymentPeriodRangeToLoanProducts.js
 */

const sequelize = require('../config/sequalize_db');

async function run() {
  await sequelize.authenticate();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`
      ALTER TABLE loan_products
      ADD COLUMN IF NOT EXISTS min_repayment_period_months INTEGER,
      ADD COLUMN IF NOT EXISTS max_repayment_period_months INTEGER;
    `, { transaction });

    const [oldColumn] = await sequelize.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'loan_products' AND column_name = 'repayment_period_months';
    `, { transaction });

    if (oldColumn.length) {
      await sequelize.query(`
        UPDATE loan_products
        SET max_repayment_period_months = COALESCE(max_repayment_period_months, repayment_period_months);
      `, { transaction });
    }

    await sequelize.query(`
      UPDATE loan_products
      SET min_repayment_period_months = COALESCE(min_repayment_period_months, 1),
          max_repayment_period_months = COALESCE(max_repayment_period_months, min_repayment_period_months, 1);
    `, { transaction });

    await sequelize.query(`
      ALTER TABLE loan_products
      ALTER COLUMN min_repayment_period_months SET NOT NULL,
      ALTER COLUMN max_repayment_period_months SET NOT NULL;
    `, { transaction });

    if (oldColumn.length) {
      await sequelize.query(`
        ALTER TABLE loan_products DROP COLUMN repayment_period_months;
      `, { transaction });
    }
  });
  console.log('Migration complete: loan_products repayment period replaced with min/max range.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
