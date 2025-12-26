import { generateSitemap } from '../lib/generate-sitemap'
import { getAllPosts } from '../lib/notion/client'
import { getPostLink, getNavLink } from '../lib/blog-helpers'

export async function GET() {
  const [posts] = await Promise.all([getAllPosts()])

  // 固定ページを追加
  const staticPages = [
    {
      loc: new URL('/', import.meta.env.SITE).toString(),
      lastmod: new Date(), // トップページは常に最新
    },
    {
      loc: new URL(getNavLink('/posts'), import.meta.env.SITE).toString(),
      lastmod: new Date(), // 記事一覧も常に最新
    },
  ]

  const postItems = posts.map((post) => {
    const updateDate = post.UpdateDate ? new Date(post.UpdateDate) : null
    const lastmod = updateDate || new Date(post.Date)

    return {
      loc: new URL(getPostLink(post), import.meta.env.SITE).toString(),
      lastmod,
    }
  })

  const sitemapItems = [...staticPages, ...postItems]

  const sitemap = generateSitemap(sitemapItems)

  const res = new Response(sitemap)
  res.headers.set('Content-Type', 'text/xml')

  return res
}