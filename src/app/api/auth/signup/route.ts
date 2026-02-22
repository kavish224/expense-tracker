import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { hashPassword, createSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters long' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;
        if (existingUser.rowCount > 0) {
            return NextResponse.json(
                { error: 'Email is already registered' },
                { status: 409 }
            );
        }

        const hashedPassword = await hashPassword(password);

        // Insert new user
        const result = await sql`
            INSERT INTO users (email, password_hash)
            VALUES (${email}, ${hashedPassword})
            RETURNING id, email
        `;

        const user = result.rows[0];

        // Create session
        await createSession(user.id);

        return NextResponse.json(
            { message: 'User created successfully', user: { id: user.id, email: user.email } },
            { status: 201 }
        );
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'Internal server error during signup' },
            { status: 500 }
        );
    }
}
