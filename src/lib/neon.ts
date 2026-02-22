import { neon } from '@neondatabase/serverless';

// The new Vercel Neon integration defaults to DATABASE_URL. We fallback to POSTGRES_URL for safety.
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not defined');
}

// Instantiate the Neon HTTP client
const sqlClient = neon(databaseUrl);

// Create a wrapper function that mirrors the @vercel/postgres signature exactly
// @vercel/postgres returns { rows: any[], rowCount: number }
export const sql = async (strings: TemplateStringsArray, ...values: any[]) => {
    const res = await sqlClient(strings, ...values);

    // By default, the Neon HTTP client just returns an Array of rows.
    // If we passed { fullResults: true } it would return an object. We'll simply handle either case transparently.
    if (Array.isArray(res)) {
        return {
            rows: res,
            rowCount: res.length
        };
    }

    return res;
};
