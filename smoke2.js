const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:3100/game', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Jugar'));
    btn?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: '/tmp/v2_spawn.png' });
  await page.keyboard.down('KeyW');
  await new Promise(r => setTimeout(r, 2200));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 350));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 1400));
  await page.screenshot({ path: '/tmp/v2_bridge.png' });
  await new Promise(r => setTimeout(r, 2500));
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: '/tmp/v2_island2.png' });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
