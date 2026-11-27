import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import bcrypt from 'bcryptjs'

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user'
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      user.password_hash = await bcrypt.hash(user.password_hash, 10)
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 10)
      }
    }
  }
})

User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password_hash)
}

export default User
