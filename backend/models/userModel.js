const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequalize_db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  id_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING(20),
    defaultValue: 'member',
  },
  group_code: {
    type: DataTypes.STRING(10),
  },
  password: {
    type: DataTypes.STRING(255),
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull :true,
  },
}, {
  tableName: 'users',   
  timestamps: false,    
  freezeTableName: true 
});

module.exports = User;
