import type { AstroIntegration } from 'astro'
import { getAllPosts } from '../lib/notion/client'
import { executeDownload, type DownloadTask } from './shared/downloader-utils'

export default (): AstroIntegration => ({
  name: 'featured-image-downloader',
  hooks: {
    'astro:build:start': async () => {
      const posts = await getAllPosts()

      const tasks: DownloadTask[] = posts
        .filter((post) => post.FeaturedImage?.Url)
        .map((post) => ({
          url: post.FeaturedImage!.Url,
          slug: post.Slug,
          type: 'featured',
          context: 'FeaturedImage',
        }))

      await Promise.all(tasks.map(executeDownload))
    },
  },
})
