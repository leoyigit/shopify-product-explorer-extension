<div align="center">

<img src="icons/icon128.png" width="80" alt="Shopify Product Explorer" />

# Shopify Product Explorer

**A Chrome side panel extension to browse, sort, filter, and export every product from any Shopify store — instantly.**

[![Version](https://img.shields.io/badge/version-1.0.0-96bf48?style=flat-square)](manifest.json)
[![Manifest](https://img.shields.io/badge/manifest-v3-blue?style=flat-square)](manifest.json)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

![Preview](https://raw.githubusercontent.com/leoyigit/shopify-product-explorer-extension/main/preview.png)

</div>

---

## Features

- **Auto-detection** — Scans the page source for any `*.myshopify.com` reference, so it works on custom domains (e.g. `petpaxco.com`) without any manual input
- **Full product data** — Reads directly from `/products.json`; paginates automatically to retrieve all products (250 per page)
- **Sort** by title, price, date, vendor, or product type
- **Filter** by product type, vendor, and stock availability
- **Full-text search** across title, vendor, tags, variant names, and SKUs
- **Expandable cards** with image gallery, variant table (price, SKU, availability), tags, and description
- **Copy myshopify URL** — one click copies the store's `.myshopify.com` address to clipboard
- **Export to JSON** — full raw products array, pretty-printed
- **Export to CSV** — one row per variant with all fields (product info, variant, options, images, URLs)
- **Stays stable** — navigating within the same store (e.g. clicking a product page) does not re-fetch or reset the panel

---

## Installation

> The extension is not yet on the Chrome Web Store. Install it in developer mode:

1. Clone or download this repository
   ```bash
   git clone https://github.com/leoyigit/shopify-product-explorer-extension.git
   ```
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the cloned folder

The extension icon will appear in your Chrome toolbar.

---

## Usage

1. Navigate to any Shopify store
2. Click the **Shopify Product Explorer** icon in the toolbar — the side panel opens
3. The extension automatically detects the store and fetches all products
4. Use the search bar, sort dropdown, and filters to explore
5. Click any product card to expand the full detail view
6. Use **Export JSON** or **Export CSV** to download all products

---

## How It Works

```
Browser Tab (any Shopify store)
        │
        ▼
chrome.scripting.executeScript()
  └─ Scans document.innerHTML for *.myshopify.com pattern
        │
        ▼
Confirmed Shopify store → fetch /products.json?limit=250&page=N
  └─ Paginate until all products retrieved
        │
        ▼
Side Panel renders products with sort / filter / search
```

The extension does **not** use any Shopify API keys or OAuth. It reads the public `/products.json` endpoint that every Shopify storefront exposes.

---

## CSV Export Columns

| Column | Description |
|---|---|
| Product ID | Shopify product ID |
| Title | Product title |
| Handle | URL slug |
| Vendor | Brand / vendor name |
| Product Type | Category |
| Tags | Comma-separated tag list |
| Published At | Publication date |
| Created At | Creation date |
| Updated At | Last update date |
| Variant ID | Shopify variant ID |
| Variant Title | Variant name (e.g. "Large / Black") |
| Price | Sale price |
| Compare At Price | Original price (if on sale) |
| SKU | Stock keeping unit |
| Available | `true` / `false` |
| Option1–3 Name | Option axis name (e.g. "Size") |
| Option1–3 Value | Option value (e.g. "Large") |
| Image URL | First product image URL |
| Product URL | Direct link to product page |

---

## File Structure

```
shopify-product-explorer/
├── manifest.json       # Chrome Extension Manifest v3
├── background.js       # Service worker — tab change events
├── sidepanel.html      # Side panel markup
├── sidepanel.css       # Dark theme styles
├── sidepanel.js        # All logic: detect, fetch, render, export
├── icon.svg            # Source icon
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Permissions

| Permission | Why |
|---|---|
| `sidePanel` | Render the extension as a Chrome side panel |
| `tabs` | Detect active tab changes |
| `activeTab` | Read the current tab URL |
| `scripting` | Inject a one-liner to scan page HTML for the myshopify.com store URL |
| `host_permissions: https://*/*` | Fetch `/products.json` from any Shopify store domain |

---

## Development

No build step required. All files are plain HTML/CSS/JS.

To make changes:
1. Edit any source file
2. Go to `chrome://extensions`
3. Click the **reload** icon on the extension card
4. Refresh the browser tab you're testing on

---

## License

MIT © [Lèo Yigit Ekiz](mailto:leo@10x.ai)
