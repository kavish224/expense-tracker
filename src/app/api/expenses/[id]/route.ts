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

        const parsedAmount = Number(amount);
        if (!isFinite(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
        }
        if (parsedAmount > 10_000_000) {
            return NextResponse.json({ error: 'Amount exceeds maximum allowed value' }, { status: 400 });
        }

        const VALID_CATEGORIES = ['Food','Transport','Shopping','Entertainment','Bills','Health','Education','Travel','Groceries','Other'];
        const VALID_PAYMENT_METHODS = ['Cash','UPI','Credit Card','Debit Card','Net Banking','Wallet'];
        if (!category || !VALID_CATEGORIES.includes(category)) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }
        if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
            return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
        }
        if (!date || isNaN(Date.parse(date))) {
            return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
        }
        if (note && typeof note === 'string' && note.length > 200) {
            return NextResponse.json({ error: 'Note is too long (max 200 characters)' }, { status: 400 });
        }

        const result = await sql`
            WITH updated AS (
                UPDATE expenses
                SET amount = ${parsedAmount},
                    category = ${category},
                    payment_method = ${paymentMethod},
                    account_id = ${account || null},
                    date = ${date},
                    note = ${note || null}
                WHERE id = ${id} AND user_id = ${session.userId}
                RETURNING id, amount, category, payment_method, account_id, date, note
            )
            SELECT u.id, u.amount, u.category, u.payment_method as "paymentMethod", u.account_id, u.date, u.note,
                   a.name as account_name
            FROM updated u
            LEFT JOIN accounts a ON u.account_id = a.id
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
            accountName: row.account_name,
            date: new Date(row.date).toISOString(),
            note: row.note,
        };

        return NextResponse.json(updatedExpense, { status: 200 });
    } catch (error) {
        console.error('Failed to update expense:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
