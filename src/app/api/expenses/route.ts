import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { verifySession } from '@/lib/auth';
import { NormalizedExpenseInput, validateBulkExpenseInput, validateExpenseInput } from '@/lib/expenseValidation';

function mapExpenseRow(row: Record<string, unknown>) {
    return {
        id: row.id as string,
        amount: Number(row.amount),
        category: row.category as string,
        paymentMethod: row.paymentMethod as string,
        account: row.account_id as string | undefined,
        accountName: row.account_name as string | undefined,
        date: new Date(row.date as string).toISOString(),
        note: row.note as string | null,
    };
}

async function insertExpense(userId: string, expense: NormalizedExpenseInput) {
    const result = await sql`
        WITH inserted AS (
            INSERT INTO expenses (user_id, amount, category, payment_method, account_id, date, note)
            VALUES (${userId}, ${expense.amount}, ${expense.category}, ${expense.paymentMethod}, ${expense.account}, ${expense.date}, ${expense.note})
            RETURNING id, amount, category, payment_method, account_id, date, note
        )
        SELECT i.id, i.amount, i.category, i.payment_method as "paymentMethod", i.account_id, i.date, i.note,
               a.name as account_name
        FROM inserted i
        LEFT JOIN accounts a ON i.account_id = a.id
    `;

    return mapExpenseRow(result.rows[0]);
}

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
        const expenses = result.rows.map((row) => mapExpenseRow(row));

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
        if (Array.isArray(body?.expenses)) {
            const bulkValidation = validateBulkExpenseInput(body.expenses);
            if (!bulkValidation.ok) {
                return NextResponse.json({ error: bulkValidation.error }, { status: 400 });
            }

            const createdExpenses = [];
            for (const expense of bulkValidation.value) {
                createdExpenses.push(await insertExpense(session.userId, expense));
            }

            return NextResponse.json(createdExpenses, { status: 201 });
        }

        const validation = validateExpenseInput(body);
        if (!validation.ok) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        const newExpense = await insertExpense(session.userId, validation.value);
        return NextResponse.json(newExpense, { status: 201 });
    } catch (error) {
        console.error('Failed to create expense:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
