import { buildRssResponse } from '../lib/rss'

export async function GET() {
  return buildRssResponse({
    filter: (post) => !post.ExternalLink,
    titleSuffix: ' (サイト内のみ)',
  })
}
