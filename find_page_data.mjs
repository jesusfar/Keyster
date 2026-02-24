import fs from 'fs';
fetch('https://apiradar.live/')
  .then(res => res.text())
  .then(text => {
    const buildIdMatch = text.match(/"buildId":"([^"]+)"/);
    if (buildIdMatch) {
      const buildId = buildIdMatch[1];
      console.log('Build ID:', buildId);
      fetch(`https://apiradar.live/_next/data/${buildId}/explore.json`)
        .then(r => r.text())
        .then(d => {
           console.log('EXPLORE NEXT DATA:', d.substring(0, 1000));
           const keys = d.match(/sk-[a-zA-Z0-9_\-]{30,}/g);
           console.log('Keys in explore data:', keys ? keys.length : 0);
        });
    } else {
      console.log('No Build ID found');
    }
  }).catch(console.error);
