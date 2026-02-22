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
            SELECT e.id, e.amount, e.category, e.payment_method as "paymentMethod", e.date, e.note,
                   a.id as account_id
            FROM expenses e
            LEFT JOIN accounts a ON e.account_id = a.id
            WHERE e.user_id = ${session.userId}
            ORDER BY e.date DESC
        `;

        // Map account_id -> account string to match existing Expense type
        const expenses = result.rows.map(row => ({
            id: row.id,
            amount: Number(row.amount),
            category: row.category,
            paymentMethod: row.paymentMethod,
            account: row.account_id, // frontend stores account id in the `account` field
            date: new Date(row.date).toISOString(),
            note: row.note,
        }));

        return NextResponse.json(expenses);
    } catch (error) {
        console.error('Failed to fetch expenses:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { amount, category, paymentMethod, account, date, note } = body;

        let parsedAmount = Number(amount);
        if (isNaN(parsedAmount)) {
            return NextResponse.json({ error: 'Amount must be a number' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO expenses (user_id, amount, category, payment_method, account_id, date, note)
            VALUES (${session.userId}, ${parsedAmount}, ${category}, ${paymentMethod}, ${account || null}, ${date}, ${note || null})
            RETURNING id, amount, category, payment_method as "paymentMethod", account_id, date, note
        `;

        const row = result.rows[0];
        const newExpense = {
            id: row.id,
            amount: Number(row.amount),
            category: row.category,
            paymentMethod: row.paymentMethod,
            account: row.account_id,
            date: new Date(row.date).toISOString(),
            note: row.note,
        };

        return NextResponse.json(newExpense, { status: 201 });
    } catch (error) {
        console.error('Failed to create expense:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
