import fs, { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import axios from 'axios'
import sharp from 'sharp'
import retry from 'async-retry'
import ExifTransformer from 'exif-be-gone'
import {
  NOTION_API_SECRET,
  DATABASE_ID,
  NUMBER_OF_POSTS_PER_PAGE,
  REQUEST_TIMEOUT_MS,
} from '../../server-constants'
import type { AxiosResponse } from 'axios'
import type * as responses from './responses'
import type * as requestParams from './request-params'
import type {
  Database,
  Post,
  Block,
  Paragraph,
  Heading1,
  Heading2,
  Heading3,
  BulletedListItem,
  NumberedListItem,
  ToDo,
  Image,
  Code,
  Quote,
  Equation,
  Callout,
  Embed,
  Video,
  File,
  Bookmark,
  LinkPreview,
  SyncedBlock,
  SyncedFrom,
  Table,
  TableRow,
  TableCell,
  Toggle,
  ColumnList,
  Column,
  TableOfContents,
  RichText,
  Text,
  Annotation,
  SelectProperty,
  Emoji,
  FileObject,
  LinkToPage,
  Mention,
  Reference,
} from '../interfaces'
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { Client, APIResponseError } from '@notionhq/client'

const client = new Client({
  auth: NOTION_API_SECRET,
})

let postsCache: Post[] | null = null
let dbCache: Database | null = null

const numberOfRetry = 2

export async function getAllPosts(): Promise<Post[]> {
  if (postsCache !== null) {
    return Promise.resolve(postsCache)
  }

  const params: requestParams.QueryDatabase = {
    database_id: DATABASE_ID,
    filter: {
      and: [
        {
          property: 'Published',
          checkbox: {
            equals: true,
          },
        },
        {
          property: 'Date',
          date: {
            on_or_before: (() => {
              // JST is UTC+9. To be robust against server timezone, we use UTC-based methods.
              const jstOffset = 9 * 60 * 60 * 1000;
              const jstNow = new Date(Date.now() + jstOffset);

              // Create a date for the end of the current day in JST using UTC components.
              const endOfTodayJst = new Date(
                Date.UTC(
                  jstNow.getUTCFullYear(),
                  jstNow.getUTCMonth(),
                  jstNow.getUTCDate(),
                  23, 59, 59, 999
                )
              );

              // Convert the JST end-of-day timestamp back to a UTC timestamp for the Notion API.
              return new Date(endOfTodayJst.getTime() - jstOffset).toISOString();
            })(),
          },
        },
      ],
    },
    sorts: [
      {
        property: 'Date',
        direction: 'descending',
      },
    ],
    page_size: 100,
  }

  let results: responses.PageObject[] = []
  while (true) {
    const res = await retry(
      async (bail) => {
        try {
          return (await client.databases.query(
            params as any // eslint-disable-line @typescript-eslint/no-explicit-any
          )) as responses.QueryDatabaseResponse
        } catch (error: unknown) {
          if (error instanceof APIResponseError) {
            if (error.status && error.status >= 400 && error.status < 500) {
              bail(error)
            }
          }
          throw error
        }
      },
      {
        retries: numberOfRetry,
      }
    )

    results = results.concat(res.results)

    if (!res.has_more) {
      break
    }

    params['start_cursor'] = res.next_cursor as string
  }

  for (const pageObject of results) {
    if (pageObject.icon && pageObject.icon.type === 'file' && 'file' in pageObject.icon && pageObject.icon.file?.url) {
      try {
        const url = new URL(pageObject.icon.file.url)
        // ページのプロパティからslugを取得
        const slugProp = pageObject.properties['Slug']
        let slug = ''
        if (slugProp && slugProp.type === 'rich_text' && slugProp.rich_text && slugProp.rich_text.length > 0) {
          slug = slugProp.rich_text.map((rt) => rt.plain_text).join('')
        }

        // slugが存在する場合はslug-iconとして保存、そうでなければそのまま保存
        if (slug) {
          await downloadFile(url, slug, 'icon')
        } else {
          await downloadFile(url)
        }
      } catch (err) {
        console.error(`Failed to download icon file: ${err}`)
      }
    }
  }

  const validPageObjects = results.filter((pageObject) => _validPageObject(pageObject))
  const postPromises = validPageObjects.map(async (pageObject) => await _buildPost(pageObject))
  postsCache = await Promise.all(postPromises)
  return postsCache
}

// 記事一覧用の新しい関数
export async function getAllBlogPosts(): Promise<Post[]> {
  const allPosts = await getAllPosts()
  return allPosts.filter(post => post.Slug !== 'profile')
}

// 既存の関数を新しい関数を使用するように更新
export async function getPosts(pageSize = 10): Promise<Post[]> {
  const allPosts = await getAllBlogPosts()
  return allPosts.slice(0, pageSize)
}

export async function getRankedPosts(pageSize = 10): Promise<Post[]> {
  const allPosts = await getAllBlogPosts()
  return allPosts
    .filter((post) => !!post.Rank)
    .sort((a, b) => {
      if (a.Rank > b.Rank) {
        return -1
      } else if (a.Rank === b.Rank) {
        return 0
      }
      return 1
    })
    .slice(0, pageSize)
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const allPosts = await getAllPosts()
  return allPosts.find((post) => post.Slug === slug) || null
}

export async function getPostByPageId(pageId: string): Promise<Post | null> {
  const allPosts = await getAllPosts()
  return allPosts.find((post) => post.PageId === pageId) || null
}

export async function getPostsByTag(
  tagName: string,
  pageSize = 10
): Promise<Post[]> {
  if (!tagName) return []

  const allPosts = await getAllBlogPosts()
  return allPosts
    .filter((post) => post.Tags.find((tag) => tag.name === tagName))
    .slice(0, pageSize)
}

// page starts from 1 not 0
export async function getPostsByPage(page: number): Promise<Post[]> {
  if (page < 1) {
    return []
  }

  const allPosts = await getAllBlogPosts()

  const startIndex = (page - 1) * NUMBER_OF_POSTS_PER_PAGE
  const endIndex = startIndex + NUMBER_OF_POSTS_PER_PAGE

  return allPosts.slice(startIndex, endIndex)
}

// page starts from 1 not 0
export async function getPostsByTagAndPage(
  tagName: string,
  page: number
): Promise<Post[]> {
  if (page < 1) {
    return []
  }

  const allPosts = await getAllBlogPosts()
  const posts = allPosts.filter((post) =>
    post.Tags.find((tag) => tag.name === tagName)
  )

  const startIndex = (page - 1) * NUMBER_OF_POSTS_PER_PAGE
  const endIndex = startIndex + NUMBER_OF_POSTS_PER_PAGE

  return posts.slice(startIndex, endIndex)
}

export async function getNumberOfPages(): Promise<number> {
  const allPosts = await getAllBlogPosts()
  return (
    Math.floor(allPosts.length / NUMBER_OF_POSTS_PER_PAGE) +
    (allPosts.length % NUMBER_OF_POSTS_PER_PAGE > 0 ? 1 : 0)
  )
}

export async function getNumberOfPagesByTag(tagName: string): Promise<number> {
  const allPosts = await getAllBlogPosts()
  const posts = allPosts.filter((post) =>
    post.Tags.find((tag) => tag.name === tagName)
  )
  return (
    Math.floor(posts.length / NUMBER_OF_POSTS_PER_PAGE) +
    (posts.length % NUMBER_OF_POSTS_PER_PAGE > 0 ? 1 : 0)
  )
}

export async function getAllBlocksByBlockId(blockId: string): Promise<Block[]> {
  let results: responses.BlockObject[] = []

  if (fs.existsSync(`tmp/${blockId}.json`)) {
    results = JSON.parse(fs.readFileSync(`tmp/${blockId}.json`, 'utf-8'))
  } else {
    const params: requestParams.RetrieveBlockChildren = {
      block_id: blockId,
    }

    while (true) {
      const res = await retry(
        async (bail) => {
          try {
            return (await client.blocks.children.list(
              params as any // eslint-disable-line @typescript-eslint/no-explicit-any
            )) as responses.RetrieveBlockChildrenResponse
          } catch (error: unknown) {
            if (error instanceof APIResponseError) {
              if (error.status && error.status >= 400 && error.status < 500) {
                bail(error)
              }
            }
            throw error
          }
        },
        {
          retries: numberOfRetry,
        }
      )

      results = results.concat(res.results)

      if (!res.has_more) {
        break
      }

      params['start_cursor'] = res.next_cursor as string
    }
  }

  const allBlockPromises = results.map(async (blockObject) => await _buildBlock(blockObject));
  const allBlocks = await Promise.all(allBlockPromises);

  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i]

    if (block.Type === 'table' && block.Table) {
      block.Table.Rows = await _getTableRows(block.Id)
    } else if (block.Type === 'column_list' && block.ColumnList) {
      block.ColumnList.Columns = await _getColumns(block.Id)
    } else if (
      block.Type === 'bulleted_list_item' &&
      block.BulletedListItem &&
      block.HasChildren
    ) {
      block.BulletedListItem.Children = await getAllBlocksByBlockId(block.Id)
    } else if (
      block.Type === 'numbered_list_item' &&
      block.NumberedListItem &&
      block.HasChildren
    ) {
      block.NumberedListItem.Children = await getAllBlocksByBlockId(block.Id)
    } else if (block.Type === 'to_do' && block.ToDo && block.HasChildren) {
      block.ToDo.Children = await getAllBlocksByBlockId(block.Id)
    } else if (block.Type === 'synced_block' && block.SyncedBlock) {
      block.SyncedBlock.Children = await _getSyncedBlockChildren(block)
    } else if (block.Type === 'toggle' && block.Toggle) {
      block.Toggle.Children = await getAllBlocksByBlockId(block.Id)
    } else if (
      block.Type === 'paragraph' &&
      block.Paragraph &&
      block.HasChildren
    ) {
      block.Paragraph.Children = await getAllBlocksByBlockId(block.Id)
    } else if (
      block.Type === 'heading_1' &&
      block.Heading1 &&
      block.HasChildren
    ) {
      block.Heading1.Children = await getAllBlocksByBlockId(block.Id)
    } else if (
      block.Type === 'heading_2' &&
      block.Heading2 &&
      block.HasChildren
    ) {
      block.Heading2.Children = await getAllBlocksByBlockId(block.Id)
    } else if (
      block.Type === 'heading_3' &&
      block.Heading3 &&
      block.HasChildren
    ) {
      block.Heading3.Children = await getAllBlocksByBlockId(block.Id)
    } else if (block.Type === 'quote' && block.Quote && block.HasChildren) {
      block.Quote.Children = await getAllBlocksByBlockId(block.Id)
    } else if (block.Type === 'callout' && block.Callout && block.HasChildren) {
      block.Callout.Children = await getAllBlocksByBlockId(block.Id)
    }
  }

  return allBlocks
}

