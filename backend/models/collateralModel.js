const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');
const CollateralStatus = require('../enums/collateralStatus');

const Collateral = sequelize.define('Collateral', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  loanId: { type: DataTypes.INTEGER, allowNull: false, field: 'loan_id' },
  clientId: { type: DataTypes.INTEGER, allowNull: false, field: 'client_id' },
  loanProductId: { type: DataTypes.INTEGER, allowNull: false, field: 'loan_product_id' },

  collateralType: { type: DataTypes.STRING(50), allowNull: false, field: 'collateral_type' },
  description: { type: DataTypes.TEXT, allowNull: false },
  referenceNumber: { type: DataTypes.STRING(128), field: 'reference_number' },
  registrationNumber: { type: DataTypes.STRING(128), field: 'registration_number' },
  estimatedValue: { type: DataTypes.DECIMAL(14, 2), field: 'estimated_value' },

  status: {
    type: DataTypes.ENUM(Object.values(CollateralStatus)),
    allowNull: false,
    defaultValue: CollateralStatus.PLEDGED
  },

  metadata: { type: DataTypes.JSONB },
  notes: { type: DataTypes.TEXT },

  verifiedBy: { type: DataTypes.INTEGER, field: 'verified_by' },
  verifiedAt: { type: DataTypes.DATE, field: 'verified_at' },
  releasedBy: { type: DataTypes.INTEGER, field: 'released_by' },
  releasedAt: { type: DataTypes.DATE, field: 'released_at' },
  liquidatedBy: { type: DataTypes.INTEGER, field: 'liquidated_by' },
  liquidatedAt: { type: DataTypes.DATE, field: 'liquidated_at' },

  createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'updated_by' }
}, {
  tableName: 'collaterals',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Collateral;