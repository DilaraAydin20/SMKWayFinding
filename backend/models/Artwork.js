import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'

const Artwork = sequelize.define('Artwork', {
  smk_id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(2000),
    allowNull: true
  },
  artist: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  year: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  description_en: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  description_da: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  web_url: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  on_display: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  current_location_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'current_location_name'
  },
  last_synced_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_synced_at'
  },
  image_data: {
    type: DataTypes.BLOB('long'),
    allowNull: true,
    field: 'image_data'
  }
}, {
  tableName: 'artworks',
  timestamps: false,
  indexes: [
    { fields: ['smk_id'] },
    { fields: ['title'] },
    { fields: ['artist'] },
    { fields: ['current_location_name'] }
  ]
})

export default Artwork
