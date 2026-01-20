import type { Post } from '../interfaces'
import { PLATFORM_CONFIG, POST_CONFIG, type PlatformType } from '../constants'

// プラットフォーム設定をエクスポート（既存コードとの互換性維持）
export const platformConfig = PLATFORM_CONFIG

/**
 * 投稿のプラットフォームを判定
 */
export function getPlatform(post: Post): PlatformType {
  if (!post.ExternalLink) return 'blog'
  if (post.ExternalLink.includes('note.com')) return 'note'
  if (post.ExternalLink.includes('zenn.dev')) return 'zenn'
  return 'external'
}

/**
 * 指定日数以内の投稿かどうかを判定
 */
export function isNew(date: string, days: number = POST_CONFIG.NEW_POST_DAYS): boolean {
  const postDate = new Date(date)
  const now = new Date()
  const diffDays = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays <= days
}
