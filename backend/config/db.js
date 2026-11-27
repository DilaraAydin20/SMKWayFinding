import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const DB_NAME = process.env.DB_NAME || 'smk_wayfinding'
const DB_USER = process.env.DB_USER || 'root'
const DB_PASSWORD = process.env.DB_PASSWORD || undefined
const DB_HOST = process.env.DB_HOST || 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10)

// Create database if it doesn't exist
async function ensureDatabase() {
  // Connect without a database — connects to the MySQL server itself
  const adminSequelize = new Sequelize(null, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mysql',
    logging: false,
    pool: { max: 1, min: 0 }
  })

  try {
    await adminSequelize.authenticate()
    console.log('Connected to MySQL server.')
    const [results] = await adminSequelize.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    console.log(`Database '${DB_NAME}' is ready.`)
  } catch (err) {
    console.error('Failed to create database:', err.message)
    throw err
  } finally {
    await adminSequelize.close()
  }
}

const sequelize = new Sequelize(
  DB_NAME,
  DB_USER,
  DB_PASSWORD || undefined,
  {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
  }
)

export { ensureDatabase }
export default sequelize
