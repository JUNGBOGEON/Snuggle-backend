import rateLimit from 'express-rate-limit'
import type { Request, Response } from 'express'

// 일반 API 요청 제한 (분당 100회)
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 인증 관련 요청 제한 (분당 10회) - 브루트포스 방지
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 파일 업로드 제한 (분당 20회)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 20,
  message: { error: 'Too many uploads, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 검색 요청 제한 (분당 30회)
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 30,
  message: { error: 'Too many search requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 글 작성/수정 제한 (분당 10회)
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 10,
  message: { error: 'Too many write requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 엄격한 제한 (DoS 방지) - 초당 30회 이상 요청 차단
export const strictLimiter = rateLimit({
  windowMs: 1000, // 1초
  max: 30,
  message: { error: 'Request rate too high.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.warn(`Rate limit exceeded: ${req.ip} - ${req.method} ${req.path}`)
    res.status(429).json({ error: 'Request rate too high. You have been temporarily blocked.' })
  },
})
