"use strict";

let allProducts = [];
let currentStoreUrl = null;

const $ = (id) => document.getElementById(id);

const els = {
  emptyState: $("emptyState"),
  loadingState: $("loadingState"),
  loadingText: $("loadingText"),
  errorState: $("errorState"),
  errorMsg: $("errorMsg"),
  mainContent: $("mainContent"),
  storeInfo: $("storeInfo"),
  customDomain: $("customDomain"),
  myshopifyUrl: $("myshopifyUrl"),
  myshopifyText: $("myshopifyText"),
  productCount: $("productCount"),
  downloadBar: $("downloadBar"),
  downloadJson: $("downloadJson"),
  downloadCsv: $("downloadCsv"),
  refreshBtn: $("refreshBtn"),
  searchInput: $("searchInput"),
  sortSelect: $("sortSelect"),
  filterType: $("filterType"),
  filterVendor: $("filterVendor"),
  filterAvail: $("filterAvail"),
  resultsBar: $("resultsBar"),
  productList: $("productList"),
};

function showState(state) {
  ["emptyState", "loadingState", "errorState", "mainContent"].forEach((s) =>
    els[s].classList.add("hidden")
  );
  els[state].classList.remove("hidden");
}

function isValidWebUrl(url) {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol) && u.hostname.length > 0;
  } catch {
    return false;
  }
}

// Inject into the page and scan its HTML source for a *.myshopify.com reference
async function detectShopifyStore(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const html = document.documentElement.innerHTML;
        const m = html.match(/["'`\s(]([\w-]+\.myshopify\.com)[/"'`\s)]/);
        return m ? m[1] : null;
      },
    });
    return results?.[0]?.result ?? null;
  } catch {
    return null;
  }
}

