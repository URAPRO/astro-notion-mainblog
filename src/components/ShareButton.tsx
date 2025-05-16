import React from 'react';
import type { SelectProperty } from '../lib/interfaces';

import {
  TwitterShareButton, XIcon,
  FacebookShareButton, FacebookIcon, FacebookShareCount,
  HatenaShareButton, HatenaIcon, HatenaShareCount,
  ThreadsShareButton, ThreadsIcon
} from 'react-share';

interface Props {
  url: string;
  title: string;
  tags?: SelectProperty[];
  socialShareHashtags?: string;
}

export const SocialShareButtons: React.FC<Props> = (props) => {
  const { url, title, tags = [], socialShareHashtags } = props;
  const buttonStyle = {
    padding: "4px",
    margin: "4px",
    alignItems: "center"
  };

  let generatedHashtags: string[] = [];
  if (socialShareHashtags) {
    generatedHashtags = socialShareHashtags.split(',').map(tag => tag.trim()).filter(tag => tag);
  } else {
    generatedHashtags = tags
      .map(tag => tag.name.replace(/\s+/g, ''))
      .filter(tag => tag);
  }

  const allHashtags = ['あでぃ工房', 'blog', ...generatedHashtags];
  const hashtagsString = allHashtags.map(tag => `#${tag}`).join(' ');

  // アイコン共通の設定
  const iconProps = {
    size: 40,
    round: false,
    borderRadius: 8,
    bgStyle: { fill: '#f5f5f5' },
    iconFillColor: '#333333'
  };

  return (
    <div className="share-buttons-container" style={{ 
      marginTop: '1.5rem', 
      marginBottom: '1.5rem',
      padding: '0.75rem',
      borderTop: '1px solid #eaeaea',
      borderBottom: '1px solid #eaeaea',
    }}>
      <h3 style={{ 
        fontSize: '1rem', 
        fontWeight: 600, 
        marginBottom: '0.75rem',
        color: '#5f76a6',
        display: 'inline-block',
        padding: '0.3rem 0.7rem',
        background: '#f8f9fc',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e6ebf5',
      }}>
        この記事をシェアする
      </h3>
      <div className="share-buttons" style={{ display: 'flex', alignItems: 'center' }}>
        <TwitterShareButton url={url} title={title} hashtags={allHashtags} style={buttonStyle}>
          <XIcon {...iconProps} />
        </TwitterShareButton>
        <ThreadsShareButton url={url} title={`${title} ${hashtagsString}`} style={buttonStyle}>
          <ThreadsIcon {...iconProps} />
        </ThreadsShareButton>
        <FacebookShareButton url={url} style={buttonStyle}>
          <FacebookIcon {...iconProps} />
        </FacebookShareButton>
        <HatenaShareButton url={url} style={buttonStyle}>
          <HatenaIcon {...iconProps} />
        </HatenaShareButton>
      </div>
    </div>
  )
}

