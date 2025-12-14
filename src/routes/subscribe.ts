import { Router, Response } from 'express'
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js'
import { createAuthenticatedClient } from '../services/supabase.service.js'

const router = Router()

// 구독 수 가져오기
router.get('/counts', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id
        const targetId = (req.query.userId as string) || userId

        const token = req.headers.authorization!.split(' ')[1]
        const authClient = createAuthenticatedClient(token)

        // 내가 구독하는 수 (Following)
        const { count: followingCount, error: followingError } = await authClient
            .from('subscribe')
            .select('*', { count: 'exact', head: true })
            .eq('sub_id', targetId)

        // 나를 구독하는 수 (Followers)
        const { count: followersCount, error: followersError } = await authClient
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

// 구독 여부 확인
router.get('/check', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const subId = req.user!.id
        const targetId = req.query.targetId as string

        if (!targetId) {
            res.status(400).json({ error: 'targetId is required' })
            return
        }

        const token = req.headers.authorization!.split(' ')[1]
        const authClient = createAuthenticatedClient(token)

        const { data, error } = await authClient
            .from('subscribe')
            .select('*')
            .eq('sub_id', subId)
            .eq('subed_id', targetId)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found'
            console.error('Check subscription error:', error)
            res.status(500).json({ error: 'Failed to check subscription' })
            return
        }

        res.json({ subscribed: !!data })
    } catch (error) {
        console.error('Check subscription error:', error)
        res.status(500).json({ error: 'Failed to check subscription' })
    }
})

// 구독 토글 (구독하기/취소하기)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const subId = req.user!.id
        const { targetId } = req.body

        if (!targetId) {
            res.status(400).json({ error: 'targetId is required' })
            return
        }

        if (subId === targetId) {
            res.status(400).json({ error: 'Cannot subscribe to yourself' })
            return
        }

        const token = req.headers.authorization!.split(' ')[1]
        const authClient = createAuthenticatedClient(token)

        // Check if already subscribed
        const { data: existing, error: checkError } = await authClient
            .from('subscribe')
            .select('*')
            .eq('sub_id', subId)
            .eq('subed_id', targetId)
            .single()

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError
        }

        if (existing) {
            // Unsubscribe
            const { error: deleteError } = await authClient
                .from('subscribe')
                .delete()
                .eq('sub_id', subId)
                .eq('subed_id', targetId)

            if (deleteError) throw deleteError

            // Update profile count (decrement)
            // Get current count first
            const { data: profile } = await authClient
                .from('profiles')
                .select('sub_total_count')
                .eq('id', targetId)
                .single()

            if (profile) {
                const newCount = Math.max(0, (profile.sub_total_count || 0) - 1)
                await authClient
                    .from('profiles')
                    .update({ sub_total_count: newCount })
                    .eq('id', targetId)
            }

            res.json({ subscribed: false })
        } else {
            // Subscribe
            const { error: insertError } = await authClient
                .from('subscribe')
                .insert({
                    sub_id: subId,
                    subed_id: targetId,
                    sub_date: new Date().toISOString()
                })

            if (insertError) throw insertError

            // Update profile count (increment)
            const { data: profile } = await authClient
                .from('profiles')
                .select('sub_total_count')
                .eq('id', targetId)
                .single()

            if (profile) {
                const newCount = (profile.sub_total_count || 0) + 1
                await authClient
                    .from('profiles')
                    .update({ sub_total_count: newCount })
                    .eq('id', targetId)
            }

            res.json({ subscribed: true })
        }

    } catch (error) {
        console.error('Toggle subscription error:', error)
        res.status(500).json({ error: 'Failed to toggle subscription' })
    }
})

export default router
