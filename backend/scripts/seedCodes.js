/**
 * Seed script: inserts example config codes and their values into c_codes / c_code_values.
 * Safe to re-run — uses findOrCreate so existing admin-managed values are never overwritten.
 *
 * Usage:
 *   node backend/scripts/seedCodes.js
 */

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

async function seedCodes() {
  let created = 0;
  let skipped = 0;

  for (const { values, ...codeData } of codes) {
    const [code, codeCreated] = await Code.findOrCreate({
      where: { key: codeData.key },
      defaults: codeData,
    });
    console.log(`  ${codeData.key}: ${codeCreated ? 'inserted' : 'already exists (skipped)'}`);
    codeCreated ? created++ : skipped++;

    for (const valueData of values) {
      const [, valueCreated] = await CodeValue.findOrCreate({
        where: { codeId: code.id, value: valueData.value },
        defaults: { ...valueData, codeId: code.id },
      });
      console.log(`    ${codeData.key}.${valueData.value}: ${valueCreated ? 'inserted' : 'already exists (skipped)'}`);
      valueCreated ? created++ : skipped++;
    }
  }

  return { created, skipped };
}

module.exports = seedCodes;

// Allow standalone execution: node backend/scripts/seedCodes.js
if (require.main === module) {
  const loadEnv = require('../config/env');
  loadEnv({ path: require('path').join(__dirname, '../.env') });
  const sequelize = require('../config/sequalize_db');

  (async () => {
    try {
      await sequelize.authenticate();
      console.log('DB connected.');
      await seedCodes();
      console.log('Done.');
      await sequelize.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