export async function getBlock(blockId: string): Promise<Block> {
  const params: requestParams.RetrieveBlock = {
    block_id: blockId,
  }

  const res = await retry(
    async (bail) => {
      try {
        return (await client.blocks.retrieve(
          params as any // eslint-disable-line @typescript-eslint/no-explicit-any
        )) as responses.RetrieveBlockResponse
      } catch (error: unknown) {
        if (error instanceof APIResponseError) {
          if (error.status && error.status >= 400 && error.status < 500) {
            bail(error)
          }
        }
        throw error
      }
    },
    {
      retries: numberOfRetry,
    }
  )

  return _buildBlock(res)
}

export async function getAllTags(): Promise<SelectProperty[]> {
  const allPosts = await getAllPosts()

  const tagNames: string[] = []
  return allPosts
    .flatMap((post) => post.Tags)
    .reduce((acc, tag) => {
      if (!tagNames.includes(tag.name)) {
        acc.push(tag)
        tagNames.push(tag.name)
      }
      return acc
    }, [] as SelectProperty[])
    .sort((a: SelectProperty, b: SelectProperty) =>
      a.name.localeCompare(b.name)
    )
}

export async function downloadFile(url: URL, slug?: string, imageIndex?: number | string) {
  let res!: AxiosResponse
  try {
    console.log(`Downloading file from: ${url.toString()}`)
    res = await axios({
      method: 'get',
      url: url.toString(),
      timeout: REQUEST_TIMEOUT_MS,
      responseType: 'stream',
    })
  } catch (err) {
    console.error(`Failed to download file: ${err}`)
    return Promise.resolve()
  }

  if (!res || res.status != 200) {
    console.error(`Failed to download file. Status: ${res?.status}`)
    return Promise.resolve()
  }

  const dir = './public/notion/' + url.pathname.split('/').slice(-2)[0]
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`)
    fs.mkdirSync(dir, { recursive: true })
  }

  // 元のファイル名を取得
  const originalFilename = decodeURIComponent(url.pathname.split('/').slice(-1)[0])
  // ファイル拡張子を取得
  const fileExtension = originalFilename.split('.').pop() || ''

  // 画像ファイルかどうか判定
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension.toLowerCase())

  // slugとimageIndexが提供されている場合、新しいファイル名を生成
  let filepath
  let webpFilepath
  let mediumFilepath
  let smallFilepath

  if (slug && imageIndex !== undefined) {
    const baseName = `${slug}-${imageIndex}`
    filepath = `${dir}/${baseName}.${fileExtension}`
    if (isImage) {
      webpFilepath = `${dir}/${baseName}.webp`
      mediumFilepath = `${dir}/${baseName}-md.webp`
      smallFilepath = `${dir}/${baseName}-sm.webp`
    }
    console.log(`Renaming file to: ${baseName}.${fileExtension}`)
  } else {
    filepath = `${dir}/${originalFilename}`
    if (isImage) {
      const nameWithoutExt = originalFilename.slice(0, originalFilename.lastIndexOf('.'))
      webpFilepath = `${dir}/${nameWithoutExt}.webp`
      mediumFilepath = `${dir}/${nameWithoutExt}-md.webp`
      smallFilepath = `${dir}/${nameWithoutExt}-sm.webp`
    }
  }

  console.log(`Saving file to: ${filepath}`)

  const writeStream = createWriteStream(filepath)
  let stream = res.data

  // 画像の場合の処理
  if (isImage && res.headers['content-type']?.startsWith('image/')) {
    try {
      // オリジナル画像を保存
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))

      await new Promise<void>((resolve, reject) => {
        stream.on('end', () => resolve())
        stream.on('error', reject)
      })

      const buffer = Buffer.concat(chunks)

      // sharpでEXIF削除、回転処理、リサイズを実行
      const metadata = await sharp(buffer).metadata()
      let sharpInstance = sharp(buffer).rotate()

      // 幅が800pxを超える場合はリサイズ（ブログコンテンツ幅に合わせる）
      const MAX_WIDTH = 800
      if (metadata.width && metadata.width > MAX_WIDTH) {
        sharpInstance = sharpInstance.resize(MAX_WIDTH, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        console.log(`Resizing image from ${metadata.width}px to ${MAX_WIDTH}px`)
      }

      const processedBuffer = await sharpInstance.toBuffer()

      // オリジナル画像を保存
      await fs.promises.writeFile(filepath, processedBuffer)
      console.log(`Original image saved: ${filepath}`)

      // Large WebP (800px) - 本文・大カード用
      if (webpFilepath) {
        await sharp(processedBuffer)
          .webp({ quality: 85 })
          .toFile(webpFilepath)
        console.log(`Large WebP saved: ${webpFilepath}`)
      }

      // Medium WebP (400px) - 中サムネイル・カード用
      if (mediumFilepath) {
        await sharp(processedBuffer)
          .resize(400, null, {
            withoutEnlargement: true,
            fit: 'inside'
          })
          .webp({ quality: 80 })
          .toFile(mediumFilepath)
        console.log(`Medium WebP saved: ${mediumFilepath}`)
      }

      // Small WebP (200px) - 極小サムネイル用
      if (smallFilepath) {
        await sharp(processedBuffer)
          .resize(200, null, {
            withoutEnlargement: true,
            fit: 'inside'
          })
          .webp({ quality: 75 })
          .toFile(smallFilepath)
        console.log(`Small WebP saved: ${smallFilepath}`)
      }

      console.log(`File saved successfully: ${filepath}`)
    } catch (err) {
      console.error(`Failed to process image: ${err}`)
      // エラーが発生した場合は、通常のファイル保存にフォールバック
      const fallbackStream = res.data
      await pipeline(fallbackStream, new ExifTransformer(), writeStream)
    }
  } else {
    // 画像以外のファイルの場合は通常の処理
    if (res.headers['content-type'] === 'image/jpeg') {
      stream = stream.pipe(sharp().rotate())
    }
    try {
      await pipeline(stream, new ExifTransformer(), writeStream)
      console.log(`File saved successfully: ${filepath}`)
    } catch (err) {
      console.error(`Failed to save file: ${err}`)
      writeStream.end()
      return Promise.resolve()
    }
  }
}

export async function getDatabase(): Promise<Database> {
  if (dbCache !== null) {
    return Promise.resolve(dbCache)
  }

  const params: requestParams.RetrieveDatabase = {
    database_id: DATABASE_ID,
  }

  const res = await retry(
    async (bail) => {
      try {
        return (await client.databases.retrieve(
          params as any // eslint-disable-line @typescript-eslint/no-explicit-any
        )) as responses.RetrieveDatabaseResponse
      } catch (error: unknown) {
        if (error instanceof APIResponseError) {
          if (error.status && error.status >= 400 && error.status < 500) {
            bail(error)
          }
        }
        throw error
      }
    },
    {
      retries: numberOfRetry,
    }
  )

  let icon: FileObject | Emoji | null = null
  if (res.icon) {
    if (res.icon.type === 'emoji' && 'emoji' in res.icon) {
      icon = {
        Type: res.icon.type,
        Emoji: res.icon.emoji,
      }
    } else if (res.icon.type === 'external' && 'external' in res.icon) {
      icon = {
        Type: res.icon.type,
        Url: res.icon.external?.url || '',
      }
    } else if (res.icon.type === 'file' && 'file' in res.icon) {
      icon = {
        Type: res.icon.type,
        Url: res.icon.file?.url || '',
      }
    }
  }

  let cover: FileObject | null = null
  if (res.cover) {
    cover = {
      Type: res.cover.type,
      Url: res.cover.external?.url || res.cover?.file?.url || '',
    }
  }

  const database: Database = {
    Title: res.title.map((richText) => richText.plain_text).join(''),
    Description: res.description
      .map((richText) => richText.plain_text)
      .join(''),
    Icon: icon,
    Cover: cover,
  }

  dbCache = database
  return database
}

async function _buildBlock(blockObject: responses.BlockObject): Promise<Block> {
  const block: Block = {
    Id: blockObject.id,
    Type: blockObject.type,
    HasChildren: blockObject.has_children,
  }

  switch (blockObject.type) {
    case 'paragraph':
      if (blockObject.paragraph) {
        const paragraph: Paragraph = {
          RichTexts: blockObject.paragraph.rich_text.map(_buildRichText),
          Color: blockObject.paragraph.color,
        }
        block.Paragraph = paragraph
      }
      break
    case 'heading_1':
      if (blockObject.heading_1) {
        const heading1: Heading1 = {
          RichTexts: blockObject.heading_1.rich_text.map(_buildRichText),
          Color: blockObject.heading_1.color,
          IsToggleable: blockObject.heading_1.is_toggleable,
        }
        block.Heading1 = heading1
      }
      break
    case 'heading_2':
      if (blockObject.heading_2) {
        const heading2: Heading2 = {
          RichTexts: blockObject.heading_2.rich_text.map(_buildRichText),
          Color: blockObject.heading_2.color,
          IsToggleable: blockObject.heading_2.is_toggleable,
        }
        block.Heading2 = heading2
      }
      break
    case 'heading_3':
      if (blockObject.heading_3) {
        const heading3: Heading3 = {
          RichTexts: blockObject.heading_3.rich_text.map(_buildRichText),
          Color: blockObject.heading_3.color,
          IsToggleable: blockObject.heading_3.is_toggleable,
        }
        block.Heading3 = heading3
      }
      break
    case 'bulleted_list_item':
      if (blockObject.bulleted_list_item) {
        const bulletedListItem: BulletedListItem = {
          RichTexts:
            blockObject.bulleted_list_item.rich_text.map(_buildRichText),
          Color: blockObject.bulleted_list_item.color,
        }
        block.BulletedListItem = bulletedListItem
      }
      break
    case 'numbered_list_item':
      if (blockObject.numbered_list_item) {
        const numberedListItem: NumberedListItem = {
          RichTexts:
            blockObject.numbered_list_item.rich_text.map(_buildRichText),
          Color: blockObject.numbered_list_item.color,
        }
        block.NumberedListItem = numberedListItem
      }
      break
    case 'to_do':
      if (blockObject.to_do) {
        const toDo: ToDo = {
          RichTexts: blockObject.to_do.rich_text.map(_buildRichText),
          Checked: blockObject.to_do.checked,
          Color: blockObject.to_do.color,
        }
        block.ToDo = toDo
      }
      break
    case 'video':
      if (blockObject.video) {
        const video: Video = {
          Caption: blockObject.video.caption?.map(_buildRichText) || [],
          Type: blockObject.video.type,
        }
        if (
          blockObject.video.type === 'external' &&
          blockObject.video.external
        ) {
          video.External = { Url: blockObject.video.external.url }
        }
        block.Video = video
      }
      break
    case 'image':
      if (blockObject.image) {
        const imageToBuild: Image = {
          Caption: blockObject.image.caption?.map(_buildRichText) || [],
          Type: blockObject.image.type,
        }
        if (
          blockObject.image.type === 'external' &&
          blockObject.image.external
        ) {
          imageToBuild.External = { Url: blockObject.image.external.url }
          if (imageToBuild.External.Url && !import.meta.env.DEV) {
            const dims = await getImageDimensions(imageToBuild.External.Url)
            imageToBuild.Width = dims.width
            imageToBuild.Height = dims.height
          }
        } else if (
          blockObject.image.type === 'file' &&
          blockObject.image.file
        ) {
          imageToBuild.File = {
            Type: blockObject.image.type,
            Url: blockObject.image.file.url,
            ExpiryTime: blockObject.image.file.expiry_time,
          }
          if (imageToBuild.File.Url && !import.meta.env.DEV) {
            const dims = await getImageDimensions(imageToBuild.File.Url)
            imageToBuild.Width = dims.width
            imageToBuild.Height = dims.height
            if (imageToBuild.File) {
              imageToBuild.File.Width = dims.width
              imageToBuild.File.Height = dims.height
            }
          }
        }
        block.Image = imageToBuild
      }
      break
    case 'file':
      if (blockObject.file) {
        const file: File = {
          Caption: blockObject.file.caption?.map(_buildRichText) || [],
          Type: blockObject.file.type,
        }
        if (blockObject.file.type === 'external' && blockObject.file.external) {
          file.External = { Url: blockObject.file.external.url }
        } else if (blockObject.file.type === 'file' && blockObject.file.file) {
          file.File = {
            Type: blockObject.file.type,
            Url: blockObject.file.file.url,
            ExpiryTime: blockObject.file.file.expiry_time,
          }
        }
        block.File = file
      }
      break
    case 'code':
      if (blockObject.code) {
        const code: Code = {
          Caption: blockObject.code.caption?.map(_buildRichText) || [],
          RichTexts: blockObject.code.rich_text.map(_buildRichText),
          Language: blockObject.code.language,
        }
        block.Code = code
      }
      break
    case 'quote':
      if (blockObject.quote) {
        const quote: Quote = {
          RichTexts: blockObject.quote.rich_text.map(_buildRichText),
          Color: blockObject.quote.color,
        }
        block.Quote = quote
      }
      break
    case 'equation':
      if (blockObject.equation) {
        const equation: Equation = {
          Expression: blockObject.equation.expression,
        }
        block.Equation = equation
      }
      break
    case 'callout':
      if (blockObject.callout) {
        let icon: FileObject | Emoji | null = null
        if (blockObject.callout.icon) {
          if (
            blockObject.callout.icon.type === 'emoji' &&
            'emoji' in blockObject.callout.icon
          ) {
            icon = {
              Type: blockObject.callout.icon.type,
              Emoji: blockObject.callout.icon.emoji,
            }
          } else if (
            blockObject.callout.icon.type === 'external' &&
            'external' in blockObject.callout.icon
          ) {
            icon = {
              Type: blockObject.callout.icon.type,
              Url: blockObject.callout.icon.external?.url || '',
            }
          }
        }

        const callout: Callout = {
          RichTexts: blockObject.callout.rich_text.map(_buildRichText),
          Icon: icon,
          Color: blockObject.callout.color,
        }
        block.Callout = callout
      }
      break
    case 'synced_block':
      if (blockObject.synced_block) {
        let syncedFrom: SyncedFrom | null = null
        if (
          blockObject.synced_block.synced_from &&
          blockObject.synced_block.synced_from.block_id
        ) {
          syncedFrom = {
            BlockId: blockObject.synced_block.synced_from.block_id,
          }
        }

        const syncedBlock: SyncedBlock = {
          SyncedFrom: syncedFrom,
        }
        block.SyncedBlock = syncedBlock
      }
      break
    case 'toggle':
      if (blockObject.toggle) {
        const toggle: Toggle = {
          RichTexts: blockObject.toggle.rich_text.map(_buildRichText),
          Color: blockObject.toggle.color,
          Children: [],
        }
        block.Toggle = toggle
      }
      break
    case 'embed':
      if (blockObject.embed) {
        const embed: Embed = {
          Url: blockObject.embed.url,
        }
        block.Embed = embed
      }
      break
    case 'bookmark':
      if (blockObject.bookmark) {
        const bookmark: Bookmark = {
          Caption: blockObject.bookmark.caption?.map(_buildRichText) || [],
          Url: blockObject.bookmark.url,
        }
        block.Bookmark = bookmark
      }
      break
    case 'link_preview':
      if (blockObject.link_preview) {
        const linkPreview: LinkPreview = {
          Url: blockObject.link_preview.url,
        }
        block.LinkPreview = linkPreview
      }
      break
    case 'table':
      if (blockObject.table) {
        const table: Table = {
          TableWidth: blockObject.table.table_width,
          HasColumnHeader: blockObject.table.has_column_header,
          HasRowHeader: blockObject.table.has_row_header,
          Rows: [],
        }
        block.Table = table
      }
      break
    case 'column_list':
      const columnList: ColumnList = {
        Columns: [],
      }
      block.ColumnList = columnList
      break
    case 'table_of_contents':
      if (blockObject.table_of_contents) {
        const tableOfContents: TableOfContents = {
          Color: blockObject.table_of_contents.color,
        }
        block.TableOfContents = tableOfContents
      }
      break
    case 'link_to_page':
      if (blockObject.link_to_page && blockObject.link_to_page.page_id) {
        const linkToPage: LinkToPage = {
          Type: blockObject.link_to_page.type,
          PageId: blockObject.link_to_page.page_id,
        }
        block.LinkToPage = linkToPage
      }
      break
  }

  return block
}

async function _getTableRows(blockId: string): Promise<TableRow[]> {
  let results: responses.BlockObject[] = []

  if (fs.existsSync(`tmp/${blockId}.json`)) {
    results = JSON.parse(fs.readFileSync(`tmp/${blockId}.json`, 'utf-8'))
  } else {
    const params: requestParams.RetrieveBlockChildren = {
      block_id: blockId,
    }

    while (true) {
      const res = await retry(
        async (bail) => {
          try {
            return (await client.blocks.children.list(
              params as any // eslint-disable-line @typescript-eslint/no-explicit-any
            )) as responses.RetrieveBlockChildrenResponse
          } catch (error: unknown) {
            if (error instanceof APIResponseError) {
              if (error.status && error.status >= 400 && error.status < 500) {
                bail(error)
              }
            }
            throw error
          }
        },
        {
          retries: numberOfRetry,
        }
      )

      results = results.concat(res.results)

      if (!res.has_more) {
        break
      }

      params['start_cursor'] = res.next_cursor as string
    }
  }

  return results.map((blockObject) => {
    const tableRow: TableRow = {
      Id: blockObject.id,
      Type: blockObject.type,
      HasChildren: blockObject.has_children,
      Cells: [],
    }

    if (blockObject.type === 'table_row' && blockObject.table_row) {
      const cells: TableCell[] = blockObject.table_row.cells.map((cell) => {
        const tableCell: TableCell = {
          RichTexts: cell.map(_buildRichText),
        }

        return tableCell
      })

      tableRow.Cells = cells
    }

    return tableRow
  })
}

async function _getColumns(blockId: string): Promise<Column[]> {
  let results: responses.BlockObject[] = []

  if (fs.existsSync(`tmp/${blockId}.json`)) {
    results = JSON.parse(fs.readFileSync(`tmp/${blockId}.json`, 'utf-8'))
  } else {
    const params: requestParams.RetrieveBlockChildren = {
      block_id: blockId,
    }

    while (true) {
      const res = await retry(
        async (bail) => {
          try {
            return (await client.blocks.children.list(
              params as any // eslint-disable-line @typescript-eslint/no-explicit-any
            )) as responses.RetrieveBlockChildrenResponse
          } catch (error: unknown) {
            if (error instanceof APIResponseError) {
              if (error.status && error.status >= 400 && error.status < 500) {
                bail(error)
              }
            }
            throw error
          }
        },
        {
          retries: numberOfRetry,
        }
      )

      results = results.concat(res.results)

      if (!res.has_more) {
        break
      }

      params['start_cursor'] = res.next_cursor as string
    }
  }

  return await Promise.all(
    results.map(async (blockObject) => {
      const children = await getAllBlocksByBlockId(blockObject.id)

      const column: Column = {
        Id: blockObject.id,
        Type: blockObject.type,
        HasChildren: blockObject.has_children,
        Children: children,
      }

      return column
    })
  )
}

async function _getSyncedBlockChildren(block: Block): Promise<Block[]> {
  return getAllBlocksByBlockId(block.SyncedBlock?.SyncedFrom?.BlockId || '')
}

function _validPageObject(pageObject: responses.PageObject): boolean {
  const prop = pageObject.properties;
  return !!(
    prop.Page?.title && prop.Page.title.length > 0 &&
    prop.Slug?.rich_text && prop.Slug.rich_text.length > 0 &&
    prop.Date?.date
  );
}

async function _buildPost(pageObject: responses.PageObject): Promise<Post> {
  const prop = pageObject.properties;

  let icon: FileObject | Emoji | null = null;
  if (pageObject.icon) {
    if (pageObject.icon.type === 'emoji' && 'emoji' in pageObject.icon) {
      icon = {
        Type: pageObject.icon.type,
        Emoji: pageObject.icon.emoji,
      };
    } else if (pageObject.icon.type === 'external' && 'external' in pageObject.icon) {
      icon = {
        Type: pageObject.icon.type,
        Url: pageObject.icon.external?.url || '',
      };
    } else if (pageObject.icon.type === 'file' && 'file' in pageObject.icon && pageObject.icon.file?.url) {
      icon = {
        Type: pageObject.icon.type,
        Url: pageObject.icon.file.url,
        ExpiryTime: pageObject.icon.file.expiry_time,
      };
    }
  }

  let cover: FileObject | null = null;
  if (pageObject.cover) {
    const coverUrl = pageObject.cover.external?.url || pageObject.cover?.file?.url || '';
    let coverWidth: number | undefined;
    let coverHeight: number | undefined;
    if (coverUrl && !import.meta.env.DEV) {
      const dims = await getImageDimensions(coverUrl);
      coverWidth = dims.width;
      coverHeight = dims.height;
    }
    cover = {
      Type: pageObject.cover.type,
      Url: coverUrl,
      Width: coverWidth,
      Height: coverHeight,
    };
    if (pageObject.cover.type === 'file') {
      cover.ExpiryTime = pageObject.cover.file?.expiry_time;
    }
  }

  let featuredImage: FileObject | null = null;
  if (prop.FeaturedImage?.files && prop.FeaturedImage.files.length > 0) {
    const file = prop.FeaturedImage.files[0];
    const featuredImageUrl = file.external?.url || file.file?.url || '';
    let featuredImageWidth: number | undefined;
    let featuredImageHeight: number | undefined;
    if (featuredImageUrl && !import.meta.env.DEV) {
      const dims = await getImageDimensions(featuredImageUrl);
      featuredImageWidth = dims.width;
      featuredImageHeight = dims.height;
    }
    if (file.type === 'external') {
      featuredImage = {
        Type: file.type,
        Url: featuredImageUrl,
        Width: featuredImageWidth,
        Height: featuredImageHeight,
      };
    } else if (file.type === 'file' && file.file?.url) {
      featuredImage = {
        Type: file.type,
        Url: featuredImageUrl,
        ExpiryTime: file.file.expiry_time,
        Width: featuredImageWidth,
        Height: featuredImageHeight,
      };
    }
  }

  return {
    PageId: pageObject.id,
    Title: prop.Page?.title?.[0]?.plain_text || '',
    Icon: icon,
    Cover: cover,
    Slug: prop.Slug?.rich_text?.[0]?.plain_text || '',
    Date: prop.Date?.date?.start || '',
    UpdateDate: prop.UpdateDate?.last_edited_time || prop.Date?.date?.start || '',
    Tags: prop.Tags?.multi_select || [],
    Excerpt:
      prop.Excerpt?.rich_text?.[0]?.plain_text ||
      prop.Page?.title?.[0]?.plain_text ||
      '',
    MetaDescription: prop.MetaDescription?.rich_text?.[0]?.plain_text || '',
    FeaturedImage: featuredImage,
    Rank: prop.Rank?.number || 0,
    LastEditedDate: pageObject.last_edited_time,
    ExternalLink: prop.ExternalLink?.url || undefined,
    SocialShareHashtags: prop.SocialShareHashtags?.rich_text?.[0]?.plain_text || undefined,
    RelatedPostPageIds: prop.RelatedPosts?.relation?.map((rel: { id: string }) => rel.id) || [],
    InternalTags: prop.InternalTags?.multi_select || [],
    Published: prop.Published?.checkbox || false
  };
}

function _buildRichText(richTextObject: responses.RichTextObject): RichText {
  const annotation: Annotation = {
    Bold: richTextObject.annotations.bold,
    Italic: richTextObject.annotations.italic,
    Strikethrough: richTextObject.annotations.strikethrough,
    Underline: richTextObject.annotations.underline,
    Code: richTextObject.annotations.code,
    Color: richTextObject.annotations.color,
  }

  const richText: RichText = {
    Annotation: annotation,
    PlainText: richTextObject.plain_text,
    Href: richTextObject.href,
  }

  if (richTextObject.type === 'text' && richTextObject.text) {
    const text: Text = {
      Content: richTextObject.text.content,
    }

    if (richTextObject.text.link) {
      text.Link = {
        Url: richTextObject.text.link.url,
      }
    }

    richText.Text = text
  } else if (richTextObject.type === 'equation' && richTextObject.equation) {
    const equation: Equation = {
      Expression: richTextObject.equation.expression,
    }
    richText.Equation = equation
  } else if (richTextObject.type === 'mention' && richTextObject.mention) {
    const mention: Mention = {
      Type: richTextObject.mention.type,
    }

    if (richTextObject.mention.type === 'page' && richTextObject.mention.page) {
      const reference: Reference = {
        Id: richTextObject.mention.page.id,
      }
      mention.Page = reference
    }

    richText.Mention = mention
  }

  return richText
}

// ヘルパー関数: 画像の寸法を取得
async function getImageDimensions(url: string): Promise<{ width?: number; height?: number }> {
  try {
    // URLから画像データを取得
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    const metadata = await sharp(imageBuffer).metadata();
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    console.error(`Error getting image dimensions for ${url}:`, error);
    return { width: undefined, height: undefined };
  }
}
