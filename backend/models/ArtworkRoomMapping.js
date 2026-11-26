import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const ArtworkRoomMapping = sequelize.define('ArtworkRoomMapping', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  artwork_smk_id: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'artwork_smk_id',
    references: { model: 'artworks', key: 'smk_id' }
  },
  room_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'rooms', key: 'id' }
  }
}, {
  tableName: 'artwork_room_mapping',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['artwork_smk_id', 'room_id'] }
  ]
})

export default ArtworkRoomMapping
