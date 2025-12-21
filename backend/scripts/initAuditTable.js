const pool = require('./config/db');

/**
 * Initialize audit log table
 * Run this script to create the audit_log table in the database
 */
async function initializeAuditTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS audit_log (
        audit_id        BIGSERIAL PRIMARY KEY,

        entity_type     VARCHAR(100) NOT NULL,
        entity_id       VARCHAR(64)  NOT NULL,

        action          VARCHAR(10)  NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),

        command_as_json JSONB  NULL,

        actor_id        VARCHAR(128) NOT NULL,
        actor_type      VARCHAR(50)  NOT NULL CHECK (actor_type IN ('USER', 'SERVICE', 'SYSTEM')),

        occurred_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        correlation_id  VARCHAR(64) NULL,
        source          VARCHAR(64) NULL
    );
    
    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at ON audit_log(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON audit_log(correlation_id);
  `;

  try {
    console.log('Creating audit_log table...');
    await pool.query(createTableQuery);
    console.log('✓ audit_log table created successfully!');
    await pool.end();
  } catch (error) {
    console.error('Error creating audit_log table:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run the initialization
initializeAuditTable();
