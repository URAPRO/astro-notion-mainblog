import rss from '@astrojs/rss'
import { getAllPosts, getDatabase } from './notion/client'
import { getPostLink } from './blog-helpers'
import type { Post } from './interfaces'

type BuildRssOptions = {
  filter?: (post: Post) => boolean
  titleSuffix?: string
}

// サイト内記事のみのRSSオプション（外部リンク記事を除外）
export const siteOnlyRssOptions: BuildRssOptions = {
  filter: (post) => !post.ExternalLink,
  titleSuffix: ' (サイト内のみ)',
}

export async function buildRssResponse(options: BuildRssOptions = {}) {
  const [posts, database] = await Promise.all([getAllPosts(), getDatabase()])

  const filteredPosts = options.filter ? posts.filter(options.filter) : posts
  const title = options.titleSuffix
    ? `${database.Title}${options.titleSuffix}`
    : database.Title

  return rss({
    title,
    description: database.Description,
    site: import.meta.env.SITE,
    // 日本語コンテンツを明示
    customData: `<language>ja</language>`,
    items: filteredPosts.map((post: Post) => ({
      link: new URL(getPostLink(post), import.meta.env.SITE).toString(),
      title: post.Title,
      // MetaDescriptionがあればそれを使用、なければExcerptにフォールバック
      description: post.MetaDescription || post.Excerpt,
      pubDate: new Date(post.Date),
      // タグをカテゴリとして追加
      categories: post.Tags?.map((tag) => tag.name) || [],
    })),
  })
}
