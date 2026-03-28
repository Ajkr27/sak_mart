import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAiszcxFF4dTJiEx65rWeAGLPV96OaZx4",
  authDomain: "sak-mart.firebaseapp.com",
  projectId: "sak-mart",
  storageBucket: "sak-mart.firebasestorage.app",
  messagingSenderId: "699760173891",
  appId: "1:699760173891:web:980dae0662fcc1a84c05f6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * SAK MART — script.js
 * Pure vanilla JS SPA — no frameworks, no dependencies
 * ─────────────────────────────────────────────────────
 */

'use strict';

/* ═══════════════════════════════════════════════════
   GENERATE 100 BLANK PRODUCTS
   Everything is decided by the user — no auto names
═══════════════════════════════════════════════════ */
function generateProducts() {
  const products = [];
  for (let i = 1; i <= 100; i++) {
    products.push({
      id:         i,
      name:       '',    // user fills in
      price:      0,     // user fills in
      category:   '',    // user fills in
      images:     [],    // user uploads
      defaultImg: null,  // neutral placeholder
    });
  }
  return products;
}

/* ═══════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════ */
const state = {
  products:        generateProducts(),
  filteredProducts:[],
  currentView:     'home',
  currentProduct:  null,
  currentQty:      1,
  cart:            [],        // [{product, qty}]
  qrCodeDataUrl:   null,
  currentThumb:    0,
  searchQuery:     '',
  sortMode:        'default',
};

// Initialize filtered list
state.filteredProducts = [...state.products];

/* ═══════════════════════════════════════════════════
   PLACEHOLDER IMAGE GENERATOR
   Clean neutral tile — no auto text, just slot number
═══════════════════════════════════════════════════ */
function generatePlaceholder(id) {
  const canvas  = document.createElement('canvas');
  canvas.width  = 400;
  canvas.height = 400;
  const ctx     = canvas.getContext('2d');

  // Solid dark background
  ctx.fillStyle = '#18181f';
  ctx.fillRect(0, 0, 400, 400);

  // Subtle dot-grid pattern
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 20; x < 400; x += 30) {
    for (let y = 20; y < 400; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Dashed centre box (image upload hint)
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(60, 60, 280, 280);
  ctx.setLineDash([]);

  // Upload icon
  ctx.font = '48px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📷', 200, 185);

  // "Upload image" hint
  ctx.font = '500 14px "DM Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillText('Upload image', 200, 248);

  // Slot number (small, bottom-right)
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.textAlign = 'right';
  ctx.fillText(`#${String(id).padStart(3,'0')}`, 375, 375);

  return canvas.toDataURL('image/png');
}

/* ─── Pre-generate placeholders ─── */
state.products.forEach(p => {
  p.defaultImg = generatePlaceholder(p.id);
});

/* ═══════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════ */
function navigateTo(view) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add('active');
  state.currentView = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Show/hide search bar (only on home)
  const searchWrap = document.querySelector('.header-search');
  if (searchWrap) searchWrap.style.visibility = (view === 'home') ? 'visible' : 'hidden';
}

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */

/** Get the best image URL for a product */
function getProductImage(product, index = 0) {
  if (product.images && product.images.length > index) return product.images[index];
  return product.defaultImg;
}

