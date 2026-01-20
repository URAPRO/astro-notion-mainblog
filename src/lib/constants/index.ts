// 画像サイズ設定
export const IMAGE_SIZES = {
  SMALL: 200,
  MEDIUM: 400,
  LARGE: 800,
} as const

// WebP品質設定
export const WEBP_QUALITY = {
  HIGH: 85,
  MEDIUM: 80,
  LOW: 75,
} as const

// 記事関連設定
export const POST_CONFIG = {
  NEW_POST_DAYS: 7,
} as const

// プラットフォーム設定
export const PLATFORM_CONFIG = {
  blog: { icon: '🏠', label: 'Blog', color: '#E07A3D' },
  note: { icon: '✍️', label: 'note', color: '#41c9b4' },
  zenn: { icon: '💻', label: 'Zenn', color: '#3EA8FF' },
  external: { icon: '🔗', label: 'External', color: '#888' },
} as const

export type PlatformType = keyof typeof PLATFORM_CONFIG
