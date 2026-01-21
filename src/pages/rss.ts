import { buildRssResponse, siteOnlyRssOptions } from '../lib/rss'

export async function GET() {
  const response = await buildRssResponse(siteOnlyRssOptions)

  // 元のヘッダーを保持しつつContent-Typeのみを上書き
  const headers = new Headers(response.headers)
  headers.set('Content-Type', 'text/xml; charset=utf-8')

  return new Response(response.body, {
    status: response.status,
    headers,
  })
}
