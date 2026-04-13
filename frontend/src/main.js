const env = import.meta.env ?? {};
const baseUrl = env.BASE_URL || '/';
const DIRECTUS_URL = (
  env.VITE_DIRECTUS_URL ||
  document.querySelector('meta[name="directus-url"]')?.content ||
  'https://cms.ohwatcha.evolinq.link'
).replace(/\/$/, '');
const API_BASE = (
  env.VITE_API_BASE ||
  document.querySelector('meta[name="api-base"]')?.content ||
  '/api'
).replace(/\/$/, '');
const UPDATE_INTERVAL = 60000;
// Maximum age (hours) for showing recent locations; configurable via Vite env:
// - VITE_SHISHI_MAX_AGE_HOURS (preferred)
// - VITE_MAX_AGE_HOURS (fallback)
// Set to 0 to disable filtering (show all locations)
const MAX_AGE_HOURS = (() => {
  const raw = env.VITE_SHISHI_MAX_AGE_HOURS ?? env.VITE_MAX_AGE_HOURS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 2;
})();

import { createSampleIcon } from './components/SampleIcon.js';

import shishiIconUrl from '../assets/icons/shishi.png';
let shopIconUrl;
// resolve optional shop.png without causing build-time unresolved import
{
  const icons = import.meta.glob('../assets/icons/*.png', { eager: true });
  const key = '../assets/icons/shop.png';
  const mod = icons[key];
  shopIconUrl = mod ? (mod.default || mod) : shishiIconUrl;
}

let homeIconUrl = null;
{
  const iconsPng = import.meta.glob('../assets/icons/*.png', { eager: true });
  const keyHome = '../assets/icons/home.png';
  const modHome = iconsPng[keyHome];
  homeIconUrl = modHome ? (modHome.default || modHome) : null;
}

// build icon filename -> url map from assets/icons
const iconFiles = import.meta.glob('../assets/icons/*.{png,webp}', { eager: true });
const iconUrlMap = {};
for (const p in iconFiles) {
  const fn = p.split('/').pop();
  iconUrlMap[fn] = (iconFiles[p] && (iconFiles[p].default || iconFiles[p]));
}

// shop icon cache by url
const shopIconCache = new Map();
function getLeafletIconForUrl(url, { iconSize = [32, 32] } = {}) {
  if (!url) return null;
  if (shopIconCache.has(url)) return shopIconCache.get(url);
  try {
    const ic = L.icon({ iconUrl: url, iconSize, iconAnchor: [Math.round(iconSize[0] / 2), iconSize[1]], popupAnchor: [0, -iconSize[1]] });
    shopIconCache.set(url, ic);
    return ic;
  } catch (e) {
    console.warn('create icon failed', e);
    return null;
  }
}

function getShopIconByType(type) {
  if (!type) return getLeafletIconForUrl(shopIconUrl) || shopIcon;
  // normalize type: trim, lowercase, NFKC
  const normType = String(type).trim().toLowerCase().normalize('NFKC');
  const candidates = [
    `shop-${normType}.png`,
    `shop_${normType}.png`,
    `${normType}.png`,
    `shop-${normType}.webp`,
    `shop_${normType}.webp`,
    `${normType}.webp`
  ];

  // exact filename match first
  for (const c of candidates) {
    if (iconUrlMap[c]) {
      const ic = getLeafletIconForUrl(iconUrlMap[c]);
      try { ic.__source = c; } catch (e) {}
      return ic;
    }
  }

  // loose match: search icon filenames for ones that include the normalized type
  for (const fn in iconUrlMap) {
    const nameOnly = fn.replace(/\.[^.]+$/, '').toLowerCase().normalize('NFKC');
    if (nameOnly === normType || nameOnly.includes(normType) || normType.includes(nameOnly)) {
      const ic = getLeafletIconForUrl(iconUrlMap[fn]);
      try { ic.__source = fn + ' (loose)'; } catch (e) {}
      return ic;
    }
  }

  // final fallback
  const fallback = getLeafletIconForUrl(shopIconUrl) || shopIcon;
  try { fallback.__source = 'shop.png (fallback)'; } catch (e) {}
  return fallback;
}

const map = L.map('map').setView([36.78058, 137.09447], 15);
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
});
const gsiStd = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
  attribution: '&copy; Geospatial Information Authority of Japan'
});
const gsiPale = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
  attribution: '&copy; Geospatial Information Authority of Japan (淡色地図)'
});
const gsiAerial = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg', {
  attribution: '&copy; Geospatial Information Authority of Japan (航空写真)'
});

