import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import uploadRouter from './routes/upload.js'
import postsRouter from './routes/posts.js'
import categoriesRouter from './routes/categories.js'
import profileRouter from './routes/profile.js'
import skinsRouter from './routes/skins.js'
import searchRouter from './routes/search.js'
import subscribeRouter from './routes/subscribe.js'
import forumRouter from './routes/forum.js'

const app = express()

// Middleware
app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'], // Ensure auth header allowed
}))
app.use(express.json())

// Routes
app.use('/api/upload', uploadRouter)
app.use('/api/posts', postsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/profile', profileRouter)
app.use('/api/skins', skinsRouter)
app.use('/api/search', searchRouter)
app.use('/api/subscribe', subscribeRouter)
app.use('/api/forum', forumRouter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Start server
app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`)
})
