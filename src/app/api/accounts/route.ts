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

        if (!name || !type) {
            return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO accounts (user_id, name, type)
            VALUES (${session.userId}, ${name}, ${type})
            RETURNING id, name, type
        `;

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error('Failed to create account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
