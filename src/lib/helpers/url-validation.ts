/**
 * URL検証結果
 */
export interface UrlValidationResult {
  isValid: boolean
  url: URL | null
  error?: string
}

/**
 * 文字列をURLとして検証
 */
export function validateUrl(urlString: string | undefined): UrlValidationResult {
  if (!urlString) {
    return { isValid: false, url: null, error: 'URL is empty or undefined' }
  }

  try {
    const url = new URL(urlString)
    return { isValid: true, url }
  } catch {
    return { isValid: false, url: null, error: `Invalid URL: ${urlString}` }
  }
}

/**
 * URL検証とエラーログ出力
 */
export function validateUrlWithLogging(
  urlString: string | undefined,
  context: string
): URL | null {
  const result = validateUrl(urlString)

  if (!result.isValid) {
    console.log(`Invalid ${context} URL:`, urlString)
    return null
  }

  return result.url
}
