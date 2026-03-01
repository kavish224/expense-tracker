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
                   a.id as account_id, a.name as account_name
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
            account: row.account_id, // holds UUID
            accountName: row.account_name, // holds Name
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
            WITH inserted AS (
                INSERT INTO expenses (user_id, amount, category, payment_method, account_id, date, note)
                VALUES (${session.userId}, ${parsedAmount}, ${category}, ${paymentMethod}, ${account || null}, ${date}, ${note || null})
                RETURNING id, amount, category, payment_method, account_id, date, note
            )
            SELECT i.id, i.amount, i.category, i.payment_method as "paymentMethod", i.account_id, i.date, i.note,
                   a.name as account_name
            FROM inserted i
            LEFT JOIN accounts a ON i.account_id = a.id
        `;

        const row = result.rows[0];
        const newExpense = {
            id: row.id,
            amount: Number(row.amount),
            category: row.category,
            paymentMethod: row.paymentMethod,
            account: row.account_id,
            accountName: row.account_name,
            date: new Date(row.date).toISOString(),
            note: row.note,
        };

        return NextResponse.json(newExpense, { status: 201 });
    } catch (error) {
        console.error('Failed to create expense:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
