# Studocu Unblur

A small Chrome and Firefox extension that automatically removes CSS blur from loaded Studocu document previews. There is no toggle or setup: open a supported document and it runs. Click its toolbar icon to check preview status.

It supports the `#page-container .pf .pc` viewer, including pages added as you scroll and viewers inside matching Studocu frames. It removes blur from content and affected wrappers, reveals hidden page containers, and hides sibling preview covers. Text positioning, other filters, images and unrelated page UI are preserved.

Only content already supplied to your browser can be revealed. Missing pages and blur embedded in image pixels cannot be recovered. Site layout changes may require updated selectors. The status popup reports the responding frame's loaded page count, not total document coverage.

## Install

Download the source, then build with Node.js 22+ and the `zip` command installed:

```sh
npm ci
npm run build
```

**Chrome:** Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist/chrome`. Keep that folder in place. Reload existing Studocu tabs after installation.

**Firefox 140+:** Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, then select `dist/firefox/manifest.json`. The temporary installation lasts until Firefox restarts. For permanent installation in standard Firefox, submit `dist/studocu-unblur-firefox.zip` to Mozilla for signing and install the resulting signed XPI. This project does not include a signed build.

The build also creates `dist/studocu-unblur-chrome.zip` and `dist/studocu-unblur-firefox.zip`. Each contains runtime files only. To undo presentation changes, disable the extension through your browser and reload the document.

## Privacy

All processing happens locally. The extension makes no network requests, collects no data, and uses no cookies, storage or analytics. Its content script runs only on HTTPS Studocu pages and matching frames. No background process or external service is used.

## Development

```sh
npm test
npm run build
```

Tests use an installed Chrome/Chromium browser. Set `CHROME_PATH` if it is not in a standard location. They check ancestor and content blur, cover removal, preservation of layout and unrelated content, lazy loading, site reblurring, restoration after viewer removal, absence of mutation loops, and package contents.

Installation smoke checks passed in local Chrome and Firefox 160.0.1 with disposable profiles and synthetic DOM fixtures. Chrome also verified runtime status messaging. Firefox loaded the unsigned package as a temporary add-on. These checks do not establish compatibility with every live Studocu document; the Firefox fixture was inserted into a Studocu-origin page rather than taken from a real document.

Source lives in `extension/`; `scripts/build.cjs` produces both browser packages. The former PDF, capture and agent tools have been removed. Existing ignored `output/` and `work/` artifacts remain local and are excluded from packages and publication.

Manifest references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Firefox metadata and data declarations](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).