async function fetchAllProducts(origin) {
  const products = [];
  let page = 1;
  const limit = 250;

  while (true) {
    els.loadingText.textContent = `Fetching page ${page}…`;
    const url = `${origin}/products.json?limit=${limit}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(
      res.status === 404
        ? "No /products.json endpoint. This doesn't appear to be a Shopify store."
        : `HTTP ${res.status}: ${res.statusText}`
    );
    const data = await res.json();
    if (!data.products || data.products.length === 0) break;
    products.push(...data.products);
    if (data.products.length < limit) break;
    page++;
  }

  return products;
}

async function loadProducts(tabUrl, tabId) {
  if (!isValidWebUrl(tabUrl)) {
    showState("emptyState");
    return;
  }

  // Same store already loaded — don't re-fetch just because the page changed
  try {
    if (currentStoreUrl && allProducts.length > 0 &&
        new URL(tabUrl).origin === currentStoreUrl) return;
  } catch { /* ignore malformed URLs */ }

  showState("loadingState");
  els.loadingText.textContent = "Detecting Shopify store…";
  els.storeInfo.classList.add("hidden");
  els.downloadBar.classList.add("hidden");
  els.refreshBtn.classList.add("spinning");

  try {
    // Scan page source for embedded *.myshopify.com reference
    const myshopifyHost = await detectShopifyStore(tabId);

    if (!myshopifyHost) {
      showState("emptyState");
      els.refreshBtn.classList.remove("spinning");
      return;
    }

    // Always fetch products from the current origin (custom domain works too)
    const origin = new URL(tabUrl).origin;
    currentStoreUrl = origin;

    allProducts = await fetchAllProducts(origin);

    if (allProducts.length === 0) {
      throw new Error("Store found but no public products. It may be password-protected.");
    }

    populateFilters();
    renderProducts();

    const customHost = new URL(origin).hostname;
    els.customDomain.textContent = customHost;
    els.myshopifyText.textContent = myshopifyHost;
    els.productCount.textContent = `${allProducts.length} products`;
    els.storeInfo.classList.remove("hidden");
    els.downloadBar.classList.remove("hidden");
    showState("mainContent");
  } catch (err) {
    els.errorMsg.textContent = err.message || "Failed to fetch products.";
    showState("errorState");
  } finally {
    els.refreshBtn.classList.remove("spinning");
  }
}

function populateFilters() {
  const types = [...new Set(allProducts.map((p) => p.product_type).filter(Boolean))].sort();
  const vendors = [...new Set(allProducts.map((p) => p.vendor).filter(Boolean))].sort();

  const makeOptions = (select, items, placeholder) => {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select.appendChild(o);
    });
  };

  makeOptions(els.filterType, types, "All Types");
  makeOptions(els.filterVendor, vendors, "All Vendors");
}

function getMinPrice(product) {
  const prices = product.variants.map((v) => parseFloat(v.price) || 0);
  return Math.min(...prices);
}

function getMaxPrice(product) {
  const prices = product.variants.map((v) => parseFloat(v.price) || 0);
  return Math.max(...prices);
}

function isAvailable(product) {
  return product.variants.some((v) => v.available);
}

function filteredAndSorted() {
  const search = els.searchInput.value.trim().toLowerCase();
  const sort = els.sortSelect.value;
  const typeFilter = els.filterType.value;
  const vendorFilter = els.filterVendor.value;
  const availFilter = els.filterAvail.value;

  let list = allProducts.filter((p) => {
    if (typeFilter && p.product_type !== typeFilter) return false;
    if (vendorFilter && p.vendor !== vendorFilter) return false;
    if (availFilter === "available" && !isAvailable(p)) return false;
    if (availFilter === "unavailable" && isAvailable(p)) return false;
    if (search) {
      const haystack = [
        p.title,
        p.vendor,
        p.product_type,
        ...(p.tags || []),
        ...p.variants.map((v) => v.title + " " + v.sku),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    switch (sort) {
      case "title-asc":
        return a.title.localeCompare(b.title);
      case "title-desc":
        return b.title.localeCompare(a.title);
      case "price-asc":
        return getMinPrice(a) - getMinPrice(b);
      case "price-desc":
        return getMaxPrice(b) - getMaxPrice(a);
      case "date-desc":
        return new Date(b.created_at) - new Date(a.created_at);
      case "date-asc":
        return new Date(a.created_at) - new Date(b.created_at);
      case "vendor-asc":
        return (a.vendor || "").localeCompare(b.vendor || "");
      case "type-asc":
        return (a.product_type || "").localeCompare(b.product_type || "");
      default:
        return 0;
    }
  });

  return list;
}

function formatPrice(price) {
  const n = parseFloat(price);
  return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildCard(product) {
  const available = isAvailable(product);
  const minPrice = getMinPrice(product);
  const maxPrice = getMaxPrice(product);
  const priceStr =
    minPrice === maxPrice
      ? formatPrice(minPrice)
      : `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`;

  const comparePrice = product.variants[0]?.compare_at_price;
  const hasDiscount = comparePrice && parseFloat(comparePrice) > minPrice;

  const thumb = product.images?.[0]?.src;

  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.id = product.id;

  // Build variants table rows
  const variantRows = product.variants
    .map((v) => {
      const dot = `<span class="avail-dot ${v.available ? "yes" : "no"}"></span>`;
      const compare =
        v.compare_at_price && parseFloat(v.compare_at_price) > parseFloat(v.price)
          ? `<span class="compare">${formatPrice(v.compare_at_price)}</span> `
          : "";
      return `<tr>
        <td>${escHtml(v.title)}</td>
        <td class="price-cell">${compare}${formatPrice(v.price)}</td>
        <td>${escHtml(v.sku || "—")}</td>
        <td>${dot}</td>
      </tr>`;
    })
    .join("");

  // Tags
  const tags =
    product.tags && product.tags.length
      ? `<div class="info-section">
          <div class="info-label">Tags</div>
          <div class="tags-list">${product.tags.map((t) => `<span class="tag">${escHtml(t)}</span>`).join("")}</div>
        </div>`
      : "";

  // Images gallery (skip first, already in header)
  const extraImages =
    product.images?.length > 1
      ? `<div class="image-gallery">${product.images
          .map(
            (img) =>
              `<img class="gallery-img" src="${img.src}" alt="${escHtml(img.alt || product.title)}" loading="lazy" />`
          )
          .join("")}</div>`
      : "";

  // Description
  const desc = product.body_html
    ? `<div class="info-section">
        <div class="info-label">Description</div>
        <div class="description">${product.body_html}</div>
      </div>`
    : "";

  const productUrl = currentStoreUrl + "/products/" + product.handle;

  card.innerHTML = `
    <div class="card-header">
      ${
        thumb
          ? `<img class="card-thumb" src="${thumb}" alt="${escHtml(product.title)}" loading="lazy" />`
          : `<div class="card-thumb-placeholder"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
      }
      <div class="card-meta">
        <div class="card-title">${escHtml(product.title)}</div>
        <div class="card-sub">
          ${product.vendor ? `<span>${escHtml(product.vendor)}</span>` : ""}
          ${product.product_type ? `<span>· ${escHtml(product.product_type)}</span>` : ""}
          ${product.created_at ? `<span>· ${formatDate(product.created_at)}</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
          <span class="card-price">
            ${hasDiscount ? `<span class="compare">${formatPrice(comparePrice)}</span> ` : ""}
            ${priceStr}
          </span>
          <span class="badge ${available ? "badge-available" : "badge-sold-out"}">${available ? "In Stock" : "Sold Out"}</span>
        </div>
      </div>
      <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
    <div class="card-body">
      ${extraImages}
      <div class="info-section">
        <div class="info-label">Variants (${product.variants.length})</div>
        <table class="variants-table">
          <thead><tr><th>Variant</th><th>Price</th><th>SKU</th><th>Avail</th></tr></thead>
          <tbody>${variantRows}</tbody>
        </table>
      </div>
      ${tags}
      ${desc}
      <a class="view-link" href="${productUrl}" target="_blank">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        View on Store
      </a>
    </div>
  `;

  card.querySelector(".card-header").addEventListener("click", () => {
    card.classList.toggle("expanded");
  });

  return card;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderProducts() {
  const list = filteredAndSorted();
  els.resultsBar.textContent = `Showing ${list.length} of ${allProducts.length} products`;
  els.productList.innerHTML = "";
  list.forEach((p) => els.productList.appendChild(buildCard(p)));
}

// Copy myshopify URL
els.myshopifyUrl.addEventListener("click", () => {
  const text = els.myshopifyText.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const copyIcon = els.myshopifyUrl.querySelector(".copy-icon");
    const checkIcon = els.myshopifyUrl.querySelector(".check-icon");
    copyIcon.classList.add("hidden");
    checkIcon.classList.remove("hidden");
    setTimeout(() => {
      copyIcon.classList.remove("hidden");
      checkIcon.classList.add("hidden");
    }, 1800);
  });
});

// Download helpers
function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function storeSlug() {
  const host = els.myshopifyText.textContent || "products";
  return host.replace(".myshopify.com", "");
}

function downloadJson() {
  const json = JSON.stringify({ products: allProducts }, null, 2);
  triggerDownload(json, `${storeSlug()}-products.json`, "application/json");
}

function downloadCsv() {
  const CSV_COLS = [
    "Product ID", "Title", "Handle", "Vendor", "Product Type", "Tags",
    "Published At", "Created At", "Updated At",
    "Variant ID", "Variant Title", "Price", "Compare At Price",
    "SKU", "Available", "Option1 Name", "Option1 Value",
    "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value",
    "Image URL", "Product URL",
  ];

  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = [CSV_COLS.join(",")];

  allProducts.forEach((p) => {
    const opt = p.options || [];
    const tags = Array.isArray(p.tags) ? p.tags.join(", ") : (p.tags || "");
    const productUrl = `${currentStoreUrl}/products/${p.handle}`;

    p.variants.forEach((v) => {
      rows.push([
        p.id, p.title, p.handle, p.vendor, p.product_type, tags,
        p.published_at, p.created_at, p.updated_at,
        v.id, v.title, v.price, v.compare_at_price || "",
        v.sku || "", v.available,
        opt[0]?.name || "", v.option1 || "",
        opt[1]?.name || "", v.option2 || "",
        opt[2]?.name || "", v.option3 || "",
        p.images?.[0]?.src || "", productUrl,
      ].map(esc).join(","));
    });
  });

  triggerDownload(rows.join("\n"), `${storeSlug()}-products.csv`, "text/csv");
}

els.downloadJson.addEventListener("click", downloadJson);
els.downloadCsv.addEventListener("click", downloadCsv);

// Controls
els.refreshBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.url) loadProducts(tab.url, tab.id);
  });
});

els.searchInput.addEventListener("input", renderProducts);
els.sortSelect.addEventListener("change", renderProducts);
els.filterType.addEventListener("change", renderProducts);
els.filterVendor.addEventListener("change", renderProducts);
els.filterAvail.addEventListener("change", renderProducts);

// Tab change messages from background — re-query to get the tabId
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TAB_CHANGED" && msg.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.url) loadProducts(tab.url, tab.id);
    });
  }
});

// Initial load
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab?.url) loadProducts(tab.url, tab.id);
});
