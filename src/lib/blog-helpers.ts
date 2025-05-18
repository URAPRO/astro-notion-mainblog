import { BASE_PATH, REQUEST_TIMEOUT_MS } from '../server-constants'
import type {
  Block,
  Heading1,
  Heading2,
  Heading3,
  RichText,
  Column, Post,
} from './interfaces';
import { pathJoin } from './utils'
import fs from 'fs'

export const filePath = (url: URL): string => {
  const dir = url.pathname.split('/').slice(-2)[0]
  const originalFilename = decodeURIComponent(url.pathname.split('/').slice(-1)[0])
  
  // ディレクトリ内のファイル一覧を取得
  const dirPath = `./public/notion/${dir}`
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath)
    
    // オリジナルのファイル名に一致するファイルがあれば、それを使用
    if (files.includes(originalFilename)) {
      return pathJoin(BASE_PATH, `/notion/${dir}/${originalFilename}`)
    }
    
    // スラグ命名規則に変換されたファイルを探す
    // ファイル拡張子を取得
    const fileExtension = originalFilename.split('.').pop() || ''
    
    // 同じ拡張子のリネームされたファイルを探す
    const renamedFiles = files.filter(f => 
      f.endsWith(`.${fileExtension}`) && 
      f !== originalFilename &&
      (/-\d+\./.test(f) || /-featured\./.test(f) || /-icon\./.test(f)) // スラグ-数字.拡張子 または スラグ-featured.拡張子 または スラグ-icon.拡張子 パターンのファイル
    )
    
    // URLと同じディレクトリ内のリネームされたファイルのいずれかを返す
    if (renamedFiles.length > 0) {
      return pathJoin(BASE_PATH, `/notion/${dir}/${renamedFiles[0]}`)
    }
  }
  
  // 何も見つからない場合は元のパスを返す
  return pathJoin(BASE_PATH, `/notion/${dir}/${originalFilename}`)
}

export const extractTargetBlocks = (
  blockType: string,
  blocks: Block[]
): Block[] => {
  return blocks
    .reduce((acc: Block[], block) => {
      if (block.Type === blockType) {
        acc.push(block)
      }

      if (block.ColumnList && block.ColumnList.Columns) {
        acc = acc.concat(
          _extractTargetBlockFromColums(blockType, block.ColumnList.Columns)
        )
      } else if (block.BulletedListItem && block.BulletedListItem.Children) {
        acc = acc.concat(
          extractTargetBlocks(blockType, block.BulletedListItem.Children)
        )
      } else if (block.NumberedListItem && block.NumberedListItem.Children) {
        acc = acc.concat(
          extractTargetBlocks(blockType, block.NumberedListItem.Children)
        )
      } else if (block.ToDo && block.ToDo.Children) {
        acc = acc.concat(extractTargetBlocks(blockType, block.ToDo.Children))
      } else if (block.SyncedBlock && block.SyncedBlock.Children) {
        acc = acc.concat(
          extractTargetBlocks(blockType, block.SyncedBlock.Children)
        )
      } else if (block.Toggle && block.Toggle.Children) {
        acc = acc.concat(extractTargetBlocks(blockType, block.Toggle.Children))
      } else if (block.Paragraph && block.Paragraph.Children) {
        acc = acc.concat(
          extractTargetBlocks(blockType, block.Paragraph.Children)
        )
      } else if (block.Heading1 && block.Heading1.Children) {
        acc = acc.concat(
          extractTargetBlocks(blockType, block.Heading1.Children)
        )
      } else if (block.Heading2 && block.Heading2.Children) {
        acc = acc.concat(
          extractTargetBlocks(blockType, block.Heading2.Children)
        )
      } else if (block.Heading3 && block.Heading3.Children) {
        acc = acc.concat(
          extractTargetBlocks(blockType, block.Heading3.Children)
        )
      } else if (block.Quote && block.Quote.Children) {
        acc = acc.concat(extractTargetBlocks(blockType, block.Quote.Children))
      } else if (block.Callout && block.Callout.Children) {
        acc = acc.concat(extractTargetBlocks(blockType, block.Callout.Children))
      }

      return acc
    }, [])
    .flat()
}

const _extractTargetBlockFromColums = (
  blockType: string,
  columns: Column[]
): Block[] => {
  return columns
    .reduce((acc: Block[], column) => {
      if (column.Children) {
        acc = acc.concat(extractTargetBlocks(blockType, column.Children))
      }
      return acc
    }, [])
    .flat()
}

export const buildURLToHTMLMap = async (
  urls: URL[]
): Promise<{ [key: string]: string }> => {
  const htmls: string[] = await Promise.all(
    urls.map(async (url: URL) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        controller.abort()
      }, REQUEST_TIMEOUT_MS)

      return fetch(url.toString(), { signal: controller.signal })
        .then((res) => {
          return res.text()
        })
        .catch(() => {
          console.log('Request was aborted')
          return ''
        })
        .finally(() => {
          clearTimeout(timeout)
        })
    })
  )

  return urls.reduce((acc: { [key: string]: string }, url, i) => {
    if (htmls[i]) {
      acc[url.toString()] = htmls[i]
    }
    return acc
  }, {})
}

export const getStaticFilePath = (path: string): string => {
  return pathJoin(BASE_PATH, path)
}

export const getNavLink = (nav: string) => {
  if ((!nav || nav === '/') && BASE_PATH) {
    return pathJoin(BASE_PATH, '') + '/'
  }

  return pathJoin(BASE_PATH, nav)
}

export const getPostLink = (post: Post) => {
  return post.ExternalLink ? post.ExternalLink : pathJoin(BASE_PATH, `/posts/${post.Slug}`)
}

