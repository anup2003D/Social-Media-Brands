// ============================================================
// app.js — ColabMap | Influencer-Brand Collab Finder
// Map:    Leaflet + CartoDB (free, no key)
// Search: Overpass API (OpenStreetMap)
// ============================================================

const ALL_NICHES = [
  "Fashion", "Beauty", "Food & Beverage", "Fitness", "Tech",
  "Travel", "Gaming", "Lifestyle", "Finance", "Education",
  "Entertainment", "Music", "Sports"
];

const NICHE_TAGS = {
  "Fashion":         [["shop","clothes"],["shop","shoes"],["shop","jewelry"],["shop","boutique"],["shop","tailor"]],
  "Beauty":          [["shop","beauty"],["shop","hairdresser"],["amenity","salon"],["shop","cosmetics"],["amenity","barbershop"]],
  "Food & Beverage": [["amenity","restaurant"],["amenity","cafe"],["amenity","bar"],["shop","bakery"],["amenity","fast_food"],["amenity","food_court"]],
  "Fitness": [
    ["leisure","fitness_centre"], ["leisure","sports_centre"],
    ["leisure","gym"], ["amenity","gym"], ["amenity","fitness_centre"],
    ["sport","fitness"], ["sport","gym"], ["sport","yoga"],
    ["shop","sports"], ["leisure","swimming_pool"], ["leisure","yoga"]
  ],
  "Tech":            [["shop","electronics"],["shop","computer"],["shop","mobile_phone"]],
  "Travel":          [["tourism","hotel"],["tourism","hostel"],["tourism","guest_house"],["shop","travel_agency"]],
  "Gaming":          [["shop","games"],["leisure","video_arcade"],["shop","video_games"]],
  "Lifestyle":       [["shop","gift"],["shop","interior_decoration"],["shop","furniture"]],
  "Finance":         [["amenity","bank"],["amenity","atm"],["office","financial"]],
  "Education":       [["amenity","school"],["amenity","university"],["amenity","college"]],
  "Entertainment":   [["amenity","cinema"],["amenity","theatre"],["amenity","arts_centre"]],
  "Music":           [["amenity","nightclub"],["shop","musical_instrument"]],
  "Sports":          [["leisure","stadium"],["leisure","pitch"],["leisure","track"]]
};

function detectNiches(tags) {
  const matched = new Set();
  for (const [key, val] of Object.entries(tags)) {
    for (const [niche, tagList] of Object.entries(NICHE_TAGS)) {
      for (const [tKey, tVal] of tagList) {
        if (key === tKey && val === tVal) matched.add(niche);
      }
    }
  }
  return Array.from(matched);
}

const state = {
  creatorLat: null, creatorLng: null, creatorLabel: '', matchedBrands: [],
  map: null, creatorMarker: null, brandMarkers: [], radiusCircle: null,
  _gpsLat: null, _gpsLng: null, _gpsLabel: null,
};

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  buildNicheCheckboxes();
  setupSlider();
  setupFilters();
  setupLocationInput();
  $('find-btn').addEventListener('click', handleSearch);
  $('csv-btn').addEventListener('click', exportCSV);
  showEmptyState('Ready to find your collabs?', 'Enter your location and niches, then click "Find Brand Collabs".');
});

