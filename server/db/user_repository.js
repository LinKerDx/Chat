import * as z from "zod";
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'

import { createClient } from "@libsql/client"


dotenv.config()


export const authdb = createClient({
    url: 'libsql://trusted-ultra-linkerdx.aws-us-east-2.turso.io',
    authToken: process.env.DB_AUTH_TOKEN
})

const UserCreateSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
})


const UserSchema = z.object({
    _id: z.string(),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
})


export class UserRepository {
    static async create({ username, password }) {
        try {
            ValidationError.ValidateUser(username, password)
            const existingUser = await authdb.execute(
                'SELECT _id FROM users WHERE username = ?',
                [username]
            );
            if (existingUser.rows && existingUser.rows.length > 0) {
                throw new Error("User already exists");
            }
            const id = crypto.randomUUID()
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const insertResult = await authdb.execute(
                'INSERT INTO users (_id, username, password) VALUES (?, ?, ?)',
                [id, username, hashedPassword]
            );
            return {
                id: id,
                username,
                createdAt: new Date().toISOString(),
                success: true
            };
        }
        catch (error) {
            console.error('Error creating user:', error);

            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('Username already exists');
            }

            throw error;
        }
    }
    static async login({ username, password }) {
        ValidationError.ValidateUser(username, password)
        const existingUser = await authdb.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        console.log('Existing user:', existingUser)
        if (!existingUser.rows || existingUser.rows.length === 0) {
            throw new Error("User does not exist");
        }
        const isValidPassword = await bcrypt.compare(password, existingUser.rows[0].password);
        if (!isValidPassword) {
            throw new Error("Invalid password");
        }
        return {
            _id: existingUser.rows[0]._id,
            username: existingUser.rows[0].username,
            success: true
        };

    }

}


class ValidationError {
    static ValidateUser(username, password) {
        const result = UserCreateSchema.safeParse({ username, password })
        if (!result.success) {
            const errorMessage = result.error.issues?.map(issue => issue.message).join(", ")
                || "Validation failed";
            throw new Error(`Validation failed: ${errorMessage}`);
        }
    }
}