/** Format price in INR */
function formatPrice(price) {
  return `₹${parseFloat(price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Show a brief toast notification */
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/** Animate the cart badge */
function animateCartBadge() {
  const badge = document.getElementById('cart-count');
  badge.classList.remove('bump');
  // Force reflow
  void badge.offsetWidth;
  badge.classList.add('bump');
}

/** Update cart count display */
function updateCartDisplay() {
  const total = state.cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('cart-count').textContent = total;
}

/* ═══════════════════════════════════════════════════
   HOME — RENDER PRODUCT GRID
═══════════════════════════════════════════════════ */
function renderGrid() {
  const grid     = document.getElementById('product-grid');
  const noResult = document.getElementById('no-results');
  const countEl  = document.getElementById('products-count');

  const list = state.filteredProducts;
  countEl.textContent = `Showing ${list.length} product${list.length !== 1 ? 's' : ''}`;

  if (list.length === 0) {
    grid.innerHTML = '';
    noResult.classList.remove('hidden');
    return;
  }

  noResult.classList.add('hidden');
  grid.innerHTML = list.map(p => createProductCardHTML(p)).join('');

  // Attach event listeners after render
  list.forEach(p => {
    // Name input change — saves on blur or Enter
    const nameInput = document.getElementById(`name-${p.id}`);
    if (nameInput) {
      const saveName = (e) => {
        const val = e.target.value.trim();
        if (val) {
          p.name = val;
          showToast(`✏️ Name set to "${val}"`);
        } else {
          p.name = '';
        }
      };
      nameInput.addEventListener('blur', saveName);
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.target.blur(); }
        if (e.key === 'Escape') { e.target.value = p.name; e.target.blur(); }
      });
    }

    // Category input
    const catInput = document.getElementById(`cat-${p.id}`);
    if (catInput) {
      catInput.addEventListener('blur', (e) => { p.category = e.target.value.trim(); });
      catInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.target.blur(); }
      });
    }

    // Price input change
    const priceInput = document.getElementById(`price-${p.id}`);
    if (priceInput) {
      priceInput.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0) {
          p.price = val;
          showToast(`Price updated to ${formatPrice(val)}`);
        }
      });
    }

    // Image upload on card
    const uploadInput = document.getElementById(`card-upload-${p.id}`);
    if (uploadInput) {
      uploadInput.addEventListener('change', (e) => handleCardImageUpload(e, p.id));
    }
  });
}

function createProductCardHTML(p) {
  const imgSrc   = getProductImage(p);
  const imgCount = p.images.length;
  const nameVal  = p.name || '';
  const catVal   = p.category || '';
  const priceVal = p.price > 0 ? p.price.toFixed(2) : '';

  return `
    <div class="product-card" data-id="${p.id}">
      <div class="card-img-wrap">
        <img
          src="${imgSrc}"
          alt="${nameVal || 'Product ' + p.id}"
          id="card-img-${p.id}"
          loading="lazy"
        />
        <div class="card-upload-overlay">
          <label class="card-upload-label">
            📁 Add Images
            <input
              type="file"
              id="card-upload-${p.id}"
              accept="image/*"
              multiple
            />
          </label>
        </div>
      </div>
      <div class="card-body">
        <input
          class="card-name-input"
          id="name-${p.id}"
          type="text"
          value="${nameVal}"
          maxlength="60"
          placeholder="Enter product name…"
        />
        <input
          class="card-category-input"
          id="cat-${p.id}"
          type="text"
          value="${catVal}"
          maxlength="40"
          placeholder="Category (optional)"
        />
        <div class="card-price-wrap">
          <span class="price-symbol">₹</span>
          <input
            class="card-price-input"
            type="number"
            id="price-${p.id}"
            value="${priceVal}"
            min="0"
            step="0.01"
            placeholder="0.00"
            title="Edit price"
          />
        </div>
        <span class="img-count-badge">
          🖼 ${imgCount} image${imgCount !== 1 ? 's' : ''}
        </span>
        <div class="card-actions">
          <button class="btn-view" onclick="openProduct(${p.id})">View Product</button>
          <button class="btn-add-cart" onclick="addToCart(${p.id})" title="Add to cart">🛒</button>
        </div>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════
   SEARCH & SORT
═══════════════════════════════════════════════════ */
function applyFilters() {
  let list = [...state.products];

  // Search filter
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  // Sort
  switch (state.sortMode) {
    case 'price-asc':  list.sort((a,b) => a.price - b.price); break;
    case 'price-desc': list.sort((a,b) => b.price - a.price); break;
    case 'name-asc':   list.sort((a,b) => a.name.localeCompare(b.name)); break;
    default: break; // keep original order
  }

  state.filteredProducts = list;
  renderGrid();
}

/* ═══════════════════════════════════════════════════
   IMAGE UPLOAD — CARD (HOME PAGE)
═══════════════════════════════════════════════════ */
function handleCardImageUpload(e, productId) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      product.images.push(ev.target.result);
      loaded++;
      if (loaded === files.length) {
        showToast(`✅ ${files.length} image(s) added to ${product.name}`);
        // Update the card image preview
        const cardImg = document.getElementById(`card-img-${productId}`);
        if (cardImg) cardImg.src = product.images[0];
        // Update count badge
        applyFilters(); // re-render to reflect new count
      }
    };
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════════════════
   IMAGE UPLOAD — DETAIL PAGE
═══════════════════════════════════════════════════ */
function handleDetailImageUpload(e) {
  const files   = Array.from(e.target.files);
  const product = state.currentProduct;
  if (!files.length || !product) return;

  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      product.images.push(ev.target.result);
      loaded++;
      if (loaded === files.length) {
        showToast(`✅ ${files.length} image(s) uploaded`);
        renderThumbnails();
        // Refresh main image to first new if only one existed
        setMainImage(product.images.length - loaded);
      }
    };
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════════════════
   PRODUCT DETAIL
