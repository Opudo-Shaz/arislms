const { DataTypes } = require('sequelize')
const sequelize = require('../config/sequalize_db')

/**
 * CronJobRun
 *
 * One row per execution (scheduled or manual) of a registered cron job.
 * Provides run history/visibility so admins can see when a job last ran,
 * whether it succeeded, and the result summary — surviving server restarts.
 */
const CronJobRun = sequelize.define(
  'CronJobRun',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // Registry key of the job (e.g. 'loan-status')
    jobKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'job_key',
    },

    // running | success | failed
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'running',
    },

    // SYSTEM (scheduler) | USER (manual trigger)
    triggeredBy: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'SYSTEM',
      field: 'triggered_by',
    },

    // User id when manually triggered
    triggeredById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'triggered_by_id',
    },

    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'started_at',
    },

    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'finished_at',
    },

    durationMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'duration_ms',
    },

    // Result summary returned by the job handler
    summary: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // Error message when status = 'failed'
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'cron_job_runs',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['job_key', 'started_at'] }],
  },
)

module.exports = CronJobRun
