const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const Client = sequelize.define('Client', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  referenceCode: { type: DataTypes.STRING(64), unique: true, field: 'reference_code' },
  firstName: { type: DataTypes.STRING(100), allowNull: false, field: 'first_name' },
  lastName: { type: DataTypes.STRING(100), allowNull: false, field: 'last_name' },
  email: { type: DataTypes.STRING(255), unique: true },
  phone: { type: DataTypes.STRING(32) },
  secondaryPhone: { type: DataTypes.STRING(32), field: 'secondary_phone' },
  dateOfBirth: { type: DataTypes.DATEONLY, field: 'date_of_birth' },
  gender: { type: DataTypes.STRING(16) },
  occupation: { type: DataTypes.STRING(128) },
  employer: { type: DataTypes.STRING(128) },
  monthlyIncome: { type: DataTypes.DECIMAL(12,2), field: 'monthly_income' },
  address: { type: DataTypes.JSONB },
  createdBy: { type: DataTypes.INTEGER, allowNull: false, field: 'created_by' },
  idDocumentType: { type: DataTypes.STRING(32), field: 'id_document_type' },
  idDocumentNumber: { type: DataTypes.STRING(255), field: 'id_document_number' }, 
  idDocumentImages: { type: DataTypes.JSONB, field: 'id_document_images' },
  kycStatus: { type: DataTypes.STRING(20), defaultValue: 'not_started', field: 'kyc_status' },
  kycVerifiedAt: { type: DataTypes.DATE, field: 'kyc_verified_at' },
  verifiedBy: { type: DataTypes.INTEGER, field: 'verified_by' },
  riskScore: { type: DataTypes.DECIMAL(5,2), field: 'risk_score' },
  preferredContactMethod: { type: DataTypes.STRING(16), field: 'preferred_contact_method' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended', 'blacklisted'),
    defaultValue: 'active',
    allowNull: false
  },

  notes: { type: DataTypes.TEXT },
}, {
  tableName: 'clients',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Client;