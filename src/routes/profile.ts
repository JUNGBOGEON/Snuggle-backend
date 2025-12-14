import { Router, Response } from 'express'
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js'
import { createAuthenticatedClient } from '../services/supabase.service.js'

const router = Router()

// 프로필 동기화 (카카오 프로필 정보를 profiles 테이블에 저장)
router.post('/sync', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization!.split(' ')[1]
    const authClient = createAuthenticatedClient(token)

    // 현재 사용자의 auth 메타데이터 가져오기
    const { data: { user }, error: userError } = await authClient.auth.getUser()

    if (userError || !user) {
      res.status(401).json({ error: 'Failed to get user' })
      return
    }

    const metadata = user.user_metadata
    const profileImageUrl = metadata?.avatar_url || metadata?.picture || null
    const nickname = metadata?.name || metadata?.full_name || null

    // profiles 테이블 업데이트
    const { data, error } = await authClient
      .from('profiles')
      .upsert({
        id: user.id,
        profile_image_url: profileImageUrl,
        nickname: nickname,
      }, {
        onConflict: 'id',
      })
      .select()
      .single()

    if (error) {
      console.error('Profile sync error:', error)
      res.status(500).json({ error: error.message })
      return
    }

    res.json(data)
  } catch (error) {
    console.error('Profile sync error:', error)
    res.status(500).json({ error: 'Failed to sync profile' })
  }
})

// 계정 탈퇴 (소프트 삭제)
router.delete('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const token = req.headers.authorization!.split(' ')[1]
    const authClient = createAuthenticatedClient(token)
    const now = new Date().toISOString()

    // 1. 사용자의 모든 블로그 소프트 삭제
    const { error: blogsError } = await authClient
      .from('blogs')
      .update({ deleted_at: now })
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (blogsError) {
      console.error('Soft delete blogs error:', blogsError)
      res.status(500).json({ error: 'Failed to delete blogs' })
      return
    }

    // 2. profiles 테이블 소프트 삭제
    const { error: profileError } = await authClient
      .from('profiles')
      .update({ deleted_at: now })
      .eq('id', user.id)

    if (profileError) {
      console.error('Soft delete profile error:', profileError)
      res.status(500).json({ error: 'Failed to delete profile' })
      return
    }

    res.json({ success: true, message: 'Account deleted successfully (recoverable for 30 days)' })
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

// 계정 삭제 상태 확인
router.get('/status', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const token = req.headers.authorization!.split(' ')[1]
    const authClient = createAuthenticatedClient(token)

    const { data, error } = await authClient
      .from('profiles')
      .select('deleted_at')
      .eq('id', user.id)
      .single()

    if (error || !data) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.json({
      isDeleted: !!data.deleted_at,
      deletedAt: data.deleted_at,
    })
  } catch (error) {
    console.error('Get account status error:', error)
    res.status(500).json({ error: 'Failed to get account status' })
  }
})

// 계정 복구
router.post('/restore', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const token = req.headers.authorization!.split(' ')[1]
    const authClient = createAuthenticatedClient(token)

    // 1. 프로필 복구
    const { error: profileError } = await authClient
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', user.id)

    if (profileError) {
      console.error('Restore profile error:', profileError)
      res.status(500).json({ error: 'Failed to restore profile' })
      return
    }

    // 2. 모든 블로그 복구 (삭제된 블로그도 함께 복구)
    const { error: blogsError } = await authClient
      .from('blogs')
      .update({ deleted_at: null })
      .eq('user_id', user.id)

    if (blogsError) {
      console.error('Restore blogs error:', blogsError)
      // 블로그 복구 실패해도 프로필은 복구됨
    }

    res.json({ success: true, message: 'Account restored successfully' })
  } catch (error) {
    console.error('Restore account error:', error)
    res.status(500).json({ error: 'Failed to restore account' })
  }
})

// 블로그 소프트 삭제
router.delete('/blog/:blogId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const { blogId } = req.params
    const token = req.headers.authorization!.split(' ')[1]
    const authClient = createAuthenticatedClient(token)

    // 블로그 소유자 확인 및 소프트 삭제
    const { data, error } = await authClient
      .from('blogs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', blogId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) {
      res.status(404).json({ error: 'Blog not found or unauthorized' })
      return
    }

    res.json({ success: true, message: 'Blog deleted successfully', deletedAt: data.deleted_at })
  } catch (error) {
    console.error('Delete blog error:', error)
    res.status(500).json({ error: 'Failed to delete blog' })
  }
})

// 블로그 복구
router.post('/blog/:blogId/restore', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const { blogId } = req.params
    const token = req.headers.authorization!.split(' ')[1]
    const authClient = createAuthenticatedClient(token)

    // 블로그 소유자 확인 및 복구 (deleted_at을 NULL로)
    const { data, error } = await authClient
      .from('blogs')
      .update({ deleted_at: null })
      .eq('id', blogId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) {
      res.status(404).json({ error: 'Blog not found or unauthorized' })
      return
    }

    res.json({ success: true, message: 'Blog restored successfully' })
  } catch (error) {
    console.error('Restore blog error:', error)
    res.status(500).json({ error: 'Failed to restore blog' })
  }
})

// 삭제된 블로그 목록 조회
router.get('/blogs/deleted', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const token = req.headers.authorization!.split(' ')[1]
    const authClient = createAuthenticatedClient(token)

    const { data, error } = await authClient
      .from('blogs')
      .select('id, name, description, thumbnail_url, deleted_at')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json(data || [])
  } catch (error) {
    console.error('Get deleted blogs error:', error)
    res.status(500).json({ error: 'Failed to get deleted blogs' })
  }
})

export default router
