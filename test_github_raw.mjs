import fs from 'fs';
fetch('https://apiradar.live/api/leaks')
  .then(r=>r.json())
  .then(async data => {
    const leaks = data.leaks.slice(0, 3);
    for (const leak of leaks) {
      if (!leak.repoUrl.includes('github.com')) continue;
      
      const repoPath = leak.repoUrl.replace('https://github.com/', '');
      const rawUrl = `https://raw.githubusercontent.com/${repoPath}/HEAD/${leak.filePath}`;
      console.log('Fetching:', rawUrl);
      
      const res = await fetch(rawUrl);
      if (res.ok) {
         const text = await res.text();
         const match = text.match(/AIzaSy[A-Za-z0-9_\-]{33}/g) || text.match(/sk-[A-Za-z0-9_\-]{30,}/g) || [];
         console.log('Found keys:', match.length > 0 ? match.slice(0, 1) : 'none');
      } else {
         console.log('File not found', res.status);
      }
    }
  });
