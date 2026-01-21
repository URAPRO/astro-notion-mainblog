import { buildRssResponse, siteOnlyRssOptions } from '../lib/rss'

export async function GET() {
  return buildRssResponse(siteOnlyRssOptions)
}
