import dotenv from 'dotenv'

import { createClient } from '@libsql/client'
dotenv.config()


export const db = createClient({
    url: 'libsql://select-maginty-linkerdx.aws-us-east-2.turso.io',
    authToken: process.env.DB_TOKEN
})