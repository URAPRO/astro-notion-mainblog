import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getAllPosts } from '../../lib/notion/client';
import type { Post } from '../../lib/interfaces';

// 日本語フォントを読み込む
async function loadFont(): Promise<ArrayBuffer> {
  // M PLUS Rounded 1c フォントを使用（サイトと統一）
  const fontUrl = 'https://fonts.gstatic.com/s/mplusrounded1c/v15/VdGCAYIAV6gnpUpoWwNkYvrugw9RuM3ixLsg6-av1x0.woff2';
  const fontResponse = await fetch(fontUrl);
  return fontResponse.arrayBuffer();
}

// 静的パス生成
export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getAllPosts();
  return posts.map((post: Post) => ({
    params: { slug: post.Slug },
    props: { post },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const post = props.post as Post;
  
  // フォントを読み込む
  let fontData: ArrayBuffer;
  try {
    fontData = await loadFont();
  } catch {
    // フォールバック: システムフォントを使用
    const fallbackResponse = await fetch(
      'https://cdn.jsdelivr.net/npm/@aspect-build/aspect-fonts@0.0.1/noto-sans-jp-v52-japanese-700.woff'
    );
    fontData = await fallbackResponse.arrayBuffer();
  }

  // タグを整形（最大3つ）
  const tags = post.Tags?.slice(0, 3).map(tag => tag.name) || [];

  // フォントサイズを動的に計算
  const titleLength = post.Title.length;
  let fontSize = 64;
  if (titleLength > 50) fontSize = 40;
  else if (titleLength > 40) fontSize = 48;
  else if (titleLength > 30) fontSize = 52;

  // SVGを生成
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          // ウォームカラーパレット（サイトに合わせた配色）
          background: 'linear-gradient(145deg, #fdfbf7 0%, #f5f0e8 50%, #e8e2d9 100%)',
          padding: '50px 60px',
          fontFamily: 'M PLUS Rounded 1c',
          position: 'relative',
        },
        children: [
          // 背景装飾（左側のアクセントバー）
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '12px',
                background: 'linear-gradient(180deg, #e07a3d 0%, #8b7355 100%)',
              },
            },
          },
          // 背景装飾（右下の円）
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                right: '-100px',
                bottom: '-100px',
                width: '350px',
                height: '350px',
                borderRadius: '50%',
                background: 'rgba(224, 122, 61, 0.1)',
              },
            },
          },
          // 上部: サイト名
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #e07a3d 0%, #c46830 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '28px',
                      boxShadow: '0 4px 12px rgba(224, 122, 61, 0.3)',
                    },
                    children: '🛠',
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '32px',
                      color: '#2d2a26',
                      fontWeight: 'bold',
                    },
                    children: 'あでぃ工房',
                  },
                },
              ],
            },
          },
          // 中央: タイトル
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                flex: 1,
                justifyContent: 'center',
                paddingRight: '40px',
              },
              children: [
                {
                  type: 'h1',
                  props: {
                    style: {
                      fontSize: `${fontSize}px`,
                      fontWeight: 'bold',
                      color: '#2d2a26',
                      lineHeight: 1.35,
                      margin: 0,
                      letterSpacing: '-0.02em',
                    },
                    children: post.Title,
                  },
                },
              ],
            },
          },
          // 下部: タグ
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                gap: '14px',
                flexWrap: 'wrap',
              },
              children: tags.map((tag) => ({
                type: 'span',
                props: {
                  style: {
                    padding: '10px 24px',
                    background: 'rgba(224, 122, 61, 0.15)',
                    borderRadius: '24px',
                    fontSize: '22px',
                    color: '#e07a3d',
                    fontWeight: 'bold',
                  },
                  children: `#${tag}`,
                },
              })),
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'M PLUS Rounded 1c',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );

  // SVGをPNGに変換
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 1200,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return new Response(pngBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

