import { IMAGE_SIZES } from '../constants'
import { filePath } from '../blog-helpers'

export interface ImagePaths {
  original: string
  webp: string // Large: 800px
  medium: string // Medium: 400px
  small: string // Small: 200px
}

/**
 * 画像URLからWebP各サイズのパスを生成
 */
export function generateImagePaths(imageUrl: URL | string): ImagePaths {
  const url = typeof imageUrl === 'string' ? new URL(imageUrl) : imageUrl
  const originalPath = filePath(url)

  // 各サイズのWebPパスを生成
  const pathParts = originalPath.split('.')
  pathParts.pop() // 拡張子を削除
  const basePath = pathParts.join('.')

  return {
    original: originalPath,
    webp: `${basePath}.webp`,
    medium: `${basePath}-md.webp`,
    small: `${basePath}-sm.webp`,
  }
}

/**
 * srcset文字列を生成
 */
export function generateSrcset(paths: ImagePaths): string {
  const sizes = [IMAGE_SIZES.SMALL, IMAGE_SIZES.MEDIUM, IMAGE_SIZES.LARGE]
  const urls = [paths.small, paths.medium, paths.webp]

  return urls
    .filter(Boolean)
    .map((url, i) => `${url} ${sizes[i]}w`)
    .join(', ')
}
