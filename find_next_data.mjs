import fs from 'fs';
fetch('https://apiradar.live/explore')
  .then(res => res.text())
  .then(text => {
    const nextDataMatch = text.match(/<script id="__NEXT_DATA__".*?>(.*?)<\/script>/);
    if (nextDataMatch) {
      const data = nextDataMatch[1];
      console.log('NEXT_DATA length:', data.length);
      const keys = data.match(/sk-[a-zA-Z0-9_\-]{30,}/g);
      console.log('Keys in NEXT_DATA:', keys ? keys.length : 0);
      if (keys) console.log(keys.slice(0, 3));
    } else {
      console.log('No NEXT_DATA found');
    }
  }).catch(console.error);
