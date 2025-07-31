import express from 'express'
import logger from 'morgan'
import { db } from './db/messages_repository.js'

import { Server } from 'socket.io'
import { createServer } from 'node:http'
import { authdb, UserRepository } from './db/user_repository.js'



const port = process.env.PORT ?? 3000
const app = express()
app.use(express.json())

const server = createServer(app)
const io = new Server(server, {
    connectionStateRecovery: {

    }
})



await db.execute(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    user TEXT,
    timestamp DATETIME DEFAULT (datetime('now', 'localtime'))
)`)

await authdb.execute(`CREATE TABLE IF NOT EXISTS users (
    _id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
)`)

io.on('connection', async (socket) => {
    console.log('A user connected')

    socket.on('disconnect', () => {
        console.log('A user disconnected')
    })

    socket.on('chat message', async (msg) => {
        console.log('Received message:', msg) // Debug
        let result
        const user = socket.handshake.auth.user ?? 'Anonymous'
        const timestamp = new Date().toISOString()
        try {
            result = await db.execute({
                sql: 'INSERT INTO messages (content, user, timestamp) VALUES (:msg, :user, :timestamp)',
                args: { msg, user, timestamp }
            })
        } catch (error) {
            console.error('Error inserting message:', error)
            return
        }
        io.emit('chat message', msg, result.lastInsertRowid.toString(), user, timestamp)
    })

    if (!socket.recovered) {
        try {
            const results = await db.execute({
                sql: 'SELECT id, content, user, timestamp FROM messages WHERE id > ? ORDER BY timestamp ASC',
                args: [socket.handshake.auth.serverOffset ?? 0],
            })
            results.rows.forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.user, row.timestamp)
            })
        } catch (e) {
            console.error('Error fetching messages:', e)
        }
    }
})

app.use(logger('dev'))

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
})


app.post('/register', async (req, res) => {
    const { username, password } = req.body

    try {
        const id = await UserRepository.create({ username, password })
        res.send({ id })
    } catch (error) {
        console.error('Error creating user:', error)
        res.status(400).send({ error: error.message })
    }
})
app.post('/login', (req, res) => { })
app.post('/logout', (req, res) => { })

app.get('/protected', (req, res) => { })
server.listen(port, () => {
    console.log(`Server running on port ${port}`)
})