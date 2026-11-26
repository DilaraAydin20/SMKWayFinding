import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  osm_way_id: {
    type: DataTypes.BIGINT,
    unique: true,
    allowNull: false,
    field: 'osm_way_id'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  ref: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  smk_room_name: {
    type: DataTypes.STRING(200),
    field: 'smk_room_name'
  }
}, {
  tableName: 'rooms',
  timestamps: false
})

export default Room
