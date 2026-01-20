import type { AstroIntegration } from 'astro'
import { getDatabase } from '../lib/notion/client'
import { executeDownload } from './shared/downloader-utils'

export default (): AstroIntegration => ({
  name: 'cover-image-downloader',
  hooks: {
    'astro:build:start': async () => {
      const database = await getDatabase()

      if (!database.Cover || database.Cover.Type !== 'file') {
        return
      }

      return executeDownload({
        url: database.Cover.Url,
        context: 'Cover image',
      })
    },
  },
})
