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

export const getExternalBadgeLabel = (post: Post): string | null => {
  if (!post.ExternalLink) {
    return null
  }

  try {
    const hostname = new URL(post.ExternalLink).hostname.replace(/^www\./, '')
    if (!hostname) {
      return 'External'
    }
    if (hostname === 'note.com') {
      return 'note'
    }
    return hostname
  } catch {
    return 'External'
  }
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

export const isGitHubURL = (url: URL): boolean => {
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    return false
  }
  return /\/[^/]+\/[^/]+\/blob\/[^/]+\/.+/.test(url.pathname)
}

export const isCircuitSimulatorAppletURL = (url: URL): boolean => {
  if (url.hostname !== 'falstad.com' && url.hostname !== 'www.falstad.com') {
    return false
  }

  return url.pathname === '/circuit/circuitjs.html'
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

// ブロックからテキストを抽出する関数
export const extractTextFromBlocks = (blocks: Block[]): string => {
  let text = '';

  blocks.forEach((block) => {
    // 各ブロックタイプからテキストを抽出
    if (block.Paragraph?.RichTexts) {
      text += extractTextFromRichTexts(block.Paragraph.RichTexts) + '\n';
    }
    if (block.Heading1?.RichTexts) {
      text += extractTextFromRichTexts(block.Heading1.RichTexts) + '\n';
    }
    if (block.Heading2?.RichTexts) {
      text += extractTextFromRichTexts(block.Heading2.RichTexts) + '\n';
    }
    if (block.Heading3?.RichTexts) {
      text += extractTextFromRichTexts(block.Heading3.RichTexts) + '\n';
    }
    if (block.BulletedListItem?.RichTexts) {
      text += extractTextFromRichTexts(block.BulletedListItem.RichTexts) + '\n';
    }
    if (block.NumberedListItem?.RichTexts) {
      text += extractTextFromRichTexts(block.NumberedListItem.RichTexts) + '\n';
    }
    if (block.ToDo?.RichTexts) {
      text += extractTextFromRichTexts(block.ToDo.RichTexts) + '\n';
    }
    if (block.Quote?.RichTexts) {
      text += extractTextFromRichTexts(block.Quote.RichTexts) + '\n';
    }
    if (block.Callout?.RichTexts) {
      text += extractTextFromRichTexts(block.Callout.RichTexts) + '\n';
    }
    if (block.Toggle?.RichTexts) {
      text += extractTextFromRichTexts(block.Toggle.RichTexts) + '\n';
    }
    if (block.Code?.RichTexts) {
      text += extractTextFromRichTexts(block.Code.RichTexts) + '\n';
    }

    // 子ブロックがある場合は再帰的に処理
    const children = block.Paragraph?.Children ||
      block.Heading1?.Children ||
      block.Heading2?.Children ||
      block.Heading3?.Children ||
      block.BulletedListItem?.Children ||
      block.NumberedListItem?.Children ||
      block.ToDo?.Children ||
      block.Quote?.Children ||
      block.Callout?.Children ||
      block.Toggle?.Children;

    if (children && children.length > 0) {
      text += extractTextFromBlocks(children);
    }

    // カラムリストの場合
    if (block.ColumnList?.Columns) {
      block.ColumnList.Columns.forEach((column) => {
        if (column.Children) {
          text += extractTextFromBlocks(column.Children);
        }
      });
    }

    // テーブルの場合
    if (block.Table?.Rows) {
      block.Table.Rows.forEach((row) => {
        if (row.Cells) {
          row.Cells.forEach((cell) => {
            if (cell.RichTexts) {
              text += extractTextFromRichTexts(cell.RichTexts) + ' ';
            }
          });
          text += '\n';
        }
      });
    }
  });

  return text;
};

// RichTextsからテキストを抽出する関数
const extractTextFromRichTexts = (richTexts: RichText[]): string => {
  return richTexts.map((richText) => richText.PlainText || '').join('');
};

// 読了時間を計算する関数（日本語対応）
export const calculateReadingTime = (text: string): number => {
  // 改行や空白を整理
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  // 文字数をカウント
  const charCount = cleanedText.length;
  
  // 日本語の平均読書速度（400-600文字/分）
  // ここでは中間値の500文字/分を使用
  const READING_SPEED = 500;
  
  // 読了時間を計算（分単位、最小1分）
  const readingTime = Math.max(1, Math.ceil(charCount / READING_SPEED));
  
  return readingTime;
};

// テキストを単語に分割する関数（日本語対応）
export const tokenizeText = (text: string): string[] => {
  // 簡易的な実装：日本語の文字を1文字ずつ、英単語はスペースで分割
  const words: string[] = [];
  
  // 英単語を抽出
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  words.push(...englishWords.map(w => w.toLowerCase()));
  
  // 日本語の文字を2-gram（2文字の組み合わせ）で抽出
  const japaneseText = text.replace(/[a-zA-Z0-9\s\-_.,!?]/g, '');
  for (let i = 0; i < japaneseText.length - 1; i++) {
    words.push(japaneseText.substring(i, i + 2));
  }
  
  return words;
};

// TF (Term Frequency) を計算する関数
export const calculateTF = (words: string[]): Map<string, number> => {
  const tf = new Map<string, number>();
  const totalWords = words.length;
  
  words.forEach(word => {
    tf.set(word, (tf.get(word) || 0) + 1);
  });
  
  // 正規化（単語の出現回数 / 総単語数）
  tf.forEach((count, word) => {
    tf.set(word, count / totalWords);
  });
  
  return tf;
};

// IDF (Inverse Document Frequency) を計算する関数
export const calculateIDF = (documents: string[][]): Map<string, number> => {
  const idf = new Map<string, number>();
  const totalDocs = documents.length;
  const wordDocCount = new Map<string, number>();
  
  // 各単語が何文書に出現するかをカウント
  documents.forEach(doc => {
    const uniqueWords = new Set(doc);
    uniqueWords.forEach(word => {
      wordDocCount.set(word, (wordDocCount.get(word) || 0) + 1);
    });
  });
  
  // IDF = log(総文書数 / その単語を含む文書数)
  wordDocCount.forEach((count, word) => {
    idf.set(word, Math.log(totalDocs / count));
  });
  
  return idf;
};

// TF-IDFベクトルを計算する関数
export const calculateTFIDF = (tf: Map<string, number>, idf: Map<string, number>): Map<string, number> => {
  const tfidf = new Map<string, number>();
  
  tf.forEach((tfValue, word) => {
    const idfValue = idf.get(word) || 0;
    tfidf.set(word, tfValue * idfValue);
  });
  
  return tfidf;
};

// 余弦類似度を計算する関数
export const calculateCosineSimilarity = (vec1: Map<string, number>, vec2: Map<string, number>): number => {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  // すべての単語を取得
  const allWords = new Set([...vec1.keys(), ...vec2.keys()]);
  
  allWords.forEach(word => {
    const val1 = vec1.get(word) || 0;
    const val2 = vec2.get(word) || 0;
    
    dotProduct += val1 * val2;
    norm1 += val1 * val1;
    norm2 += val2 * val2;
  });
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  
  return denominator === 0 ? 0 : dotProduct / denominator;
};

// 記事の内容類似度を計算する関数
export const calculateContentSimilarity = (
  post1Title: string,
  post1Content: string,
  post2Title: string,
  post2Content: string,
  idf: Map<string, number>
): number => {
  // タイトルと本文を結合（タイトルは重要なので2回繰り返す）
  const text1 = `${post1Title} ${post1Title} ${post1Content}`;
  const text2 = `${post2Title} ${post2Title} ${post2Content}`;
  
  // トークン化
  const words1 = tokenizeText(text1);
  const words2 = tokenizeText(text2);
  
  // TF計算
  const tf1 = calculateTF(words1);
  const tf2 = calculateTF(words2);
  
  // TF-IDF計算
  const tfidf1 = calculateTFIDF(tf1, idf);
  const tfidf2 = calculateTFIDF(tf2, idf);
  
  // 余弦類似度計算
  return calculateCosineSimilarity(tfidf1, tfidf2);
};
