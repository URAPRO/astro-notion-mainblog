import { validateUrlWithLogging } from '../../lib/helpers/url-validation'
import { downloadFile } from '../../lib/notion/client'

export interface DownloadTask {
  url: string | undefined
  slug?: string
  type?: string
  context: string
}

/**
 * 単一ファイルのダウンロードタスクを実行
 */
export async function executeDownload(task: DownloadTask): Promise<void> {
  const url = validateUrlWithLogging(task.url, task.context)
  if (!url) return

  return downloadFile(url, task.slug, task.type)
}

/**
 * 複数ファイルのダウンロードタスクを並列実行
 */
export async function executeDownloads(tasks: DownloadTask[]): Promise<void> {
  await Promise.all(tasks.map(executeDownload))
}
