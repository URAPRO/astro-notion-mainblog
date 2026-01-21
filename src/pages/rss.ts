import { buildRssResponse } from '../lib/rss'

export async function GET() {
  const response = await buildRssResponse({
    filter: (post) => !post.ExternalLink,
    titleSuffix: ' (サイト内のみ)',
  })

  // ブラウザでXMLとして表示されるようにContent-Typeを設定
  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  })
}
