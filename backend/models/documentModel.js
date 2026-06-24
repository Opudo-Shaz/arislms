const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const DocumentType = require('../enums/documentType');
const DocumentCategory = require('../enums/documentCategory');
const DocumentStatus = require('../enums/documentStatus');

const Document = sequelize.define('Document', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  // Classification
  documentType: {
    type: DataTypes.ENUM(Object.values(DocumentType)),
    allowNull: false,
    field: 'document_type',
  },
  documentCategory: {
    type: DataTypes.ENUM(Object.values(DocumentCategory)),
    allowNull: false,
    field: 'document_category',
  },

  // References — all nullable; at least one should be set
  userId:       { type: DataTypes.INTEGER, allowNull: true, field: 'user_id' },
  clientId:     { type: DataTypes.INTEGER, allowNull: true, field: 'client_id' },
  loanId:       { type: DataTypes.INTEGER, allowNull: true, field: 'loan_id' },
  collateralId: { type: DataTypes.INTEGER, allowNull: true, field: 'collateral_id' },

  // File metadata
  originalName: { type: DataTypes.STRING(255), allowNull: false, field: 'original_name' },
  storedName:   { type: DataTypes.STRING(512), allowNull: false, field: 'stored_name' },
  documentLink: { type: DataTypes.STRING(2048), allowNull: true, field: 'document_link' },
  mimeType:     { type: DataTypes.STRING(128), field: 'mime_type' },
  fileSize:     { type: DataTypes.BIGINT, field: 'file_size' },     // bytes

  // Storage provider: local | s3 | minio | gcs
  storageProvider: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'local',
    field: 'storage_provider',
  },

  // Lifecycle
  status: {
    type: DataTypes.ENUM(Object.values(DocumentStatus)),
    allowNull: false,
    defaultValue: DocumentStatus.ACTIVE,
  },
  expiresAt: { type: DataTypes.DATEONLY, allowNull: true, field: 'expires_at' },

  // Extra
  description: { type: DataTypes.TEXT, allowNull: true },

  // Audit actors
  createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' },
  deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
}, {
  tableName: 'documents',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Document;
