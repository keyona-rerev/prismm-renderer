const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json({ limit: '5mb' }));

// Simple auth — we'll set this as an env variable in Railway
const API_KEY = process.env.RENDER_API_KEY;

app.post('/render', async (req, res) => {
  // Check auth
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { html } = req.body;
  if (!html) {
    return res.status(400).json({ error: 'No HTML provided' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      headless: 'new'
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 95,
      clip: { x: 0, y: 0, width: 1200, height: 1200 }
    });

    await browser.close();

    // Return base64 encoded JPEG
    res.json({
      success: true,
      image: screenshot.toString('base64'),
      mimeType: 'image/jpeg'
    });

  } catch (e) {
    if (browser) await browser.close();
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Renderer running on port ${PORT}`));