function setupLocationInput() {
  const gpsBtn = $('gps-btn');
  if (!gpsBtn) return;
  gpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) { showToast('⚠️ Geolocation not supported.', 'warn'); return; }
    gpsBtn.disabled = true; gpsBtn.textContent = '⏳ Detecting…'; gpsBtn.classList.add('gps-loading');
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        state._gpsLat = lat; state._gpsLng = lng;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'User-Agent': 'ColabMap/1.0' } });
          const data = await res.json();
          const label = data.display_name ? data.display_name.split(',').slice(0, 3).join(',').trim() : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          $('location-input').value = label; state._gpsLabel = label;
        } catch {
          $('location-input').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`; state._gpsLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
        showToast('📍 Location detected!', 'success');
        gpsBtn.disabled = false; gpsBtn.textContent = '📍 Use My Location'; gpsBtn.classList.remove('gps-loading');
      }, (err) => {
        const msgs = { 1:'🔒 Permission denied.', 2:'📡 Unavailable.', 3:'⏱️ Timed out.' };
        showToast(msgs[err.code] || '❌ Could not get location.', 'warn');
        gpsBtn.disabled = false; gpsBtn.textContent = '📍 Use My Location'; gpsBtn.classList.remove('gps-loading');
      }, { timeout: 10000 });
  });
  $('location-input').addEventListener('input', () => { state._gpsLat = state._gpsLng = state._gpsLabel = null; });
}

function buildNicheCheckboxes() {
  const grid = $('niche-grid');
  const ICONS = { 'Fashion':'👗','Beauty':'💄','Food & Beverage':'🍜','Fitness':'💪', 'Tech':'💻','Travel':'✈️','Gaming':'🎮','Lifestyle':'🌟', 'Finance':'📈','Education':'📚','Entertainment':'🎬','Music':'🎵','Sports':'⚽' };
  ALL_NICHES.forEach(niche => {
    const id = `niche-${niche.replace(/[\s&]+/g,'_')}`;
    const input = document.createElement('input'); input.type='checkbox'; input.id=id; input.className='niche-checkbox'; input.value=niche; input.name='niches';
    const label = document.createElement('label'); label.htmlFor=id; label.className='niche-label'; label.innerHTML=`<span class="niche-dot"></span>${ICONS[niche]||'🔹'} ${niche}`;
    grid.appendChild(input); grid.appendChild(label);
  });
}

function setupSlider() {
  const slider = $('radius-slider'), display = $('radius-display');
  slider.addEventListener('input', () => {
    const v = +slider.value; display.textContent = v + ' km'; display.style.color = v > 50 ? '#f59e0b' : '';
    if (state.radiusCircle && state.creatorLat) state.radiusCircle.setRadius(v * 1000);
  });
}

function setupFilters() { $('filter-input')?.addEventListener('input', renderCards); $('filter-type')?.addEventListener('change', renderCards); }
function getSelectedNiches() { return [...document.querySelectorAll('input[name="niches"]:checked')].map(el => el.value); }

async function geocodeLocation(locationStr) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr)}&format=json&limit=1`;
  const res  = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'ColabMap/1.0' } });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

