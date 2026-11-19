const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright-core');
let browser;
before(async () => {
  const executablePath = process.env.CHROME_PATH || [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find(file => fs.existsSync(file));
  browser = await chromium.launch({executablePath, headless: true});
});
after(async () => { await browser?.close(); });
async function setup() {
  const page = await browser.newPage();
  await page.setContent(`<style>.blur { filter: blur(6px) brightness(.8) !important } .pc {display:none} .position {position:absolute;left:15px;transform:scale(.8)}</style>
    <main class="blur" style="opacity:0;visibility:hidden"><div id="page-container"><div class="pf"><div class="pc blur"><span class="position blur">Question</span></div><div id="cover">Cover</div></div></div></main><aside class="blur">Sidebar</aside>`);
  await page.evaluate(() => {
    let message;
    window.chrome = {runtime: {onMessage: {addListener: fn => {message = fn;}}}};
    window.previewStatus = () => {let result; message({type:'status'}, {}, r => result = r); return result;};
  });
  await page.addScriptTag({path: path.resolve('extension/content.js')});
  await page.waitForFunction(() => window.previewStatus()?.pages === 1);
  return page;
}
test('removes blur and covers, preserves layout and unrelated content, restores former ancestors', async () => {
  const page = await setup();
  try {
    const original = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.position'));
      return {filter:s.filter, left:s.left, transform:s.transform, cover:getComputedStyle(document.querySelector('#cover')).display,
        sidebar:getComputedStyle(document.querySelector('aside')).filter, opacity:getComputedStyle(document.querySelector('main')).opacity};
    });
    assert.equal(original.filter, 'brightness(0.8)');
    assert.equal(original.left, '15px');
    assert.equal(original.transform, 'matrix(0.8, 0, 0, 0.8, 0, 0)');
    assert.equal(original.cover, 'none');
    assert.match(original.sidebar, /blur/);
    assert.equal(original.opacity, '1');
    await page.evaluate(() => document.querySelector('#page-container').remove());
    await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).opacity === '0');
    assert.equal(await page.locator('main').getAttribute('style'), 'opacity: 0; visibility: hidden;');
  } finally { await page.close(); }
});
test('observes lazy content, site reblurring and replacement viewers without a mutation loop', async () => {
  const page = await setup();
  try {
    await page.evaluate(() => {
      window.mutations = 0;
      new MutationObserver(() => window.mutations++).observe(document.body, {attributes:true, subtree:true});
      document.querySelector('#page-container').insertAdjacentHTML('beforeend', '<div class="pf"><div class="pc blur" id="late">Lazy</div></div>');
    });
    await page.waitForFunction(() => document.querySelector('#late').style.display === 'block');
    await page.evaluate(() => document.querySelector('#late').style.setProperty('filter','blur(9px)','important'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#late')).filter === 'none');
    await page.waitForTimeout(250);
    const count = await page.evaluate(() => window.mutations);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.mutations), count);
    await page.evaluate(() => document.querySelector('#page-container').remove());
    await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).opacity === '0');
    assert.equal((await page.evaluate(() => window.previewStatus())).pages, 0);
  } finally { await page.close(); }
});
test('hides late in-viewer preview banners without hiding document pages or unrelated dialogs', async () => {
  const page = await setup();
  try {
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="upsell" class="hash_inlineBannerWrapper banner-wrapper"><div class="hash_previewBanner hash_inViewer"><p>This is a preview</p><button>Free Trial</button></div></div>
        <div id="floating" class="hidden-on-mobile hash_premiumBannerWrapper"><div class="hash_previewBanner">This is a preview</div></div>
        <div id="dialog" role="dialog">Sign in</div>
        <div id="other" class="banner-wrapper"><div class="hash_previewBanner">News</div></div>
        <div id="unsafe" class="hash_inlineBannerWrapper banner-wrapper"><div class="hash_previewBanner hash_inViewer"></div><div class="pc">Document content</div></div>`);
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#upsell')).display === 'none');
    assert.equal(await page.locator('#floating').evaluate(el => getComputedStyle(el).display), 'none');
    assert.equal(await page.locator('#dialog').evaluate(el => getComputedStyle(el).display), 'block');
    assert.equal(await page.locator('#other').evaluate(el => getComputedStyle(el).display), 'block');
    assert.equal(await page.locator('#unsafe').evaluate(el => getComputedStyle(el).display), 'block');
    assert.equal(await page.locator('.pf .pc').evaluate(el => getComputedStyle(el).display), 'block');
    await page.evaluate(() => document.querySelector('#upsell').className = 'ordinary');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#upsell')).display === 'block');
  } finally { await page.close(); }
});
test('packages contain only runtime files and correct browser metadata', () => {
  execFileSync(process.execPath, ['scripts/build.cjs']);
  for (const name of ['chrome','firefox']) {
    const dir = `dist/${name}`;
    const manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`));
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.permissions, undefined);
    assert.deepEqual(manifest.content_scripts[0].matches, ['https://*.studocu.com/*']);
    assert.equal(manifest.content_scripts[0].all_frames, true);
    if(name === 'firefox') assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
    else assert.equal(manifest.browser_specific_settings, undefined);
    const entries = execFileSync('unzip', ['-Z1', `dist/studocu-unblur-${name}.zip`], {encoding:'utf8'}).trim().split('\n');
    assert.deepEqual(entries.sort(), ['manifest.json','content.js','popup.html','popup.js','popup.css'].sort());
    for (const file of entries) assert.ok(fs.statSync(`${dir}/${file}`).size);
  }
});
