import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('api') || url.includes('json') || url.includes('trpc') || url.includes('graphql')) {
      try {
        const text = await response.text();
        if (text.includes('sk-') || text.includes('key')) {
           console.log('FOUND API:', url);
           console.log('Sample data:', text.substring(0, 300));
        }
      } catch (e) {}
    }
  });

  await page.goto('https://apiradar.live/explore', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
