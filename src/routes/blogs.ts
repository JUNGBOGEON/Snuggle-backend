import { Router, Request, Response } from 'express'
import { supabaseAdmin } from '../services/supabase.service.js'

const router = Router()

// 사용자 프로필 이미지 가져오기 헬퍼 함수
async function getUserProfileImage(userId: string): Promise<string | null> {
  // 1. profiles 테이블에서 확인
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('profile_image_url')
    .eq('id', userId)
    .single()

  if (profile?.profile_image_url) {
    return profile.profile_image_url
  }

  // 2. auth.users에서 카카오 프로필 가져오기
  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null
}

// 신규 블로거 목록
router.get('/new', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 3

    // 블로그 목록 가져오기
    const { data: blogs, error } = await supabaseAdmin
      .from('blogs')
      .select('id, name, description, thumbnail_url, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!blogs || blogs.length === 0) {
      res.json([])
      return
    }

    // auth.users에서 카카오 프로필 가져오기
    const userIds = blogs.map((b) => b.user_id)
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()

    const userMap = new Map(
      (users?.users || [])
        .filter((u) => userIds.includes(u.id))
        .map((u) => [
          u.id,
          u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
        ])
    )

    // 프로필 테이블에서도 가져오기 (사용자가 직접 설정한 경우)
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, profile_image_url')
      .in('id', userIds)

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p.profile_image_url])
    )

    const result = blogs.map((blog) => ({
      id: blog.id,
      name: blog.name,
      description: blog.description,
      thumbnail_url: blog.thumbnail_url,
      // 우선순위: profiles.profile_image_url > auth.users.avatar_url
      profile_image_url: profileMap.get(blog.user_id) || userMap.get(blog.user_id) || null,
      created_at: blog.created_at,
    }))

    res.json(result)
  } catch (error) {
    console.error('Get new blogs error:', error)
    res.status(500).json({ error: 'Failed to get new blogs' })
  }
})

// 블로그 상세 정보
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const { data: blog, error } = await supabaseAdmin
      .from('blogs')
      .select('id, user_id, name, description, thumbnail_url, created_at')
      .eq('id', id)
      .single()

    if (error || !blog) {
      res.status(404).json({ error: 'Blog not found' })
      return
    }

    // 프로필 정보 가져오기
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, nickname, profile_image_url')
      .eq('id', blog.user_id)
      .single()

    // auth.users에서 카카오 프로필 가져오기
    const profileImageUrl = await getUserProfileImage(blog.user_id)

    res.json({
      ...blog,
      profile: profile ? {
        ...profile,
        profile_image_url: profile.profile_image_url || profileImageUrl,
      } : {
        id: blog.user_id,
        nickname: null,
        profile_image_url: profileImageUrl,
      },
    })
  } catch (error) {
    console.error('Get blog error:', error)
    res.status(500).json({ error: 'Failed to get blog' })
  }
})

export default router