═══════════════════════════════════════════════════ */
function openProduct(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.currentProduct = product;
  state.currentQty     = 1;
  state.currentThumb   = 0;

  // Populate fields
  const detailNameEl = document.getElementById('detail-name');
  detailNameEl.textContent = product.name || '';
  detailNameEl.setAttribute('contenteditable', 'true');
  detailNameEl.setAttribute('spellcheck', 'false');
  detailNameEl.setAttribute('data-placeholder', 'Enter product name…');
  detailNameEl.title = 'Click to edit product name';
  detailNameEl.oninput = () => {
    const val = detailNameEl.textContent.trim();
    product.name = val;
    document.getElementById('detail-breadcrumb-name').textContent = val || `Product #${product.id}`;
    // sync back to grid card input if visible
    const cardNameInput = document.getElementById(`name-${product.id}`);
    if (cardNameInput) cardNameInput.value = val;
  };
  detailNameEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); detailNameEl.blur(); } };
  document.getElementById('detail-breadcrumb-name').textContent = product.name || `Product #${product.id}`;
  document.getElementById('detail-price').textContent = product.price > 0 ? formatPrice(product.price) : '—';
  document.getElementById('detail-price-input').value = product.price > 0 ? product.price.toFixed(2) : '';
  document.getElementById('detail-sku').textContent   = `SKM-${String(product.id).padStart(4,'0')}`;
  document.getElementById('detail-qty').textContent   = state.currentQty;

  // Price input syncs
  const priceIn = document.getElementById('detail-price-input');
  priceIn.oninput = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      product.price = val;
      document.getElementById('detail-price').textContent = formatPrice(val);
    }
  };

  renderThumbnails();
  setMainImage(0);
  navigateTo('detail');
}

/** Render thumbnail sidebar */
function renderThumbnails() {
  const product   = state.currentProduct;
  const container = document.getElementById('detail-thumbs');
  const images    = product.images.length > 0
    ? product.images
    : [product.defaultImg];

  container.innerHTML = images.map((src, i) => `
    <div
      class="thumb-item ${i === state.currentThumb ? 'active' : ''}"
      onclick="setMainImage(${i})"
      title="View ${i === 0 ? 'Front' : i === 1 ? 'Back' : 'Side ' + i}"
    >
      <img src="${src}" alt="Thumbnail ${i + 1}" loading="lazy" />
    </div>
  `).join('');
}

/** Set the main large image and highlight active thumbnail */
function setMainImage(index) {
  const product = state.currentProduct;
  const images  = product.images.length > 0
    ? product.images
    : [product.defaultImg];

  if (index < 0 || index >= images.length) index = 0;
  state.currentThumb = index;

  const mainImg = document.getElementById('detail-main-img');
  mainImg.style.opacity = '0';
  mainImg.style.transform = 'scale(0.97)';
  setTimeout(() => {
    mainImg.src = images[index];
    mainImg.style.opacity = '1';
    mainImg.style.transform = 'scale(1)';
  }, 140);
  mainImg.style.transition = 'opacity 0.14s ease, transform 0.14s ease';

  // Update active thumbnail
  document.querySelectorAll('.thumb-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
}

/* ═══════════════════════════════════════════════════
   QUANTITY CONTROL
═══════════════════════════════════════════════════ */
function changeQty(delta) {
  state.currentQty = Math.max(1, state.currentQty + delta);
  document.getElementById('detail-qty').textContent = state.currentQty;
}

/* ═══════════════════════════════════════════════════
   ZOOM
═══════════════════════════════════════════════════ */
function openZoom() {
  const overlay = document.getElementById('zoom-overlay');
  const zoomImg = document.getElementById('zoom-img');
  const mainImg = document.getElementById('detail-main-img');
  zoomImg.src = mainImg.src;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeZoom() {
  document.getElementById('zoom-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ESC key closes zoom
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeZoom();
    closeSuccessModal();
  }
});

/* ═══════════════════════════════════════════════════
   CART
═══════════════════════════════════════════════════ */
function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  _pushToCart(product, 1);
  showToast(`🛒 ${product.name} added to cart`);
}

function addToCartFromDetail() {
  if (!state.currentProduct) return;
  _pushToCart(state.currentProduct, state.currentQty);
  showToast(`🛒 ${state.currentProduct.name} × ${state.currentQty} added to cart`);
}

function _pushToCart(product, qty) {
  const existing = state.cart.find(i => i.product.id === product.id);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({ product, qty });
  }
  updateCartDisplay();
  animateCartBadge();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.product.id !== productId);
  updateCartDisplay();
  renderCartPage();
  showToast('Item removed from cart');
}