gsiAerial.addTo(map);
L.control.layers({
  OpenStreetMap: osmLayer,
  '地理院地図（標準）': gsiStd,
  '地理院地図（淡色）': gsiPale,
  '地理院地図（空中写真）': gsiAerial
}).addTo(map);

const shishiIcon = L.icon({
  iconUrl: shishiIconUrl,
  iconSize: [48, 48],
  iconAnchor: [24, 48],
  popupAnchor: [0, -48]
});

const shopIcon = L.icon({
  iconUrl: shopIconUrl,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// create homeIcon while preserving aspect ratio (fit within max size)
let homeIcon = null;
if (homeIconUrl) {
  (function loadHomeIcon() {
    const img = new Image();
    img.src = homeIconUrl;
    img.onload = () => {
      const maxSize = 32; // max width/height to fit into
      const scale = maxSize / Math.max(img.width || maxSize, img.height || maxSize);
      const w = Math.max(8, Math.round((img.width || maxSize) * scale));
      const h = Math.max(8, Math.round((img.height || maxSize) * scale));
      homeIcon = L.icon({
        iconUrl: homeIconUrl,
        iconSize: [w, h],
        iconAnchor: [Math.round(w / 2), h],
        popupAnchor: [0, -h]
      });
      // apply to existing current location marker if present
      try {
        if (currentLocationMarker) currentLocationMarker.setIcon(homeIcon);
      } catch (e) {
        console.warn('apply homeIcon failed', e);
      }
    };
    img.onerror = (e) => {
      console.warn('failed to load home icon', e);
    };
  })();
}

const shishiMarkers = {};
// shop markers and data
const shopMarkers = {};
let shopsData = [];
const SHOP_TYPE_MAP = {
  '1': 'カフェ',
  '2': '食事',
  '3': '史跡',
  '4': '公共施設'
};
const selectedShopTypes = new Set(Object.keys(SHOP_TYPE_MAP));
let shopFilterRendered = false;

// --- Sidebar menu for current shishi list ---
const menuHtml = `
  <aside id="shishi-menu" style="position:absolute;left:72px;top:8px;z-index:1000;
    background:white;padding:8px;border-radius:6px;max-height:70vh;overflow:auto;width:240px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">
    <h4 style="margin:0 0 8px 0"><span class="shishi-menu-title">獅子舞リスト</span></h4>
    <ul id="shishi-list" style="list-style:none;padding:0;margin:0;"></ul>
  </aside>
`;
document.body.insertAdjacentHTML('afterbegin', menuHtml);

// prepend sample icon to the menu header (demonstrates importing SVG as URL)
try {
  const aside = document.getElementById('shishi-menu');
  if (aside) {
    const h4 = aside.querySelector('h4');
    if (h4) h4.prepend(createSampleIcon());
  }
} catch (e) {
  console.warn('insert icon failed', e);
}

// reduce font size for shishi list title and items
try {
  const style = document.createElement('style');
  style.textContent = `
    #shishi-menu .shishi-menu-title { font-size: 0.85rem; }
    #shishi-menu #shishi-list { font-size: 0.85rem; }
    #shishi-menu #shishi-list li { font-size: 0.85rem; }
  `;
  document.head.appendChild(style);
} catch (e) {
  console.warn('apply shishi font-size failed', e);
}

// make the current-location list collapsible
try {
  const aside = document.getElementById('shishi-menu');
  if (aside) {
    const header = aside.querySelector('h4');
    const list = aside.querySelector('#shishi-list');
    if (header && list) {
      // style header for flexible layout
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';

      const toggle = document.createElement('button');
      toggle.id = 'shishi-menu-toggle';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.title = '折りたたむ／開く';
      toggle.textContent = '▾';
      Object.assign(toggle.style, {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        lineHeight: '1'
      });

      header.appendChild(toggle);

      let collapsed = false;
      const applyState = () => {
        if (collapsed) {
          // keep the header visible but hide the list; reduce width
          aside.style.width = '140px';
          list.style.display = 'none';
          toggle.textContent = '▸';
          toggle.setAttribute('aria-expanded', 'false');
        } else {
          aside.style.width = '240px';
          list.style.display = '';
          toggle.textContent = '▾';
          toggle.setAttribute('aria-expanded', 'true');
        }
      };

      toggle.addEventListener('click', () => {
        collapsed = !collapsed;
        applyState();
      });

      // initial state (expanded)
      applyState();
    }
  }
} catch (e) {
  console.warn('collapsible menu setup failed', e);
}

// --- Current location button and handler ---
let currentLocationMarker = null;

const locateBtn = document.createElement('button');
locateBtn.id = 'btn-current-location';
locateBtn.textContent = '現在地';
Object.assign(locateBtn.style, {
  position: 'fixed',
  right: '16px',
  bottom: '16px',
  zIndex: 1000,
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.08)',
  padding: '8px 10px',
  borderRadius: '6px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
  cursor: 'pointer'
});
locateBtn.title = '現在地を取得して地図の中心に移動';

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('このブラウザでは位置情報が利用できません');
    return;
  }

  locateBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const coords = [lat, lon];

      if (currentLocationMarker) {
        currentLocationMarker.setLatLng(coords);
        if (homeIcon) currentLocationMarker.setIcon(homeIcon);
      } else {
        const opts = homeIcon ? { icon: homeIcon } : {};
        currentLocationMarker = L.marker(coords, opts).addTo(map);
        currentLocationMarker.bindPopup('現在地').openPopup();
      }

      map.setView(coords, Math.max(map.getZoom(), 17), { animate: true });
      locateBtn.disabled = false;
    },
    (err) => {
      console.warn('geolocation error', err);
      alert('現在地を取得できませんでした: ' + (err.message || err.code));
      locateBtn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
});

