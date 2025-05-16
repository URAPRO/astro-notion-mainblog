import React from 'react';
import type { SelectProperty } from '../lib/interfaces';

import {
  TwitterShareButton, XIcon,
  FacebookShareButton, FacebookIcon, FacebookShareCount,
  HatenaShareButton, HatenaIcon, HatenaShareCount,
} from 'react-share';

interface Props {
  url: string;
  title: string;
  tags?: SelectProperty[];
}

export const SocialShareButtons: React.FC<Props> = (props) => {
  const { url, title, tags = [] } = props;
  const buttonStyle = {
    padding: "4px",
    margin: "4px",
    alignItems: "center"
  };

  const generatedHashtags = tags
    .map(tag => tag.name.replace(/\s+/g, ''))
    .filter(tag => tag);

  const allHashtags = ['あでぃの製作所', ...generatedHashtags];

  return (
    <>
      <HatenaShareButton url={url} style={buttonStyle}>
        <HatenaIcon round size={40} />
        {/*<HatenaShareCount url={url} className="text-blue-600 font-semibold" />*/}
      </HatenaShareButton>
      <FacebookShareButton url={url} style={buttonStyle}>
        <FacebookIcon round size={40} />
        {/*<FacebookShareCount url={url} className="text-blue-600 font-semibold" />*/}
      </FacebookShareButton>
      <TwitterShareButton url={url} title={title} hashtags={allHashtags} style={buttonStyle}>
        <XIcon size={40} round />
      </TwitterShareButton>
    </>
  )
}

