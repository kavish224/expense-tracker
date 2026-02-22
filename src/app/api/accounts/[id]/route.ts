import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { verifySession } from '@/lib/auth';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Ensure the account belongs to the user before deleting
        const result = await sql`
            DELETE FROM accounts
            WHERE id = ${id} AND user_id = ${session.userId}
            RETURNING id
        `;

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 });
        }

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('Failed to delete account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