document.body.appendChild(locateBtn);

// --- Sponsor banner (rotate images in frontend/assets/banner every 15s) ---
{
  const imgs = import.meta.glob('../assets/banner/*.{png,jpg,jpeg,svg,gif,webp}', { eager: true });
  const urls = Object.values(imgs).map(m => (m && (m.default || m)) ).filter(Boolean);
  if (urls.length > 0) {
    // create container
    const bannerWrap = document.createElement('div');
    bannerWrap.id = 'sponsor-banner-wrap';
    Object.assign(bannerWrap.style, {
      position: 'fixed',
      left: '0',
      right: '0',
      bottom: '0',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '6px',
      background: 'rgba(255,255,255,0.95)',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
      zIndex: 999,
      pointerEvents: 'auto'
    });

    const img = document.createElement('img');
    img.id = 'sponsor-banner';
    img.src = urls[0];
    Object.assign(img.style, {
      maxHeight: '40px',
      maxWidth: '90%',
      objectFit: 'contain',
      cursor: 'pointer'
    });

    bannerWrap.appendChild(img);
    document.body.appendChild(bannerWrap);

    // move locateBtn up to avoid overlap (adjusted for smaller banner)
    try { locateBtn.style.bottom = '56px'; } catch (e) {}

    let idx = 0;
    const rotate = () => {
      idx = (idx + 1) % urls.length;
      img.src = urls[idx];
    };
    const timer = setInterval(rotate, 15000);

    // pause rotation on hover
    img.addEventListener('mouseenter', () => clearInterval(timer));
    img.addEventListener('mouseleave', () => setInterval(rotate, 15000));
  }
}

