import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { verifySession } from '@/lib/auth';

export async function GET() {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await sql`
            SELECT id, name, type
            FROM accounts
            WHERE user_id = ${session.userId}
            ORDER BY created_at ASC
        `;

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch accounts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, type } = await request.json();

        const VALID_TYPES = ['Bank', 'CreditCard'];
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        if (name.trim().length > 50) {
            return NextResponse.json({ error: 'Name is too long (max 50 characters)' }, { status: 400 });
        }
        if (!type || !VALID_TYPES.includes(type)) {
            return NextResponse.json({ error: 'Type must be Bank or CreditCard' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO accounts (user_id, name, type)
            VALUES (${session.userId}, ${name.trim()}, ${type})
            RETURNING id, name, type
        `;

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error('Failed to create account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
