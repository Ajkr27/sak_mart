/**
 * SAK MART — script.js
 * Pure vanilla JS SPA — no frameworks, no Firebase, no ES modules
 * All functions are global so inline onclick="..." handlers work.
 */

'use strict';

/* ═══════════════════════════════════════
   GENERATE 100 BLANK PRODUCTS
═══════════════════════════════════════ */
function generateProducts() {
  var products = [];
  for (var i = 1; i <= 100; i++) {
    products.push({ id: i, name: '', price: 0, category: '', images: [], defaultImg: null });
  }
  return products;
}

var state = {
  products:        generateProducts(),
  filteredProducts:[],
  currentView:     'home',
  currentProduct:  null,
  currentQty:      1,
  cart:            [],
  qrCodeDataUrl:   null,
  currentThumb:    0,
  searchQuery:     '',
  sortMode:        'default',
};
state.filteredProducts = state.products.slice();

/* ═══════════════════════════════════════
   PLACEHOLDER GENERATOR
═══════════════════════════════════════ */
function generatePlaceholder(id) {
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = 400;
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#18181f';
  ctx.fillRect(0, 0, 400, 400);

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (var x = 20; x < 400; x += 30) {
    for (var y = 20; y < 400; y += 30) {
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(60, 60, 280, 280);
  ctx.setLineDash([]);

  ctx.font = '48px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillText('\uD83D\uDCF7', 200, 185);

  ctx.font = '14px sans-serif';
  ctx.fillText('Upload image', 200, 248);

  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.textAlign = 'right';
  ctx.fillText('#' + String(id).padStart(3,'0'), 375, 375);

  return canvas.toDataURL('image/png');
}

function initPlaceholders() {
  state.products.forEach(function(p) { p.defaultImg = generatePlaceholder(p.id); });
}

/* ═══════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════ */
function navigateTo(view) {
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  var el = document.getElementById('view-' + view);
  if (el) el.classList.add('active');
  state.currentView = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  var sw = document.querySelector('.header-search');
  if (sw) sw.style.visibility = view === 'home' ? 'visible' : 'hidden';
  if (view === 'cart') renderCartPage();
}

/* ═══════════════════════════════════════
   HELPERS
═══════════════════════════════════════ */
function getProductImage(product, index) {
  index = index || 0;
  if (product.images && product.images.length > index) return product.images[index];
  return product.defaultImg;
}

function formatPrice(price) {
  return '\u20B9' + parseFloat(price).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

var toastTimer = null;
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('show'); }, 2800);
}

function animateCartBadge() {
  var b = document.getElementById('cart-count');
  b.classList.remove('bump');
  void b.offsetWidth;
  b.classList.add('bump');
}

function updateCartDisplay() {
  var total = state.cart.reduce(function(s, i) { return s + i.qty; }, 0);
  document.getElementById('cart-count').textContent = total;
}

/* ═══════════════════════════════════════
   PRODUCT GRID
═══════════════════════════════════════ */
function renderGrid() {
  var grid     = document.getElementById('product-grid');
  var noResult = document.getElementById('no-results');
  var countEl  = document.getElementById('products-count');
  var list     = state.filteredProducts;

  countEl.textContent = 'Showing ' + list.length + ' product' + (list.length !== 1 ? 's' : '');

  if (!list.length) {
    grid.innerHTML = '';
    noResult.classList.remove('hidden');
    return;
  }
  noResult.classList.add('hidden');
  grid.innerHTML = list.map(createProductCardHTML).join('');

  list.forEach(function(p) {
    var nameEl = document.getElementById('name-' + p.id);
    if (nameEl) {
      nameEl.addEventListener('blur', function(e) {
        p.name = e.target.value.trim();
        if (p.name) showToast('\u270F\uFE0F Name: "' + p.name + '"');
      });
      nameEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  e.target.blur();
        if (e.key === 'Escape') { e.target.value = p.name; e.target.blur(); }
      });
    }

    var catEl = document.getElementById('cat-' + p.id);
    if (catEl) {
      catEl.addEventListener('blur', function(e) { p.category = e.target.value.trim(); });
      catEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') e.target.blur(); });
    }

    var priceEl = document.getElementById('price-' + p.id);
    if (priceEl) {
      priceEl.addEventListener('change', function(e) {
        var v = parseFloat(e.target.value);
        if (!isNaN(v) && v >= 0) { p.price = v; showToast('Price: ' + formatPrice(v)); }
      });
    }

    var uploadEl = document.getElementById('card-upload-' + p.id);
    if (uploadEl) {
      uploadEl.addEventListener('change', function(e) { handleCardImageUpload(e, p.id); });
    }
  });
}

