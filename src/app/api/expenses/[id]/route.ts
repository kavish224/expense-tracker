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

        // Ensure the expense belongs to the user before deleting
        const result = await sql`
            DELETE FROM expenses
            WHERE id = ${id} AND user_id = ${session.userId}
            RETURNING id
        `;

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Expense not found or unauthorized' }, { status: 404 });
        }

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('Failed to delete expense:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { amount, category, paymentMethod, account, date, note } = body;

        let parsedAmount = Number(amount);
        if (isNaN(parsedAmount)) {
            return NextResponse.json({ error: 'Amount must be a number' }, { status: 400 });
        }

        const result = await sql`
            UPDATE expenses
            SET amount = ${parsedAmount},
                category = ${category},
                payment_method = ${paymentMethod},
                account_id = ${account || null},
                date = ${date},
                note = ${note || null}
            WHERE id = ${id} AND user_id = ${session.userId}
            RETURNING id, amount, category, payment_method as "paymentMethod", account_id, date, note
        `;

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Expense not found or unauthorized' }, { status: 404 });
        }

        const row = result.rows[0];
        const updatedExpense = {
            id: row.id,
            amount: Number(row.amount),
            category: row.category,
            paymentMethod: row.paymentMethod,
            account: row.account_id,
            date: new Date(row.date).toISOString(),
            note: row.note,
        };

        return NextResponse.json(updatedExpense, { status: 200 });
    } catch (error) {
        console.error('Failed to update expense:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