// startNavigation: obtain current position and open Google Maps directions
window.startNavigation = function startNavigation(destLat, destLon) {
  if (!navigator.geolocation) {
    alert('このブラウザでは位置情報が利用できません');
    return;
  }

  const openMaps = (originLat, originLon) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${destLat},${destLon}&travelmode=walking`;
    window.open(url, '_blank', 'noopener');
  };

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      openMaps(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      console.warn('geolocation error for navigation', err);
      // fallback: open with destination only
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLon}&travelmode=walking`;
      window.open(url, '_blank', 'noopener');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

function renderShishiList(items) {
  const list = document.getElementById('shishi-list');
  if (!list) return;
  list.innerHTML = '';
  items.forEach((shishi) => {
    const coords = extractCoordinates(shishi);
    if (!coords) return;
    const id = String(shishi.id ?? shishi.name ?? `${coords[0]}:${coords[1]}`);
    const li = document.createElement('li');
    li.style.padding = '6px 4px';
    li.style.borderBottom = '1px solid #eee';
    const name = escapeHtml(shishi.name || '名称未設定');
    li.innerHTML = `<button data-id="${id}" style="all:unset;cursor:pointer;display:block;width:100%;text-align:left;padding:6px 0">
                      ${name}
                    </button>`;
    li.querySelector('button').addEventListener('click', () => {
      const marker = shishiMarkers[id];
      if (marker) {
        const latlng = marker.getLatLng();
        map.setView(latlng, Math.max(map.getZoom(), 17), { animate: true });
        marker.openPopup();
      } else {
        map.setView(coords, 17, { animate: true });
      }
    });
    list.appendChild(li);
  });
}

function renderShopFilterUI() {
  if (shopFilterRendered) return;
  shopFilterRendered = true;
  const html = `
    <aside id="shop-menu" style="position:absolute;left:340px;top:8px;z-index:1000;background:white;padding:8px;border-radius:6px;max-height:70vh;overflow:auto;width:200px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">
      <h4 style="margin:0 0 8px 0"><span class="shop-menu-title">施設情報</span></h4>
      <form id="shop-type-form" style="margin:0;padding:0;">
      </form>
    </aside>
  `;
  document.body.insertAdjacentHTML('afterbegin', html);

  const aside = document.getElementById('shop-menu');
  const header = aside.querySelector('h4');
  const form = document.getElementById('shop-type-form');

  // style header for flexible layout and add toggle (default collapsed)
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';

  const toggle = document.createElement('button');
  toggle.id = 'shop-menu-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.title = '折りたたむ／開く';
  toggle.textContent = '▸';
  Object.assign(toggle.style, {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: '1'
  });

  header.appendChild(toggle);

  // build checkboxes
  Object.entries(SHOP_TYPE_MAP).forEach(([k, v]) => {
    const id = `shop-type-${k}`;
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '6px';
    wrapper.innerHTML = `<label style="cursor:pointer"><input type="checkbox" id="${id}" data-val="${k}" checked> ${escapeHtml(v)}</label>`;
    form.appendChild(wrapper);
    const cb = wrapper.querySelector('input');
    cb.addEventListener('change', () => {
      if (cb.checked) selectedShopTypes.add(k); else selectedShopTypes.delete(k);
      renderShops();
    });
  });

  // collapsible behavior
  let collapsed = true; // default collapsed
  const applyState = () => {
    if (collapsed) {
      aside.style.width = '140px';
      form.style.display = 'none';
      toggle.textContent = '▸';
      toggle.setAttribute('aria-expanded', 'false');
    } else {
      aside.style.width = '200px';
      form.style.display = '';
      toggle.textContent = '▾';
      toggle.setAttribute('aria-expanded', 'true');
    }
  };

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    applyState();
  });

  applyState();
}

