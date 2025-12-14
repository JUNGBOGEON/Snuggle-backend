import { Router, Response } from 'express'
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js'
import { supabase } from '../services/supabase.service.js'

const router = Router()

// 구독 수 가져오기
router.get('/counts', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id
        // Or allow querying other users via query param?
        // Frontend logic: getSubscriptionCounts(user.id)
        // If we want to view others, we need param.
        const targetId = (req.query.userId as string) || userId

        // 내가 구독하는 수 (Following)
        const { count: followingCount, error: followingError } = await supabase
            .from('subscribe')
            .select('*', { count: 'exact', head: true })
            .eq('sub_id', targetId)

        // 나를 구독하는 수 (Followers)
        const { count: followersCount, error: followersError } = await supabase
            .from('subscribe')
            .select('*', { count: 'exact', head: true })
            .eq('subed_id', targetId)

        if (followingError || followersError) {
            console.error('Subscription count error:', followingError || followersError)
            res.status(500).json({ error: 'Failed to fetch subscription counts' })
            return
        }

        res.json({
            following: followingCount || 0,
            followers: followersCount || 0,
        })
    } catch (error) {
        console.error('Subscription count error:', error)
        res.status(500).json({ error: 'Failed to fetch subscription counts' })
    }
})

export default router
