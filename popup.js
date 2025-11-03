document.addEventListener('DOMContentLoaded', () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const sourceLangSelect = document.getElementById('sourceLang');
  const saveBtn = document.getElementById('save');
  const testBtn = document.getElementById('test');
  const startBtn = document.getElementById('start');
  const statusDiv = document.getElementById('status');
  const errorDiv = document.getElementById('error');

  // Load saved settings
  browser.storage.local.get(['apiUrl', 'sourceLang']).then(data => {
    apiUrlInput.value = data.apiUrl || 'http://localhost:5001';
    sourceLangSelect.value = data.sourceLang || 'jpn';
    console.log('Loaded settings:', data);
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const apiUrl = apiUrlInput.value.trim();
    const sourceLang = sourceLangSelect.value;
    if (!apiUrl || !/^https?:\/\//.test(apiUrl)) {
      errorDiv.textContent = 'Invalid URL (must start with http:// or https://)';
      return;
    }

    browser.storage.local.set({ apiUrl, sourceLang }).then(() => {
      statusDiv.textContent = 'Settings saved!';
      console.log('Settings saved:', { apiUrl, sourceLang });
      requestPermissions(apiUrl).then(granted => {
        if (granted) statusDiv.textContent += ' Permissions granted.';
      });
    }).catch(err => {
      errorDiv.textContent = `Save error: ${err.message}`;
      console.error('Save error:', err);
    });
  });

  // Test connection
  testBtn.addEventListener('click', () => {
    statusDiv.textContent = 'Testing...';
    errorDiv.textContent = '';
    browser.storage.local.get('apiUrl').then(data => {
      const apiUrl = data.apiUrl;
      if (!apiUrl) {
        errorDiv.textContent = 'No URL set';
        return;
      }

      checkPermissions(apiUrl).then(granted => {
        if (!granted) {
          errorDiv.textContent = 'Permissions not granted for this host. Save again to request.';
          return;
        }

        fetch(`${apiUrl}/api/v1/model`)
          .then(res => res.json())
          .then(d => {
            statusDiv.textContent = `Connected: ${d.result || 'OK'}`;
            console.log('Test success:', d);
          })
          .catch(err => {
            errorDiv.textContent = `Error: ${err.message}`;
            console.error('Test error:', err);
          });
      });
    });
  });

  // Start translation on current tab
  startBtn.addEventListener('click', () => {
    browser.storage.local.get('apiUrl').then(data => {
      checkPermissions(data.apiUrl).then(granted => {
        if (!granted) {
          errorDiv.textContent = 'Permissions not granted. Save to request.';
          return;
        }

        browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
          browser.tabs.sendMessage(tabs[0].id, { action: 'startTranslation' })
            .then(() => {
              statusDiv.textContent = 'Translation started!';
              console.log('Start message sent');
            })
            .catch(err => {
              errorDiv.textContent = `Start error: ${err.message}`;
              console.error('Start error:', err);
            });
        });
      });
    });
  });

  // Request permissions if needed
  async function requestPermissions(url) {
    const origin = new URL(url).origin + '/*';
    const granted = await browser.permissions.request({ origins: [origin] });
    console.log(`Permissions request for ${origin}: ${granted ? 'granted' : 'denied'}`);
    return granted;
  }

  // Check if permissions are already granted
  async function checkPermissions(url) {
    const origin = new URL(url).origin + '/*';
    const hasPerm = await browser.permissions.contains({ origins: [origin] });
    console.log(`Permissions for ${origin}: ${hasPerm ? 'granted' : 'not granted'}`);
    if (!hasPerm) {
      return await requestPermissions(url);
    }
    return true;
  }
});