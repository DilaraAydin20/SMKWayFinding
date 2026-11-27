import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const SyncLog = sequelize.define('SyncLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  last_sync_at: {
    type: DataTypes.DATE,
    field: 'last_sync_at'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  records_fetched: {
    type: DataTypes.INTEGER,
    field: 'records_fetched',
    defaultValue: 0
  },
  error_message: {
    type: DataTypes.TEXT,
    field: 'error_message'
  }
}, {
  tableName: 'sync_logs',
  timestamps: false
})

export default SyncLog
