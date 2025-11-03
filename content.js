let worker = null;
let observer = null;
let mutationObserver = null;
let cache = new Map(); // Image src -> translation

// Debounce function to throttle processing
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

const debouncedProcess = debounce(processImage, 500);

// Listen for messages
browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === 'startTranslation') {
    console.log('Start translation message received');
    await initWorker();
    startObserving();
    processVisibleImages(); // New: Process already visible images
  }
});

// Init Tesseract
async function initWorker() {
  if (worker) return;

  try {
    const { sourceLang } = await browser.storage.local.get('sourceLang');
    const lang = sourceLang || 'jpn';
    console.log('Initializing Tesseract for language:', lang);

    worker = await Tesseract.createWorker(lang, 1, {
      workerPath: browser.runtime.getURL('tesseract/worker.min.js'),
      corePath: browser.runtime.getURL('tesseract/tesseract-core.wasm.js'),
      langPath: browser.runtime.getURL('tesseract/traineddata'),
      workerBlobURL: false,
    });

    console.log('Tesseract worker ready');
  } catch (err) {
    console.error('Worker init error:', err);
  }
}

// Start IntersectionObserver
function startObserving() {
  if (observer) return;

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.tagName === 'IMG' && img.width > 100 && img.height > 50) {
          console.log('Visible image detected:', img.src);
          debouncedProcess(img);
        }
      }
    });
  }, { threshold: 0.5 });

  // Observe existing images
  const images = document.querySelectorAll('img');
  if (images.length === 0) console.log('No images found on page');
  images.forEach(img => observer.observe(img));
  console.log('Observer started');

  // New: MutationObserver for new images (lazy-loading)
  mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === 'IMG' && node.width > 100 && node.height > 50) {
            observer.observe(node);
            console.log('New image added and observed:', node.src);
          }
        });
      }
    });
  });

  mutationObserver.observe(document.body, { childList: true, subtree: true });
  console.log('MutationObserver started for new images');
}

// New: Manually process already visible images on start
function processVisibleImages() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    if (img.width > 100 && img.height > 50) {
      const rect = img.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.left >= 0 &&
                        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                        rect.right <= (window.innerWidth || document.documentElement.clientWidth);
      if (isVisible) {
        console.log('Already visible image detected on start:', img.src);
        debouncedProcess(img);
      }
    }
  });
}

// Process image
async function processImage(img) {
  const src = img.src;
  if (cache.has(src)) {
    console.log('Using cached translation for:', src);
    return injectOverlay(img, cache.get(src));
  }

  try {
    // Fetch as blob to handle CORS
    const response = await fetch(src);
    const blob = await response.blob();
    console.log('Image fetched as blob:', src);

    // OCR
    const { data: { text } } = await worker.recognize(blob);
    if (!text.trim()) {
      console.log('No text from OCR:', src);
      return;
    }
    console.log('OCR text:', text);

    // Translate with better error check
    let transResponse;
    try {
      transResponse = await browser.runtime.sendMessage({
        action: 'translate',
        text: text
      });
    } catch (msgErr) {
      console.error('SendMessage failed:', msgErr);
      return;
    }

    if (transResponse.error) {
      console.error('Translation error:', transResponse.error);
      return;
    }

    const translation = transResponse.translation;
    console.log('Translation:', translation);
    cache.set(src, translation);
    injectOverlay(img, translation);
  } catch (err) {
    console.error('Process error:', err);
  }
}

// Inject overlay
function injectOverlay(img, text) {
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.background = 'rgba(255, 255, 0, 0.8)';
  overlay.style.color = 'black';
  overlay.style.padding = '5px';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '9999';
  overlay.textContent = text;

  const rect = img.getBoundingClientRect();
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.top = `${rect.top + window.scrollY}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  document.body.appendChild(overlay);
  console.log('Overlay injected for:', img.src);
}