function createProductCardHTML(p) {
  var img   = getProductImage(p);
  var cnt   = p.images.length;
  var name  = p.name || '';
  var cat   = p.category || '';
  var price = p.price > 0 ? p.price.toFixed(2) : '';

  return '<div class="product-card" data-id="' + p.id + '">' +
    '<div class="card-img-wrap">' +
      '<img src="' + img + '" alt="' + (name || 'Slot ' + p.id) + '" id="card-img-' + p.id + '" loading="lazy"/>' +
      '<div class="card-upload-overlay">' +
        '<label class="card-upload-label">' +
          '\uD83D\uDCC1 Add Images' +
          '<input type="file" id="card-upload-' + p.id + '" accept="image/*" multiple/>' +
        '</label>' +
      '</div>' +
    '</div>' +
    '<div class="card-body">' +
      '<input class="card-name-input" id="name-' + p.id + '" type="text" value="' + name + '" maxlength="60" placeholder="Enter product name\u2026"/>' +
      '<input class="card-category-input" id="cat-' + p.id + '" type="text" value="' + cat + '" maxlength="40" placeholder="Category (optional)"/>' +
      '<div class="card-price-wrap">' +
        '<span class="price-symbol">\u20B9</span>' +
        '<input class="card-price-input" type="number" id="price-' + p.id + '" value="' + price + '" min="0" step="0.01" placeholder="0.00"/>' +
      '</div>' +
      '<span class="img-count-badge">\uD83D\uDDBC ' + cnt + ' image' + (cnt !== 1 ? 's' : '') + '</span>' +
      '<div class="card-actions">' +
        '<button class="btn-view" onclick="openProduct(' + p.id + ')">View Product</button>' +
        '<button class="btn-add-cart" onclick="addToCart(' + p.id + ')" title="Add to cart">\uD83D\uDED2</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ═══════════════════════════════════════
   SEARCH & SORT
═══════════════════════════════════════ */
function applyFilters() {
  var list = state.products.slice();
  if (state.searchQuery) {
    var q = state.searchQuery.toLowerCase();
    list = list.filter(function(p) {
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    });
  }
  if (state.sortMode === 'price-asc')  list.sort(function(a,b){ return a.price - b.price; });
  if (state.sortMode === 'price-desc') list.sort(function(a,b){ return b.price - a.price; });
  if (state.sortMode === 'name-asc')   list.sort(function(a,b){ return a.name.localeCompare(b.name); });
  state.filteredProducts = list;
  renderGrid();
}

/* ═══════════════════════════════════════
   IMAGE UPLOADS
═══════════════════════════════════════ */
function handleCardImageUpload(e, productId) {
  var files = Array.from(e.target.files);
  if (!files.length) return;
  var product = state.products.find(function(p){ return p.id === productId; });
  if (!product) return;
  var loaded = 0;
  files.forEach(function(file) {
    var r = new FileReader();
    r.onload = function(ev) {
      product.images.push(ev.target.result);
      if (++loaded === files.length) {
        showToast('\u2705 ' + files.length + ' image(s) added');
        var ci = document.getElementById('card-img-' + productId);
        if (ci) ci.src = product.images[0];
        applyFilters();
      }
    };
    r.readAsDataURL(file);
  });
}

function handleDetailImageUpload(e) {
  var files = Array.from(e.target.files);
  var product = state.currentProduct;
  if (!files.length || !product) return;
  var loaded = 0;
  files.forEach(function(file) {
    var r = new FileReader();
    r.onload = function(ev) {
      product.images.push(ev.target.result);
      if (++loaded === files.length) {
        showToast('\u2705 ' + files.length + ' image(s) uploaded');
        renderThumbnails();
        setMainImage(product.images.length - loaded);
      }
    };
    r.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════
   PRODUCT DETAIL
═══════════════════════════════════════ */
function openProduct(productId) {
  var product = state.products.find(function(p){ return p.id === productId; });
  if (!product) return;

  state.currentProduct = product;
  state.currentQty     = 1;
  state.currentThumb   = 0;

  var nameEl = document.getElementById('detail-name');
  nameEl.textContent = product.name || '';
  nameEl.setAttribute('contenteditable', 'true');
  nameEl.setAttribute('spellcheck', 'false');
  nameEl.setAttribute('data-placeholder', 'Enter product name\u2026');
  nameEl.title = 'Click to edit name';
  nameEl.oninput = function() {
    var v = nameEl.textContent.trim();
    product.name = v;
    document.getElementById('detail-breadcrumb-name').textContent = v || ('Product #' + product.id);
    var ci = document.getElementById('name-' + product.id);
    if (ci) ci.value = v;
  };
  nameEl.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } };

  document.getElementById('detail-breadcrumb-name').textContent = product.name || ('Product #' + product.id);
  document.getElementById('detail-price').textContent = product.price > 0 ? formatPrice(product.price) : '\u2014';
  document.getElementById('detail-price-input').value = product.price > 0 ? product.price.toFixed(2) : '';
  document.getElementById('detail-sku').textContent   = 'SKM-' + String(product.id).padStart(4, '0');
  document.getElementById('detail-qty').textContent   = state.currentQty;

  var priceIn = document.getElementById('detail-price-input');
  priceIn.oninput = function(e) {
    var v = parseFloat(e.target.value);
    if (!isNaN(v) && v >= 0) {
      product.price = v;
      document.getElementById('detail-price').textContent = formatPrice(v);
    }
  };

  renderThumbnails();
  setMainImage(0);
  navigateTo('detail');
}

function renderThumbnails() {
  var product = state.currentProduct;
  var images  = product.images.length > 0 ? product.images : [product.defaultImg];
  document.getElementById('detail-thumbs').innerHTML = images.map(function(src, i) {
    var label = i === 0 ? 'Front' : i === 1 ? 'Back' : 'Side ' + i;
    return '<div class="thumb-item ' + (i === state.currentThumb ? 'active' : '') + '" onclick="setMainImage(' + i + ')" title="' + label + '">' +
      '<img src="' + src + '" alt="Thumb ' + (i+1) + '" loading="lazy"/>' +
    '</div>';
  }).join('');
}

function setMainImage(index) {
  var product = state.currentProduct;
  var images  = product.images.length > 0 ? product.images : [product.defaultImg];
  if (index < 0 || index >= images.length) index = 0;
  state.currentThumb = index;

  var mainImg = document.getElementById('detail-main-img');
  mainImg.style.transition = 'opacity 0.14s ease, transform 0.14s ease';
  mainImg.style.opacity = '0';
  mainImg.style.transform = 'scale(0.97)';
  setTimeout(function() {
    mainImg.src = images[index];
    mainImg.style.opacity = '1';
    mainImg.style.transform = 'scale(1)';
  }, 140);

  document.querySelectorAll('.thumb-item').forEach(function(el, i) {
    el.classList.toggle('active', i === index);
  });
}

/* ═══════════════════════════════════════
   QUANTITY
═══════════════════════════════════════ */
function changeQty(delta) {
  state.currentQty = Math.max(1, state.currentQty + delta);
  document.getElementById('detail-qty').textContent = state.currentQty;
}

/* ═══════════════════════════════════════
   ZOOM
═══════════════════════════════════════ */
function openZoom() {
  var mainImg = document.getElementById('detail-main-img');
  document.getElementById('zoom-img').src = mainImg.src;
  document.getElementById('zoom-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeZoom() {
  document.getElementById('zoom-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════
   CART
═══════════════════════════════════════ */
function addToCart(productId) {
  var product = state.products.find(function(p){ return p.id === productId; });
  if (!product) return;
  _pushToCart(product, 1);
  showToast('\uD83D\uDED2 ' + (product.name || 'Product #' + productId) + ' added to cart');
}

function addToCartFromDetail() {
  if (!state.currentProduct) return;
  _pushToCart(state.currentProduct, state.currentQty);
  showToast('\uD83D\uDED2 Added \xD7' + state.currentQty + ' to cart');
}

function _pushToCart(product, qty) {
  var ex = state.cart.find(function(i){ return i.product.id === product.id; });
  if (ex) { ex.qty += qty; } else { state.cart.push({ product: product, qty: qty }); }
  updateCartDisplay();
  animateCartBadge();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(function(i){ return i.product.id !== productId; });
  updateCartDisplay();
  renderCartPage();
  showToast('Item removed');
}

function renderCartPage() {
  var container = document.getElementById('cart-items-container');
  var totalBar  = document.getElementById('cart-total-bar');
  var emptyMsg  = document.getElementById('cart-empty-msg');
  var countLbl  = document.getElementById('cart-item-count-label');

  if (!state.cart.length) {
    container.innerHTML    = '';
    totalBar.style.display = 'none';
    emptyMsg.classList.remove('hidden');
    countLbl.textContent   = '';
    return;
  }

  emptyMsg.classList.add('hidden');
  totalBar.style.display = 'flex';
  var count = state.cart.reduce(function(s,i){ return s + i.qty; }, 0);
  countLbl.textContent = '(' + count + ' item' + (count !== 1 ? 's' : '') + ')';

  container.innerHTML = state.cart.map(function(item) {
    return '<div class="cart-item">' +
      '<img class="cart-item-img" src="' + getProductImage(item.product) + '" alt=""/>' +
      '<div class="cart-item-info">' +
        '<div class="cart-item-name">' + (item.product.name || 'Unnamed Product') + '</div>' +
        '<div class="cart-item-price">' + formatPrice(item.product.price * item.qty) + '</div>' +
        '<div class="cart-item-qty">Qty: ' + item.qty + ' \xD7 ' + formatPrice(item.product.price) + '</div>' +
      '</div>' +
      '<button class="cart-item-remove" onclick="removeFromCart(' + item.product.id + ')" title="Remove">\u2715</button>' +
    '</div>';
  }).join('');

  var grand = state.cart.reduce(function(s,i){ return s + i.product.price * i.qty; }, 0);
  document.getElementById('cart-grand-total').textContent = formatPrice(grand);
}

function cartCheckout() {
  if (!state.cart.length) return;
  state.currentProduct = state.cart[0].product;
  state.currentQty     = state.cart[0].qty;
  goToPayment();
}

/* ═══════════════════════════════════════
   PAYMENT
═══════════════════════════════════════ */
function goToPayment() {
  var p = state.currentProduct;
  if (!p) return;
  var total = p.price * state.currentQty;
  document.getElementById('payment-product-name').textContent  = (p.name || 'Product') + ' \xD7 ' + state.currentQty;
  document.getElementById('payment-product-price').textContent = formatPrice(total);
  document.getElementById('pay-price').textContent             = formatPrice(p.price);
  document.getElementById('pay-total').textContent             = formatPrice(total);
  document.getElementById('payment-img').src                   = getProductImage(p);
  refreshQRDisplay();
  navigateTo('payment');
}

function handleQRUpload(e) {
  var file = e.target.files[0];
  if (!file) return;
  var r = new FileReader();
  r.onload = function(ev) { state.qrCodeDataUrl = ev.target.result; refreshQRDisplay(); showToast('\u2705 QR uploaded'); };
  r.readAsDataURL(file);
}

function refreshQRDisplay() {
  var img = document.getElementById('qr-img');
  var ph  = document.getElementById('qr-placeholder');
  if (state.qrCodeDataUrl) {
    img.src = state.qrCodeDataUrl; img.style.display = 'block'; ph.style.display = 'none';
  } else {
    img.style.display = 'none'; ph.style.display = 'block';
  }
}

function confirmPayment() {
  var method = document.querySelector('input[name="pay-method"]:checked');
  if (method && method.value === 'upi') {
    if (!document.getElementById('upi-input').value.trim()) {
      showToast('\u26A0\uFE0F Please enter your UPI ID'); return;
    }
  }
  state.cart = [];
  updateCartDisplay();
  document.getElementById('success-modal').classList.add('open');
}

function closeSuccessModal() {
  document.getElementById('success-modal').classList.remove('open');
}

/* ═══════════════════════════════════════
   KEYBOARD
═══════════════════════════════════════ */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeZoom(); closeSuccessModal(); }
});

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
function init() {
  initPlaceholders();

  document.getElementById('search-input').addEventListener('input', function(e) {
    state.searchQuery = e.target.value.trim();
    applyFilters();
  });

  document.getElementById('sort-select').addEventListener('change', function(e) {
    state.sortMode = e.target.value;
    applyFilters();
  });

  document.querySelector('.cart-btn').addEventListener('click', function() {
    renderCartPage();
    navigateTo('cart');
  });

  renderGrid();
  navigateTo('home');
}

document.addEventListener('DOMContentLoaded', init);

