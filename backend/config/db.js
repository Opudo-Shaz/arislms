const { Pool } = require('pg');

const pool = new Pool({
  user: 'root',
  host: 'localhost',
  database: 'arislms_db',   
  password: '12345@NOT',
  port: 5432,
});

module.exports = pool;
                                                 