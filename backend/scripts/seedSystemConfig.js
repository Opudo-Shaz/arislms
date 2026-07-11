/**
 * Seed script: inserts default system configuration entries.
 * Safe to re-run — uses upsert so existing values are not overwritten.
 *
 * Usage:
 *   node backend/scripts/seedSystemConfig.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');
const SystemConfig = require('../models/systemConfigModel');

const defaults = [
  {
    key: 'payment.min_overpayment_surplus',
    label: 'Minimum Overpayment Surplus',
    value: '1',
    category: 'loans',
    description:
      'Overpayment amounts below this threshold (in the loan currency) are treated as ' +
      'immaterial rounding noise. They are absorbed into the payment instead of being ' +
      'posted as a separate member-contribution record and journal line.',
    isBoolean: false,
    isActive: true,
    isReadOnly: false,
  },
];

async function seed() {
  await sequelize.authenticate();
  console.log('DB connected.');

  for (const entry of defaults) {
    const [, created] = await SystemConfig.findOrCreate({
      where: { key: entry.key },
      defaults: entry,
    });
    console.log(`  ${entry.key}: ${created ? 'inserted' : 'already exists (skipped)'}`);
  }

  console.log('Done.');
  await sequelize.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