export const getPostFullLink = (post: Post) => {
  return new URL(getPostLink(post), import.meta.env.SITE).toString();
}

export const getTagLink = (tag: string) => {
  return pathJoin(BASE_PATH, `/posts/tag/${encodeURIComponent(tag)}`)
}

export const getPageLink = (page: number, tag: string) => {
  if (page === 1) {
    return tag ? getTagLink(tag) : pathJoin(BASE_PATH, '/')
  }
  return tag
    ? pathJoin(
        BASE_PATH,
        `/posts/tag/${encodeURIComponent(tag)}/page/${page.toString()}`
      )
    : pathJoin(BASE_PATH, `/posts/page/${page.toString()}`)
}

export const getDateStr = (date: string) => {
  const dt = new Date(date)

  if (date.indexOf('T') !== -1) {
    // Consider timezone
    const elements = date.split('T')[1].split(/([+-])/)
    if (elements.length > 1) {
      const diff = parseInt(`${elements[1]}${elements[2]}`, 10)
      dt.setHours(dt.getHours() + diff)
    }
  }

  const y = dt.getFullYear()
  const m = ('00' + (dt.getMonth() + 1)).slice(-2)
  const d = ('00' + dt.getDate()).slice(-2)
  return y + '-' + m + '-' + d
}

export const buildHeadingId = (heading: Heading1 | Heading2 | Heading3) => {
  const text = heading.RichTexts.map((richText: RichText) => {
    if (!richText.Text) {
      return ''
    }
    return richText.Text.Content
  })
    .join('')
    .trim()
  return slugify(text);
}

export const isTweetURL = (url: URL): boolean => {
  if (
    url.hostname !== 'twitter.com' &&
    url.hostname !== 'www.twitter.com' &&
    url.hostname !== 'x.com' &&
    url.hostname !== 'www.x.com'
  ) {
    return false
  }
  return /\/[^/]+\/status\/[\d]+/.test(url.pathname)
}

export const isTikTokURL = (url: URL): boolean => {
  if (url.hostname !== 'tiktok.com' && url.hostname !== 'www.tiktok.com') {
    return false
  }
  return /\/[^/]+\/video\/[\d]+/.test(url.pathname)
}

export const isInstagramURL = (url: URL): boolean => {
  if (
    url.hostname !== 'instagram.com' &&
    url.hostname !== 'www.instagram.com'
  ) {
    return false
  }
  return /\/p\/[^/]+/.test(url.pathname)
}

export const isPinterestURL = (url: URL): boolean => {
  if (
    url.hostname !== 'pinterest.com' &&
    url.hostname !== 'www.pinterest.com' &&
    url.hostname !== 'pinterest.jp' &&
    url.hostname !== 'www.pinterest.jp'
  ) {
    return false
  }
  return /\/pin\/[\d]+/.test(url.pathname)
}

export const isCodePenURL = (url: URL): boolean => {
  if (url.hostname !== 'codepen.io' && url.hostname !== 'www.codepen.io') {
    return false
  }
  return /\/[^/]+\/pen\/[^/]+/.test(url.pathname)
}

export const isShortAmazonURL = (url: URL): boolean => {
  if (url.hostname === 'amzn.to' || url.hostname === 'www.amzn.to') {
    return true
  }
  return false
}

export const isFullAmazonURL = (url: URL): boolean => {
  if (
    url.hostname === 'amazon.com' ||
    url.hostname === 'www.amazon.com' ||
    url.hostname === 'amazon.co.jp' ||
    url.hostname === 'www.amazon.co.jp'
  ) {
    return true
  }
  return false
}

export const isAmazonURL = (url: URL): boolean => {
  return isShortAmazonURL(url) || isFullAmazonURL(url)
}

export const isYouTubeURL = (url: URL): boolean => {
  if (['www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname)) {
    return true
  }
  return false
}

// Supported URL
//
// - https://youtu.be/0zM3nApSvMg
// - https://www.youtube.com/watch?v=0zM3nApSvMg&feature=feedrec_grec_index
// - https://www.youtube.com/watch?v=0zM3nApSvMg#t=0m10s
// - https://www.youtube.com/watch?v=0zM3nApSvMg
// - https://www.youtube.com/v/0zM3nApSvMg?fs=1&amp;hl=en_US&amp;rel=0
// - https://www.youtube.com/embed/0zM3nApSvMg?rel=0
// - https://youtube.com/live/uOLwqWlpKbA
export const parseYouTubeVideoId = (url: URL): string => {
  if (!isYouTubeURL(url)) return ''

  if (url.hostname === 'youtu.be') {
    return url.pathname.split('/')[1]
  } else if (url.pathname === '/watch') {
    return url.searchParams.get('v') || ''
  } else {
    const elements = url.pathname.split('/')

    if (elements.length < 2) return ''

    if (
      elements[1] === 'v' ||
      elements[1] === 'embed' ||
      elements[1] === 'live'
    ) {
      return elements[2]
    }
  }

  return ''
}

export function Zweifel(text: string): string {
  return text.replace(/[A-Za-z0-9]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
  });
}

// slugify 関数 (日本語対応)
export const slugify = (text: string): string => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // スペースをハイフンに
    .replace(/[\uff5e\u3000\uFF0D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFF0D]/g, '-') // 全角ハイフンなどを半角ハイフンに
    .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF0-9-]+/g, '') // 英数字、ひらがな、カタカナ、漢字、ハイフン以外を削除
    .replace(/-+/g, '-') // 連続するハイフンを一つに
    .replace(/^-+|-+$/g, ''); // 先頭と末尾のハイフンを削除
};
