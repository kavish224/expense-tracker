import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required in production');
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'super-secret-fallback-key-for-development';
const key = new TextEncoder().encode(SESSION_SECRET);

export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const sessionToken = await new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(key);

    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expires,
        path: '/',
    });
}

export async function verifySession() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
        return null;
    }

    try {
        const { payload } = await jwtVerify(sessionToken, key, {
            algorithms: ['HS256'],
        });
        return payload as { userId: string };
    } catch (error) {
        // Token is invalid/expired
        return null;
    }
}

export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
}
