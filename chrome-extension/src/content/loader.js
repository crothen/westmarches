// West Marches Extension Loader
// This tiny script loads the actual content from the hosted site
// so updates are instant without re-downloading the extension

(function() {
  const BASE_URL = 'https://westmarches-dnd.web.app/ext';
  const VERSION = Date.now(); // Cache bust
  
  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${BASE_URL}/content.css?v=${VERSION}`;
  document.head.appendChild(link);
  
  // Load JS
  const script = document.createElement('script');
  script.src = `${BASE_URL}/content.js?v=${VERSION}`;
  script.onload = () => console.log('[WM Extension] Loaded from', BASE_URL);
  script.onerror = () => console.error('[WM Extension] Failed to load from', BASE_URL);
  document.head.appendChild(script);
})();
