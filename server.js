const express = require('express');
const axios = require('axios');
const { parse } = require('node-html-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Your UI page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// The Proxy Engine
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("No URL provided.");

    try {
        const response = await axios.get(targetUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Encoding': 'identity' // Prevents compressed data issues
            },
            responseType: 'text'
        });

        const urlObj = new URL(targetUrl);
        const origin = urlObj.origin;
        const root = parse(response.data);

        // --- THE REWRITER LOGIC ---
        const rewriteAttr = (tagName, attr) => {
            root.querySelectorAll(tagName).forEach(el => {
                let val = el.getAttribute(attr);
                if (!val || val.startsWith('data:') || val.startsWith('javascript:')) return;

                // Resolve relative paths to absolute
                try {
                    const absolute = new URL(val, targetUrl).href;
                    // Wrap the link to point back through our proxy
                    el.setAttribute(attr, `/proxy?url=${encodeURIComponent(absolute)}`);
                } catch (e) {}
            });
        };

        // Rewrite links, images, scripts, and forms
        rewriteAttr('a', 'href');
        rewriteAttr('img', 'src');
        rewriteAttr('script', 'src');
        rewriteAttr('link', 'href');
        rewriteAttr('form', 'action');

        // --- INJECT HELPER SCRIPT ---
        // This ensures dynamic JS fetches also go through the proxy
        const scriptInjection = `
            <script>
                window._PROXY_URL = "${origin}";
                console.log("Proxy injected successfully.");
            </script>
        `;
        root.insertAdjacentHTML('afterbegin', scriptInjection);

        // Clean headers to allow iframing
        res.set({
            'Content-Type': response.headers['content-type'],
            'Access-Control-Allow-Origin': '*',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data:; script-src * 'unsafe-inline' 'unsafe-eval';"
        });

        res.send(root.toString());
    } catch (err) {
        res.status(500).send(`Proxy Error: ${err.message}`);
    }
});

app.listen(PORT, () => console.log(`Proxy running at http://localhost:${PORT}`));
