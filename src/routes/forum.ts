import { Router, Request, Response } from 'express'
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js'
import { createAuthenticatedClient, supabase } from '../services/supabase.service.js'

const router = Router()

// 포럼 목록 조회
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = parseInt(req.query.limit as string) || 20
        const offset = parseInt(req.query.offset as string) || 0

        const { data: forums, error } = await supabase
            .from('forums')
            .select(`
        *,
        blog:blogs ( name, thumbnail_url ),
        comments:forum_comments(count)
      `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('Fetch forums error:', error)
            res.status(500).json({ error: error.message })
            return
        }

        // Transform count array to number if needed, though supabase returns array of objects with count
        // select('*, ..., comments:forum_comments(count)') returns { ..., comments: [{ count: N }] } typically?
        // Actually Supabase select count is tricky in joins.
        // The previous frontend code was: comments:forum_comments(count)
        // It returns comments: [{ count: ... }] usually.
        // Let's ensure the response format matches what standard fetch returns.

        // Map to clean structure if necessary, or just return as is.
        // Frontend expects: comment_count field.
        const result = forums.map((item: any) => ({
            ...item,
            comment_count: item.comments?.[0]?.count || 0,
            view_count: 0 // Mock
        }))

        res.json(result)
    } catch (error) {
        console.error('Fetch forums error:', error)
        res.status(500).json({ error: 'Failed to fetch forums' })
    }
})

// 포럼 상세 조회
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params
        const { data, error } = await supabase
            .from('forums')
            .select(`
        *,
        blog:blogs ( name, thumbnail_url )
      `)
            .eq('id', id)
            .single()

        if (error) {
            res.status(404).json({ error: 'Forum not found' })
            return
        }

        res.json({
            ...data,
            view_count: 0,
            comment_count: 0 // Loaded separately or not needed in detail
        })
    } catch (error) {
        console.error('Fetch forum detail error:', error)
        res.status(500).json({ error: 'Failed to fetch forum detail' })
    }
})

// 포럼 글 작성
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const user = req.user!
        const { title, description, blog_id } = req.body

        const token = req.headers.authorization!.split(' ')[1]
        const authClient = createAuthenticatedClient(token)

        const { data, error } = await authClient
            .from('forums')
            .insert({
                title,
                description,
                user_id: user.id,
                blog_id
            })
            .select()
            .single()

        if (error) {
            console.error('Create forum error:', error)
            res.status(500).json({ error: error.message })
            return
        }

        res.status(201).json(data)
    } catch (error) {
        console.error('Create forum error:', error)
        res.status(500).json({ error: 'Failed to create forum' })
    }
})

// 댓글 목록 조회
router.get('/:id/comments', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params
        const { data, error } = await supabase
            .from('forum_comments')
            .select(`
        *,
        blog:blogs ( name, thumbnail_url )
      `)
            .eq('forum_id', id)
            .order('created_at', { ascending: true })

        if (error) {
            res.status(500).json({ error: error.message })
            return
        }

        res.json(data)
    } catch (error) {
        console.error('Fetch comments error:', error)
        res.status(500).json({ error: 'Failed to fetch comments' })
    }
})

// 댓글 작성
router.post('/comments', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const user = req.user!
        const { forum_id, blog_id, content } = req.body // parent_id removed/ignored

        const token = req.headers.authorization!.split(' ')[1]
        const authClient = createAuthenticatedClient(token)

        const { data, error } = await authClient
            .from('forum_comments')
            .insert({
                forum_id,
                user_id: user.id,
                blog_id,
                content
            })
            .select()
            .single()

        if (error) {
            console.error('Create comment error:', error)
            res.status(500).json({ error: error.message })
            return
        }

        res.status(201).json(data)
    } catch (error) {
        console.error('Create comment error:', error)
        res.status(500).json({ error: 'Failed to create comment' })
    }
})

export default router