function renderCartPage() {
  const container = document.getElementById('cart-items-container');
  const totalBar  = document.getElementById('cart-total-bar');
  const emptyMsg  = document.getElementById('cart-empty-msg');
  const countLbl  = document.getElementById('cart-item-count-label');

  if (state.cart.length === 0) {
    container.innerHTML  = '';
    totalBar.style.display  = 'none';
    emptyMsg.classList.remove('hidden');
    countLbl.textContent = '';
    return;
  }

  emptyMsg.classList.add('hidden');
  totalBar.style.display = 'flex';

  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  countLbl.textContent = `(${count} item${count !== 1 ? 's' : ''})`;

  container.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <img
        class="cart-item-img"
        src="${getProductImage(item.product)}"
        alt="${item.product.name}"
      />
      <div class="cart-item-info">
        <div class="cart-item-name">${item.product.name}</div>
        <div class="cart-item-price">${formatPrice(item.product.price * item.qty)}</div>
        <div class="cart-item-qty">Qty: ${item.qty} × ${formatPrice(item.product.price)}</div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.product.id})" title="Remove">✕</button>
    </div>
  `).join('');

  const grand = state.cart.reduce((s, i) => s + i.product.price * i.qty, 0);
  document.getElementById('cart-grand-total').textContent = formatPrice(grand);
}

function cartCheckout() {
  if (!state.cart.length) return;
  // Use first cart item as the "purchase" product for payment page
  const firstItem = state.cart[0];
  state.currentProduct = firstItem.product;
  state.currentQty     = firstItem.qty;
  goToPayment();
}

/* ═══════════════════════════════════════════════════
   PAYMENT
═══════════════════════════════════════════════════ */
function goToPayment() {
  const p = state.currentProduct;
  if (!p) return;

  const qty   = state.currentQty;
  const total = p.price * qty;

  document.getElementById('payment-product-name').textContent  = `${p.name} × ${qty}`;
  document.getElementById('payment-product-price').textContent = formatPrice(total);
  document.getElementById('pay-price').textContent             = formatPrice(p.price);
  document.getElementById('pay-total').textContent             = formatPrice(total);

  // Payment image
  const payImg = document.getElementById('payment-img');
  payImg.src   = getProductImage(p);

  // Restore QR if already uploaded
  refreshQRDisplay();

  navigateTo('payment');
}

function handleQRUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.qrCodeDataUrl = ev.target.result;
    refreshQRDisplay();
    showToast('✅ QR code uploaded');
  };
  reader.readAsDataURL(file);
}

function refreshQRDisplay() {
  const qrImg         = document.getElementById('qr-img');
  const qrPlaceholder = document.getElementById('qr-placeholder');

  if (state.qrCodeDataUrl) {
    qrImg.src           = state.qrCodeDataUrl;
    qrImg.style.display = 'block';
    qrPlaceholder.style.display = 'none';
  } else {
    qrImg.style.display = 'none';
    qrPlaceholder.style.display = 'block';
  }
}

function confirmPayment() {
  // Simple validation
  const method = document.querySelector('input[name="pay-method"]:checked')?.value;
  if (method === 'upi') {
    const upiVal = document.getElementById('upi-input').value.trim();
    if (!upiVal) {
      showToast('⚠️ Please enter your UPI ID');
      return;
    }
  }

  // Clear cart after purchase
  state.cart = [];
  updateCartDisplay();

  // Show success modal
  document.getElementById('success-modal').classList.add('open');
}

function closeSuccessModal() {
  document.getElementById('success-modal').classList.remove('open');
}

/* ═══════════════════════════════════════════════════
   INIT — WIRE UP EVENT LISTENERS
═══════════════════════════════════════════════════ */
function init() {
  // Search input — live filter
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    applyFilters();
  });

  // Sort select
  const sortSelect = document.getElementById('sort-select');
  sortSelect.addEventListener('change', (e) => {
    state.sortMode = e.target.value;
    applyFilters();
  });

  // Initial render
  renderGrid();
  navigateTo('home');

  // Cart view hook — render on navigate
  document.getElementById('cart-count').addEventListener('click', () => {
    renderCartPage();
    navigateTo('cart');
  });

  // Cart button in header
  document.querySelector('.cart-btn').addEventListener('click', () => {
    renderCartPage();
    navigateTo('cart');
  });
}

// Kick everything off once DOM is ready
document.addEventListener('DOMContentLoaded', init);

