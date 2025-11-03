let apiUrl = 'http://localhost:5001'; // Default

// Load saved API URL
browser.storage.local.get('apiUrl').then(data => {
  if (data.apiUrl) apiUrl = data.apiUrl;
  console.log('Background loaded API URL:', apiUrl);
});

// Listen for storage changes
browser.storage.onChanged.addListener((changes) => {
  if (changes.apiUrl) {
    apiUrl = changes.apiUrl.newValue;
    console.log('API URL updated in background:', apiUrl);
  }
});

// Handle messages asynchronously
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    console.log('Translate request received, using API:', apiUrl);
    translateText(message.text).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true; // Indicates async response
  }
});

// Translate
async function translateText(text) {
  try {
    const { sourceLang } = await browser.storage.local.get('sourceLang');
    const lang = sourceLang || 'jpn';
    const langName = { jpn: 'Japanese', kor: 'Korean', chi_sim: 'Chinese' }[lang];

    const prompt = `Translate the following ${langName} manga text to natural English, preserving style and tone: ${text}`;

    console.log('Sending translation request to:', apiUrl);
    console.log('Prompt:', prompt);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout

    const response = await fetch(`${apiUrl}/api/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        max_tokens: 200,
        temperature: 0.7,
        stop: ['\n']
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    const translation = data.results[0].text.trim();
    console.log('Translation response:', translation);
    return { translation };
  } catch (err) {
    console.error('Translation error:', err);
    if (err.name === 'AbortError') {
      return { error: 'Request timed out after 10 minutes' };
    }
    return { error: err.message };
  }
}