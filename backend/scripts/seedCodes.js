/**
 * Seed script: inserts example config codes and their values into c_codes / c_code_values.
 * Safe to re-run — uses findOrCreate so existing admin-managed values are never overwritten.
 *
 * Usage:
 *   node backend/scripts/seedCodes.js
 */

const loadEnv = require('../config/env');
loadEnv({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/sequalize_db');
const Code = require('../models/codeModel');
const CodeValue = require('../models/codeValueModel');

const codes = [
  {
    key: 'GENDER',
    name: 'Gender',
    description: 'Client/user gender options',
    values: [
      { value: 'male', description: 'Male', sortOrder: 1 },
      { value: 'female', description: 'Female', sortOrder: 2 },
      { value: 'other', description: 'Other', sortOrder: 3 },
    ],
  },
  {
    key: 'MARITAL_STATUS',
    name: 'Marital Status',
    description: 'Marital status options',
    values: [
      { value: 'single', description: 'Single', sortOrder: 1 },
      { value: 'married', description: 'Married', sortOrder: 2 },
      { value: 'divorced', description: 'Divorced', sortOrder: 3 },
      { value: 'widowed', description: 'Widowed', sortOrder: 4 },
    ],
  },
];

async function seed() {
  await sequelize.authenticate();
  console.log('DB connected.');

  for (const { values, ...codeData } of codes) {
    const [code, created] = await Code.findOrCreate({
      where: { key: codeData.key },
      defaults: codeData,
    });
    console.log(`  ${codeData.key}: ${created ? 'inserted' : 'already exists (skipped)'}`);

    for (const valueData of values) {
      const [, valueCreated] = await CodeValue.findOrCreate({
        where: { codeId: code.id, value: valueData.value },
        defaults: { ...valueData, codeId: code.id },
      });
      console.log(`    ${codeData.key}.${valueData.value}: ${valueCreated ? 'inserted' : 'already exists (skipped)'}`);
    }
  }

  console.log('Done.');
  await sequelize.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
