import type { AstroIntegration } from 'astro'
import type { FileObject } from '../lib/interfaces'
import { getDatabase } from '../lib/notion/client'
import { executeDownload } from './shared/downloader-utils'

export default (): AstroIntegration => ({
  name: 'custom-icon-downloader',
  hooks: {
    'astro:build:start': async () => {
      const database = await getDatabase()

      if (!database.Icon || database.Icon.Type !== 'file') {
        return
      }

      const icon = database.Icon as FileObject

      return executeDownload({
        url: icon.Url,
        slug: 'site',
        type: 'icon',
        context: 'Icon image',
      })
    },
  },
})
