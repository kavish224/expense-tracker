import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';
import { comparePassword, createSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        // Fetch user
        const result = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
        const user = result.rows[0];

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        const isValidPassword = await comparePassword(password, user.password_hash);

        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Create session
        await createSession(user.id);

        return NextResponse.json(
            { message: 'Logged in successfully', user: { id: user.id, email: user.email } },
            { status: 200 }
        );
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error during login' },
            { status: 500 }
        );
    }
}
