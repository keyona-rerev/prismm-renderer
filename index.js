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

  const { html, width, height } = req.body;
  if (!html) {
    return res.status(400).json({ error: 'No HTML provided' });
  }

  // Default to 1200x627 (LinkedIn landscape), the dimensions
  // generate-draft-visual's design rules actually produce. Callers can
  // override for other formats (e.g. square) without redeploying.
  const w = Number.isFinite(width) ? width : 1200;
  const h = Number.isFinite(height) ? height : 627;

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
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // PNG, not JPEG: this content is branded typography on gradient
    // backgrounds, not a photo. JPEG's lossy compression visibly softens
    // text edges and banding on gradients; PNG is lossless and appropriate
    // for graphic/text-heavy output like this.
    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: w, height: h }
    });

    await browser.close();

    // Return base64 encoded PNG
    res.json({
      success: true,
      image: screenshot.toString('base64'),
      mimeType: 'image/png'
    });

  } catch (e) {
    if (browser) await browser.close();
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Renderer running on port ${PORT}`));
