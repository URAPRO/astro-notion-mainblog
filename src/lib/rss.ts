import rss from '@astrojs/rss'
import { getAllPosts, getDatabase } from './notion/client'
import { getPostLink } from './blog-helpers'
import type { Post } from './interfaces'

type BuildRssOptions = {
  filter?: (post: Post) => boolean
  titleSuffix?: string
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
    items: filteredPosts.map((post: Post) => ({
      link: new URL(getPostLink(post), import.meta.env.SITE).toString(),
      title: post.Title,
      description: post.Excerpt,
      pubDate: new Date(post.Date),
    })),
  })
}