function buildOverpassQuery(lat, lng, radiusM, selectedNiches) {
  const radiusCapped = Math.min(radiusM, 100000);
  const parts = [];
  const seen = new Set();
  selectedNiches.forEach(niche => {
    (NICHE_TAGS[niche] || []).forEach(([key, value]) => {
      const sig = `${key}=${value}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      parts.push(`  node["${key}"="${value}"](around:${radiusCapped},${lat},${lng});`);
      parts.push(`  way["${key}"="${value}"](around:${radiusCapped},${lat},${lng});`);
    });
  });
  if (!parts.length) return null;
  return `[out:json][timeout:60];\n(\n${parts.join('\n')}\n);\nout body center qt;`;
}

async function fetchBrandsFromOSM(lat, lng, radiusKm, selectedNiches) {
  const query = buildOverpassQuery(lat, lng, radiusKm * 1000, selectedNiches);
  if (!query) return [];

  let lastError;
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[i];
    updateStatus(`🔍 Querying map data… (attempt ${i + 1}/${OVERPASS_ENDPOINTS.length})`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65000);

    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    'data=' + encodeURIComponent(query),
        signal:  controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.elements || [];
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
    }
  }
  throw new Error(`All map endpoints failed. Try again in 5 minutes.`);
}

function processOSMResults(elements, creatorLat, creatorLng, selectedNiches) {
  const seen = new Set();
  return elements.map(el => {
    const t = el.tags || {};
    // Ensure the place has a name
    if (!t.name && !t.brand) return null;

    const nameStr = t.name || t.brand;
    const lat = el.type === 'node' ? el.lat : (el.center ? el.center.lat : null);
    const lng = el.type === 'node' ? el.lon : (el.center ? el.center.lon : null);
    if (!lat || !lng) return null;

    const dedupKey = `${nameStr}__${lat.toFixed(3)}__${lng.toFixed(3)}`;
    if (seen.has(dedupKey)) return null;
    seen.add(dedupKey);

    const detectedNiches = detectNiches(t);
    const matchedNiches  = detectedNiches.filter(n => selectedNiches.includes(n));
    if (!matchedNiches.length) return null;

    let type = 'Local';
    if (t['brand:wikidata']) type = 'International';
    else if (t['brand'] && t['brand'] !== t.name) type = 'National';

    const locationParts = [
      t['addr:housenumber'] && t['addr:street'] ? `${t['addr:housenumber']} ${t['addr:street']}` : t['addr:street'],
      t['addr:city'] || t['addr:town'] || t['addr:village'],
      t['addr:state'], t['addr:country']
    ].filter(Boolean);
    const locationStr = locationParts.length ? locationParts.join(', ') : 'See map pin';

    const phone = t.phone || t['contact:phone'] || t['telephone'] || '—';
    const email = t.email || t['contact:email'] || '—';
    const website = t.website || t['contact:website'] || t['url'] || '';
    const instagram = t['contact:instagram'] || t['instagram'] || '';
    const description = t.description || t['brand'] ? `${t['brand'] || nameStr} — ${detectedNiches.join(', ')}` : detectedNiches.join(', ');

    return {
      fsqId: el.id, name: nameStr, phone, email, location: locationStr, lat, lng,
      niches: detectedNiches, matchedNiches, type, website, instagram, description,
      distanceKm: haversineDistance(creatorLat, creatorLng, lat, lng),
      openingHours: t.opening_hours || '', rating: null
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.distanceKm - b.distanceKm)
  .slice(0, 200);
}

async function handleSearch() {
  const locationText = $('location-input').value.trim();
  const selectedNiches = getSelectedNiches();
  const radiusKm = parseFloat($('radius-slider').value);

  if (!locationText) { showToast('⚠️ Please enter your location.', 'warn'); return; }
  if (!selectedNiches.length) { showToast('⚠️ Select at least one niche.', 'warn'); return; }

  setLoading(true); $('find-btn').disabled = $('csv-btn').disabled = true;

  try {
    let lat, lng, displayLabel;
    if (state._gpsLat && state._gpsLng) { lat = state._gpsLat; lng = state._gpsLng; displayLabel = state._gpsLabel || locationText; }
    else {
      updateStatus('📍 Locating address…');
      const coords = await geocodeLocation(locationText);
      if (!coords) { showToast('❌ Location not found. Try a city name or full address.', 'error'); setLoading(false); $('find-btn').disabled = false; return; }
      lat = coords.lat; lng = coords.lng; displayLabel = locationText;
    }
    state.creatorLat = lat; state.creatorLng = lng; state.creatorLabel = displayLabel;

    updateStatus(`🔍 Searching OpenStreetMap for brands…`);
    const elements = await fetchBrandsFromOSM(lat, lng, radiusKm, selectedNiches);
    
    updateStatus(`⚙️ Processing results…`);
    state.matchedBrands = processOSMResults(elements, lat, lng, selectedNiches);

    updateStatus('🗺️ Drawing map…');
    renderMap(lat, lng, displayLabel, radiusKm);
    renderCards();

    $('results-count').textContent = $('results-count-badge').textContent = state.matchedBrands.length;
    $('csv-btn').disabled = $('csv-btn-top').disabled = state.matchedBrands.length === 0;
    const msg = state.matchedBrands.length > 0 ? `✅ Found ${state.matchedBrands.length} brand(s)!` : `😕 No results found. Try a larger radius.`;
    showToast(msg, state.matchedBrands.length > 0 ? 'success' : 'warn');

  } catch (err) {
    showToast(`❌ ${err.message || 'Something went wrong.'}`, 'error');
  } finally { setLoading(false); $('find-btn').disabled = false; }
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function renderMap(lat, lng, locationName, radiusKm) {
  $('map-placeholder').style.display = 'none'; $('map').style.display = 'block';
  if (!state.map) {
    state.map = L.map('map', { zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19
    }).addTo(state.map);
  }
  state.brandMarkers.forEach(m => state.map.removeLayer(m)); state.brandMarkers = [];
  if (state.creatorMarker) state.map.removeLayer(state.creatorMarker);
  if (state.radiusCircle) state.map.removeLayer(state.radiusCircle);

  state.radiusCircle = L.circle([lat, lng], { radius: radiusKm * 1000, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.05, weight: 1.5, dashArray: '6 4' }).addTo(state.map);

  const creatorIcon = L.divIcon({ className: '', html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 0 20px rgba(124,58,237,0.8);border:3px solid rgba(255,255,255,0.3);animation:pulsePin 2s ease-in-out infinite;">⭐</div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
  const creatorName = $('creator-name').value.trim() || 'You (Creator)';
  state.creatorMarker = L.marker([lat, lng], { icon: creatorIcon, zIndexOffset: 9999 }).addTo(state.map).bindPopup(`<div class="popup-name">⭐ ${creatorName}</div><div class="popup-niche">📍 ${locationName}</div><div class="popup-detail">Creator Location · Radius: ${radiusKm} km</div>`, { maxWidth: 260 });

  const typeColors = { 'Local': '#10b981', 'National': '#a78bfa', 'International': '#f59e0b' };
  state.matchedBrands.forEach((brand, i) => {
    const color = typeColors[brand.type] || '#06b6d4';
    const icon  = L.divIcon({ className: '', html: `<div style="width:28px;height:28px;border-radius:50%;background:${color}22;border:2.5px solid ${color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${color};box-shadow:0 0 8px ${color}66;">${i+1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
    const popup = `<div class="popup-name">${brand.name}</div><div class="popup-niche">${brand.matchedNiches.join(' · ')}</div><div class="popup-detail">📍 ${brand.location}<br>${brand.phone !== '—' ? `📞 ${brand.phone}<br>` : ''}📏 ${brand.distanceKm.toFixed(1)} km away${brand.website ? `<br>🌐 <a href="${brand.website}" target="_blank" style="color:#06b6d4">${brand.website.replace(/^https?:\/\//,'')}</a>` : ''}</div>`;
    const m = L.marker([brand.lat, brand.lng], { icon }).addTo(state.map).bindPopup(popup, { maxWidth: 280 });
    state.brandMarkers.push(m);
  });

  const bounds = [[lat, lng], ...state.matchedBrands.map(b => [b.lat, b.lng])];
  if (bounds.length > 1) state.map.fitBounds(L.latLngBounds(bounds).pad(0.15)); else state.map.setView([lat, lng], 14);
}

function renderCards() {
  const grid = $('results-grid'), empty = $('empty-state'), filterText = ($('filter-input')?.value || '').toLowerCase(), filterType = $('filter-type')?.value || 'all';
  const filtered = state.matchedBrands.filter(b => { const text = [b.name, b.location, ...b.niches].join(' ').toLowerCase(); return text.includes(filterText) && (filterType === 'all' || b.type.toLowerCase() === filterType); });

  grid.innerHTML = '';
  if (!state.matchedBrands.length && !state.creatorLat) { showEmptyState('Ready to find your collabs?', 'Enter your location and niches, then hit "Find Brand Collabs".'); return; }
  if (!filtered.length) { showEmptyState('No brands match your filters', 'Try adjusting the search text or brand type filter.'); return; }

  empty.style.display = 'none';
  filtered.forEach((brand, i) => {
    const badgeClass = { Local:'badge-local', National:'badge-national', International:'badge-international' }[brand.type] || 'badge-local';
    const nicheTags = brand.niches.map(n => `<span class="niche-tag ${brand.matchedNiches.includes(n)?'matched':''}">${n}</span>`).join('');
    const card = document.createElement('div'); card.className = 'brand-card'; card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = `<div class="card-top"><div class="card-name">${brand.name}</div><div class="card-distance">📏 ${brand.distanceKm.toFixed(1)} km</div></div><span class="card-type-badge ${badgeClass}">${brand.type}</span><div class="card-niches">${nicheTags}</div><div class="card-desc">${brand.description}</div><div class="card-contacts">${brand.phone !== '—' ? `<div class="card-contact-row"><span class="contact-icon">📞</span><a href="tel:${brand.phone}">${brand.phone}</a></div>` : ''}<div class="card-contact-row"><span class="contact-icon">📍</span><span>${brand.location}</span></div>${brand.website ? `<div class="card-contact-row"><span class="contact-icon">🌐</span><a href="${brand.website}" target="_blank" rel="noopener">${brand.website.replace(/^https?:\/\//,'')}</a></div>` : ''}${brand.instagram ? `<div class="card-contact-row"><span class="contact-icon">📸</span><a href="https://instagram.com/${brand.instagram.replace('@','')}" target="_blank">${brand.instagram}</a></div>` : ''}${brand.openingHours ? `<div class="card-contact-row"><span class="contact-icon">🕒</span><span>${brand.openingHours}</span></div>` : ''}</div>`;
    card.addEventListener('click', () => { if (state.brandMarkers[i] && state.map) { state.map.setView([brand.lat, brand.lng], 16, { animate: true }); state.brandMarkers[i].openPopup(); } });
    grid.appendChild(card);
  });
  $('results-count').textContent = $('results-count-badge').textContent = filtered.length;
}

function exportCSV() {
  if (!state.matchedBrands.length) return;
  const headers = ['Brand Name','Phone','Location','Latitude','Longitude','Niche(s)','Matched Niche(s)','Type','Distance (km)','Website','Instagram','Opening Hours','Description','Node ID'];
  const rows = state.matchedBrands.map(b => [b.name, b.phone, b.location, b.lat, b.lng, b.niches.join(' | '), b.matchedNiches.join(' | '), b.type, b.distanceKm.toFixed(2), b.website, b.instagram, b.openingHours, b.description, b.fsqId]);
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `colabmap_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  showToast(`📥 Exported ${state.matchedBrands.length} brands!`, 'success');
}

function setLoading(active) {
  const overlay = $('loading-overlay'), grid = $('results-grid'), empty = $('empty-state');
  if (active) { grid.innerHTML=''; empty.style.display='none'; overlay.classList.add('active'); } else overlay.classList.remove('active');
}
function updateStatus(msg) { const el = $('loading-status'); if (el) el.textContent = msg; }
function showEmptyState(title, body) { const empty = $('empty-state'); empty.querySelector('h3').textContent = title; empty.querySelector('p').textContent = body; empty.style.display = 'flex'; }
let _toastTimer;
function showToast(msg, type = 'info') {
  const toast = $('toast'), toastMsg = $('toast-msg');
  const icons  = { success:'✅', warn:'⚠️', error:'❌', info:'ℹ️' }, colors = { success:'#10b981', warn:'#f59e0b', error:'#ef4444', info:'#06b6d4' };
  toastMsg.textContent = msg; toast.querySelector('.toast-icon').textContent = icons[type] || 'ℹ️';
  toast.style.borderLeftColor = colors[type] + '88'; toast.classList.add('show');
  clearTimeout(_toastTimer); _toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
}
