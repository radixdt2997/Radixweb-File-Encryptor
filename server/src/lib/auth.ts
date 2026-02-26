/**
 * Auth helpers: password hashing, JWT sign/verify, email domain validation
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { auth as authConfig } from '../config';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
}

export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, authConfig.jwtSecret, { expiresIn: authConfig.jwtExpiresInSeconds });
}

export function verifyToken(token: string): JwtPayload | null {
    try {
        const decoded = jwt.verify(token, authConfig.jwtSecret) as JwtPayload;
        return decoded;
    } catch {
        return null;
    }
}

/**
 * Validate that email belongs to the allowed domain (e.g. @radixweb.com)
 */
export function validateEmailDomain(email: string): boolean {
    const domain = authConfig.allowedEmailDomain.replace(/^@/, '').toLowerCase();
    const regex = new RegExp(`^[a-zA-Z0-9._%+-]+@${domain.replace(/\./g, '\\.')}$`);
    return regex.test(email.trim().toLowerCase());
}
