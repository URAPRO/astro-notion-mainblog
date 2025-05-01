import fs from 'fs/promises';
import path from 'path';

interface AmazonProductInfo {
  title: string;
  price: string;
  updatedAt: string;
}

// distディレクトリ内にキャッシュディレクトリを作成
const CACHE_DIR = path.join(process.cwd(), 'public', 'notion', '.amazon-cache');

// キャッシュディレクトリの作成
async function ensureCacheDir() {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    // distディレクトリが存在しない場合は作成
    const distDir = path.join(process.cwd(), 'dist');
    try {
      await fs.access(distDir);
    } catch {
      await fs.mkdir(distDir, { recursive: true });
    }
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
}

// ASINからキャッシュファイルのパスを取得
function getCachePath(asin: string): string {
  return path.join(CACHE_DIR, `${asin}.json`);
}

// キャッシュから商品情報を取得
export async function getCachedProductInfo(asin: string): Promise<AmazonProductInfo | null> {
  try {
    const cachePath = getCachePath(asin);
    const data = await fs.readFile(cachePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// 商品情報をキャッシュに保存
export async function cacheProductInfo(asin: string, info: AmazonProductInfo): Promise<void> {
  await ensureCacheDir();
  const cachePath = getCachePath(asin);
  await fs.writeFile(cachePath, JSON.stringify(info, null, 2));
}

// Amazonから商品情報を取得
export async function fetchAmazonProductInfo(url: URL): Promise<AmazonProductInfo | null> {
  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    // タイトルを抽出
    const titleMatch = html.match(/<span id="productTitle"[^>]*>([^<]+)<\/span>/);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 品切れかどうかを判定
    const isOutOfStock = html.includes('この商品は現在お取り扱いできません') ||
                        html.includes('現在在庫切れです');
    
    if (isOutOfStock) {
      return {
        title,
        price: '品切れ',
        updatedAt: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}日現在`
      };
    }
    
    // 価格を抽出
    const priceMatch = html.match(/id="priceblock_ourprice"[^>]*>([^<]+)</) || 
                      html.match(/id="price_inside_buybox"[^>]*>([^<]+)</) ||
                      html.match(/<span class="a-price-whole">([^<]+)<\/span>/);
    const price = priceMatch ? `¥${priceMatch[1].trim().replace(/[^\d]/g, ',')}` : '';

    // 現在の日付を取得
    const today = new Date();
    const updatedAt = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日現在`;

    return { title, price, updatedAt };
  } catch (error) {
    console.error('Error fetching Amazon product info:', error);
    return null;
  }
}

// URLからASINを抽出
export function extractASIN(url: URL): string | null {
  try {
    const match = url.pathname.match(/\/(?:dp|ASIN)\/([A-Z0-9]{10})/);
    if (match && match[1]) {
      return match[1];
    }
    return url.searchParams.get('ASIN') || url.searchParams.get('asin') || null;
  } catch (e) {
    console.error('Error extracting ASIN:', e);
    return null;
  }
} 