import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const UserVisit = sequelize.define('UserVisit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  room_name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  scanned_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'scanned_at'
  }
}, {
  tableName: 'user_visits',
  timestamps: false
})

export default UserVisit
