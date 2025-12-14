import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import {
  strictLimiter,
  generalLimiter,
  uploadLimiter,
  searchLimiter,
  writeLimiter,
} from './middleware/rateLimit.js'
import uploadRouter from './routes/upload.js'
import postsRouter from './routes/posts.js'
import categoriesRouter from './routes/categories.js'
import profileRouter from './routes/profile.js'
import skinsRouter from './routes/skins.js'
import searchRouter from './routes/search.js'
import blogsRouter from './routes/blogs.js'

const app = express()

// Trust proxy (for correct IP detection behind reverse proxy)
app.set('trust proxy', 1)

// CORS must be before rate limiter (so 429 responses also have CORS headers)
app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
}))

// Global rate limit (DoS 방지 - 초당 10회 제한)
app.use(strictLimiter)

// Body parsers
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Routes with specific rate limits
app.use('/api/upload', uploadLimiter, uploadRouter)
app.use('/api/posts', generalLimiter, postsRouter)
app.use('/api/categories', generalLimiter, categoriesRouter)
app.use('/api/profile', generalLimiter, profileRouter)
app.use('/api/skins', generalLimiter, skinsRouter)
app.use('/api/search', searchLimiter, searchRouter)
app.use('/api/blogs', generalLimiter, blogsRouter)

// Health check (no rate limit)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// Start server
app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`)
})