function renderShops() {
  // remove existing markers
  Object.keys(shopMarkers).forEach((id) => {
    try { map.removeLayer(shopMarkers[id]); } catch (e) {}
    delete shopMarkers[id];
  });

  if (!Array.isArray(shopsData) || shopsData.length === 0) return;

  shopsData.forEach((shop) => {
    const coords = extractCoordinates(shop);
    if (!coords) return;
    const id = String(shop.id ?? shop.name ?? `${coords[0]}:${coords[1]}`);
    const type = shop.type || shop.category || shop.shop_type || null;
    const typeVal = String(type ?? '');
    if (!selectedShopTypes.has(typeVal)) return; // filtered out

    const iconForShop = getShopIconByType(String(type || '').toLowerCase());
    const marker = L.marker(coords, { icon: iconForShop || shopIcon }).addTo(map);
    marker.bindPopup(buildShopPopupContent(shop), {
      maxWidth: 300,
      className: 'shop-popup-container'
    });
    shopMarkers[id] = marker;
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatText(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

function sanitizeExternalUrl(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, DIRECTUS_URL);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch (error) {
    console.warn('invalid external url', value, error);
  }

  return null;
}

function extractFileId(fileField) {
  if (!fileField) {
    return null;
  }

  if (typeof fileField === 'string' || typeof fileField === 'number') {
    return fileField;
  }

  if (Array.isArray(fileField) && fileField.length > 0) {
    return extractFileId(fileField[0]);
  }

  if (typeof fileField === 'object') {
    return fileField.id || fileField.filename_disk || extractFileId(fileField.data);
  }

  return null;
}

function buildImageUrl(imageId) {
  if (!imageId) {
    return null;
  }

  return `${DIRECTUS_URL}/assets/${encodeURIComponent(String(imageId))}?width=400`;
}

function buildEndpoints(collection) {
  const path = `/items/${collection}`;
  const primary = `${API_BASE}${path}`;
  const fallback = `${DIRECTUS_URL}${path}`;
  return primary === fallback ? [primary] : [primary, fallback];
}

function extractCoordinates(item) {
  if (item.lat != null && item.lon != null) {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
  }

  if (item.location && Array.isArray(item.location.coordinates) && item.location.coordinates.length >= 2) {
    const lon = Number(item.location.coordinates[0]);
    const lat = Number(item.location.coordinates[1]);
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
  }

  if (item.location && item.location.lat != null && item.location.lon != null) {
    const lat = Number(item.location.lat);
    const lon = Number(item.location.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
  }

  return null;
}

function getUpdatedAt(item) {
  if (!item) return null;
  const candidates = [
    'updated_at', 'updated', 'date_updated', 'modified', 'modified_on',
    'updatedAt', 'updated_on', 'changed_at', 'created_at', 'created'
  ];

  for (const key of candidates) {
    const val = item[key];
    if (!val) continue;
    const ts = Date.parse(val);
    if (Number.isFinite(ts)) return ts;
  }

  // fallback: if item.meta or item._meta contains timestamp
  if (item.meta && item.meta.updated_at) {
    const ts2 = Date.parse(item.meta.updated_at);
    if (Number.isFinite(ts2)) return ts2;
  }

  return null;
}

function isWithinHours(timestamp, hours) {
  if (!timestamp) return false;
  const ageMs = Date.now() - timestamp;
  return ageMs <= hours * 60 * 60 * 1000;
}

function buildDescriptionHtml(description) {
  return description
    ? `<p>${formatText(description)}</p>`
    : '<p><i>説明はありません</i></p>';
}

function buildImageHtml(imageId, altText) {
  const imgUrl = buildImageUrl(imageId);
  return imgUrl
    ? `<img src="${imgUrl}" alt="${escapeHtml(altText)}" style="max-width:25vw; max-height:25vh; width:auto; height:auto; object-fit:cover;">`
    : '<div class="popup-image-empty">画像なし</div>';
}

// attempt to find an external URL from various possible fields/shapes
function extractUrlFromField(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw.length > 0) return extractUrlFromField(raw[0]);
  if (typeof raw === 'object') {
    if (raw.url) return raw.url;
    if (raw.href) return raw.href;
    if (raw.path) return raw.path;
    if (raw.redirect) return raw.redirect;
    if (raw.full_url) return raw.full_url;
    if (raw.data) return extractUrlFromField(raw.data);
    if (raw.value) return raw.value;
  }
  return null;
}

function resolveExternalUrl(shop) {
  if (!shop || typeof shop !== 'object') return null;
  const keys = ['url', 'website', 'link', 'external_url', 'website_url', 'instagram_url'];
  for (const k of keys) {
    if (k in shop) {
      const raw = shop[k];
      const got = extractUrlFromField(raw);
      if (got) return got;
    }
  }
  // also check any field that looks like it might contain a URL
  for (const k of Object.keys(shop)) {
    if (k.toLowerCase().includes('url') || k.toLowerCase().includes('link') || k.toLowerCase().includes('website')) {
      const got = extractUrlFromField(shop[k]);
      if (got) return got;
    }
  }
  return null;
}

function buildShopPopupContent(shop) {
  const safeName = escapeHtml(shop.name || '名称未設定');
  // prefer common URL fields; fallback to instagram_url if present
  const externalCandidate = resolveExternalUrl(shop);
  const externalUrl = sanitizeExternalUrl(externalCandidate);
  console.log('shop external candidate', { name: shop.name, externalCandidate, externalUrl, shop });
  const externalHtml = externalUrl
    ? `<p><a href="${externalUrl}" target="_blank" rel="noopener noreferrer">詳しくはこちら</a></p>`
    : '';

  // if no sanitized URL, collect candidate fields for debugging and show them
  let debugHtml = '';
  if (!externalUrl) {
    const candidates = {};
    // check common named fields
    const keys = ['url', 'website', 'link', 'external_url', 'website_url', 'instagram_url'];
    for (const k of keys) {
      if (k in shop) {
        const v = extractUrlFromField(shop[k]);
        if (v) candidates[k] = v;
      }
    }
    // also check any field name that looks like url/link/website
    for (const k of Object.keys(shop)) {
      const lk = k.toLowerCase();
      if ((lk.includes('url') || lk.includes('link') || lk.includes('website')) && !(k in candidates)) {
        const v = extractUrlFromField(shop[k]);
        if (v) candidates[k] = v;
      }
    }

    if (Object.keys(candidates).length > 0) {
      debugHtml = `<details style="margin-top:6px"><summary>デバッグ: URL候補</summary><pre style="white-space:pre-wrap">${escapeHtml(JSON.stringify(candidates, null, 2))}</pre></details>`;
    }
    // also include full shop object for deeper inspection
    try {
      debugHtml += `<details style="margin-top:6px"><summary>デバッグ: 全データ</summary><pre style="white-space:pre-wrap">${escapeHtml(JSON.stringify(shop, null, 2))}</pre></details>`;
    } catch (e) {
      // ignore
    }
  }

  return `
    <div class="shop-popup">
      <h3>${safeName}</h3>
      ${buildDescriptionHtml(shop.description)}
      ${buildImageHtml(extractFileId(shop.image || shop.photo), shop.name || '店舗画像')}
      ${externalHtml}
      ${debugHtml}
    </div>
  `;
}



function buildShishiPopupContent(shishi) {
  const safeName = escapeHtml(shishi.name || '名称未設定');
  const coords = extractCoordinates(shishi);
  const navHtml = coords
    ? `<p><button onclick="startNavigation(${coords[0]},${coords[1]})" style="display:inline-block;margin-top:8px;padding:6px 8px;background:#007bff;color:#fff;border-radius:4px;border:none;cursor:pointer">ナビ</button></p>`
    : '';

  return `
    <div class="shishi-popup">
      <h3>${safeName}</h3>
      ${buildDescriptionHtml(shishi.description)}
      ${buildImageHtml(extractFileId(shishi.photo || shishi.image), shishi.name || '獅子舞画像')}
      ${navHtml}
    </div>
  `;
}

async function fetchCollection(collection) {
  for (const url of buildEndpoints(collection)) {
    try {
      const resp = await fetch(url, {
        headers: {
          Accept: 'application/json'
        }
      });
      if (!resp.ok) {
        console.warn(`fetch ${url} returned ${resp.status}`);
        continue;
      }

      const payload = await resp.json();
      return Array.isArray(payload.data) ? payload.data : [];
    } catch (error) {
      console.warn(`fetch ${url} failed:`, error);
    }
  }

  console.error(`${collection} データの取得に失敗しました`);
  return null;
}

async function fetchShops() {
  const shops = await fetchCollection('shop');
  if (!shops) {
    return;
  }

  // store and render with filters
  shopsData = shops;
  try { renderShopFilterUI(); } catch (e) { console.warn('renderShopFilterUI failed', e); }
  try { renderShops(); } catch (e) { console.warn('renderShops failed', e); }
}

async function updateShishiLocation() {
  const shishiList = await fetchCollection('current');
  if (!shishiList) {
    return;
  }

  // filter to items updated within the last MAX_AGE_HOURS (configurable)
  // If MAX_AGE_HOURS === 0, treat as unlimited (show all items)
  let recentList;
  if (MAX_AGE_HOURS === 0) {
    recentList = shishiList;
  } else {
    recentList = shishiList.filter((it) => {
      const ts = getUpdatedAt(it);
      return isWithinHours(ts, MAX_AGE_HOURS);
    });
  }

  // if you want to fall back to showing items without timestamps, modify above

  const seenIds = new Set();

  recentList.forEach((shishi) => {
    const coords = extractCoordinates(shishi);
    if (!coords) {
      console.warn('skip shishi missing coords', shishi.id || shishi.name);
      return;
    }

    const id = String(shishi.id ?? shishi.name ?? `${coords[0]}:${coords[1]}`);
    seenIds.add(id);

    if (shishiMarkers[id]) {
      shishiMarkers[id].setLatLng(coords);
      shishiMarkers[id].setPopupContent(buildShishiPopupContent(shishi));
      return;
    }

    const marker = L.marker(coords, { icon: shishiIcon }).addTo(map);
    marker.bindPopup(buildShishiPopupContent(shishi), {
      maxWidth: 360,
      className: 'shishi-popup-container'
    });
    shishiMarkers[id] = marker;
  });

  Object.keys(shishiMarkers).forEach((id) => {
    if (!seenIds.has(id)) {
      map.removeLayer(shishiMarkers[id]);
      delete shishiMarkers[id];
    }
  });
  // update sidebar list (show only recent items)
  try {
    renderShishiList(recentList);
  } catch (e) {
    console.warn('renderShishiList failed', e);
  }
}

fetchShops();
updateShishiLocation();
setInterval(updateShishiLocation, UPDATE_INTERVAL);
