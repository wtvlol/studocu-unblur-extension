(() => {
  'use strict';
  const api = globalThis.browser || chrome;
  const edits = new Map();
  let timer;
  let pages = 0;
  const observer = new MutationObserver(() => {
    if (!timer) timer = setTimeout(scan, 80);
  });
  const observe = () => observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'id'],
  });

  function set(el, property, value) {
    if (el.style.getPropertyValue(property) === value && el.style.getPropertyPriority(property) === 'important') return;
    let properties = edits.get(el);
    if (!properties) edits.set(el, properties = new Map());
    const previous = properties.get(property);
    // If the site replaced an override, restore its latest value after the viewer is replaced.
    if (!previous || el.style.getPropertyValue(property) !== previous.applied ||
        el.style.getPropertyPriority(property) !== 'important') {
      properties.set(property, {value: el.style.getPropertyValue(property),
        priority: el.style.getPropertyPriority(property), applied: value});
    } else previous.applied = value;
    el.style.setProperty(property, value, 'important');
  }

  function unblur(el) {
    const s = getComputedStyle(el);
    for (const property of ['filter', 'backdrop-filter', '-webkit-backdrop-filter']) {
      const value = s.getPropertyValue(property);
      if (value.includes('blur(')) set(el, property, value.replace(/blur\([^)]*\)/g, '').trim() || 'none');
    }
  }

  function restore(el, properties) {
    for (const [property, saved] of properties) {
      if (el.style.getPropertyValue(property) === saved.applied && el.style.getPropertyPriority(property) === 'important') {
        if (saved.value) el.style.setProperty(property, saved.value, saved.priority);
        else el.style.removeProperty(property);
      }
    }
    if (!el.style.length) el.removeAttribute('style');
    edits.delete(el);
  }

  function scan() {
    clearTimeout(timer);
    timer = undefined;
    observer.disconnect();
    const frames = [...document.querySelectorAll('#page-container .pf')];
    pages = frames.filter(frame => frame.querySelector('.pc')).length;
    // The in-viewer upsell is outside .pf, so sibling-cover removal cannot reach it.
    // Match component class suffixes rather than their changing build prefixes.
    const banners = [...document.querySelectorAll('[class*="_inlineBannerWrapper"], [class*="_premiumBannerWrapper"]')].filter(el =>
      [...el.classList].some(name => name.endsWith('_inlineBannerWrapper') || name.endsWith('_premiumBannerWrapper')) &&
      el.querySelector('[class*="_previewBanner"]') &&
      !el.querySelector('#page-container, .pf, .pc, iframe'));
    const relevant = new Set(banners);
    for (const frame of frames) {
      const content = frame.querySelector('.pc');
      if (!content) continue;
      for (let el = content; el; el = el.parentElement) relevant.add(el);
      for (const el of content.querySelectorAll('*')) relevant.add(el);
      for (const sibling of content.parentElement.children) {
        if (sibling === content || sibling.matches('.pc, style, link, script') || sibling.querySelector('.pc')) continue;
        relevant.add(sibling);
      }
    }
    // Restore former viewers and detached nodes rather than retaining them indefinitely.
    for (const [el, properties] of edits) if (!relevant.has(el)) restore(el, properties);
    for (const frame of frames) {
      const content = frame.querySelector('.pc');
      if (!content) continue;
      for (let el = content; el; el = el.parentElement) {
        unblur(el);
        const s = getComputedStyle(el);
        if (s.display === 'none') set(el, 'display', 'block');
        if (s.visibility !== 'visible') set(el, 'visibility', 'visible');
        if (Number(s.opacity) === 0) set(el, 'opacity', '1');
      }
      for (const el of content.querySelectorAll('*')) unblur(el);
      for (const sibling of content.parentElement.children) {
        if (sibling !== content && !sibling.matches('.pc, style, link, script') && !sibling.querySelector('.pc')) set(sibling, 'display', 'none');
      }
    }
    for (const banner of banners) set(banner, 'display', 'none');
    observe();
  }
  api.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type !== 'status') return;
    respond({pages});
  });
  scan();
})();
