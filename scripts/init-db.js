// To run this script, execute:
// node scripts/init-db.js

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const sql = neon(databaseUrl);

async function main() {
  try {
    console.log('Testing connection to Neon Postgres...');

    // 1. Create Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Created users table');

    // 2. Create Accounts Table
    await sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Created accounts table');

    // 3. Create Expenses Table
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        category TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
        date TIMESTAMP WITH TIME ZONE NOT NULL,
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Created expenses table');

    // 4. Create Indexes for performant lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);`;
    console.log('✅ Created indexes');

    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

main();
