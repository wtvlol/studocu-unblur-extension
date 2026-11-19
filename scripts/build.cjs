'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'extension');
const files = ['content.js', 'popup.html', 'popup.css', 'popup.js'];
const base = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json')));
for (const browser of ['chrome', 'firefox']) {
  const dest = path.join(root, 'dist', browser);
  fs.rmSync(dest, {recursive: true, force: true});
  fs.mkdirSync(dest, {recursive: true});
  const manifest = structuredClone(base);
  if (browser === 'firefox') manifest.browser_specific_settings = {gecko: {
    id: 'studocu-unblur@wtvlol', strict_min_version: '140.0',
    data_collection_permissions: {required: ['none']},
  }};
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const file of files) fs.copyFileSync(path.join(source, file), path.join(dest, file));
  const zip = path.join(root, 'dist', `studocu-unblur-${browser}.zip`);
  fs.rmSync(zip, {force: true});
  execFileSync('zip', ['-q', zip, 'manifest.json', ...files], {cwd: dest});
}
console.log('Built dist/chrome, dist/firefox and browser ZIPs.');
