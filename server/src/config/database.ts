import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'interview',
  password: process.env.DB_PASSWORD || 'test',
  database: process.env.DB_NAME || 'interview_test'
};

export const getConnection = async (maxRetries = 10, retryDelayMs = 2000) => {
  console.log('Attempting to connect to the database...');
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await mysql.createConnection(dbConfig);
      if (attempt > 1) {
        console.log(`Database connection successful on attempt ${attempt}`);
      }
      return connection;
    } catch (error: any) {
      console.log('...');

      if (attempt === maxRetries) {
        console.error('Database connection failed after all retries:', error);
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new Error('Unexpected error in getConnection');
};

export const getPool = () => {
  return mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
};
