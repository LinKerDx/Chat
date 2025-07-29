import * as z from "zod";
import dotenv from 'dotenv'
import crypto from 'crypto'

import { createClient } from "@libsql/client"


dotenv.config()


export const authdb = createClient({
    url: 'libsql://trusted-ultra-linkerdx.aws-us-east-2.turso.io',
    authToken: process.env.DB_AUTH_TOKEN
})



const UserSchema = z.object({
    _id: z.string(),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
})


export class UserRepository {
    static rateLimitCache = new Map();
    static async create({ username, password }) {
        try {

            await this.checkRateLimit(clientIp);

            const result = UserSchema.safeParse({ username, password })
            if (!result.success) {
                throw new Error(`Validation failed: ${result.error.errors.map(e => e.message).join(", ")}`)
            }

            const existingUser = await authdb.execute(
                'SELECT _id FROM users WHERE username = ?',
                [username]
            );

            if (existingUser.rows && existingUser.rows.length > 0) {
                throw new Error("User already exists");
            }
            const id = crypto.randomUUID()
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const insertResult = await authdb.execute(
                'INSERT INTO users (_id, username, password) VALUES (?, ?, ?)',
                [id, username, hashedPassword]
            );

            return {
                id,
                username,
                createdAt: new Date().toISOString(),
                success: true
            };

        } catch (error) {
            console.error('Error creating user:', error);

            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('Username already exists');
            }

            throw error;
        }
    }
    static login({ username, password }) { }

    static async checkRateLimit(clientIp) {
        const key = clientIp || 'global';
        const now = Date.now();
        const windowMs = 15 * 60 * 1000; // 15 minutos
        const maxAttempts = 5;

        if (!this.rateLimitCache.has(key)) {
            this.rateLimitCache.set(key, {
                attempts: 0,
                windowStart: now,
                resetTime: now + windowMs
            });
        }

        const rateLimitData = this.rateLimitCache.get(key);


        if (now >= rateLimitData.resetTime) {
            rateLimitData.attempts = 0;
            rateLimitData.windowStart = now;
            rateLimitData.resetTime = now + windowMs;
        }

        if (rateLimitData.attempts >= maxAttempts) {
            const timeUntilReset = Math.ceil((rateLimitData.resetTime - now) / 1000);
            throw new Error(`Too many registration attempts. Try again in ${timeUntilReset} seconds.`);
        }

        rateLimitData.attempts++;
    }

    static cleanupRateLimit() {
        const now = Date.now();
        for (const [key, data] of this.rateLimitCache.entries()) {
            if (now >= data.resetTime) {
                this.rateLimitCache.delete(key);
            }
        }
    }
}