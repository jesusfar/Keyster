const endpoints = [
  '/api/explore',
  '/api/keys',
  '/api/leaks',
  '/api/feed',
  '/api/public/leaks',
  '/api/recent',
  '/trpc/leaks.getRecent',
  '/trpc/keys.getRecent',
  '/api/trpc/leak.getFeed?batch=1&input=%7B%7D',
  '/api/trpc/leak.getLeakedKeys?batch=1&input=%7B%7D'
];

async function check() {
  for (const ep of endpoints) {
    try {
      const res = await fetch('https://apiradar.live' + ep);
      if (res.ok) {
         console.log('FOUND:', ep);
         console.log((await res.text()).substring(0, 200));
      }
    } catch(e) {}
  }
  console.log('Done checking');
}
check();
