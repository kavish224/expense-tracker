import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { verifySession } from '@/lib/auth';

export async function GET() {
    try {
        const session = await verifySession();

        if (!session || !session.userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const result = await sql`SELECT id, email FROM users WHERE id = ${session.userId}`;
        const user = result.rows[0];

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ user }, { status: 200 });
    } catch (error) {
        console.error('/me verify error:', error);
        return NextResponse.json(
            { error: 'Internal server error while fetching user profile' },
            { status: 500 }
        );
    }
}
