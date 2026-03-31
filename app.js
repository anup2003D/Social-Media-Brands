// ============================================================
// app.js — ColabMap | Influencer-Brand Collab Finder
// Map:    Leaflet + CartoDB (free, no key)
// Search: Foursquare Places API (via Flask proxy at /api/places)
// ============================================================

// ── Niche list ───────────────────────────────────────────────
const ALL_NICHES = [
  "Fashion", "Beauty", "Food & Beverage", "Fitness", "Tech",
  "Travel", "Gaming", "Lifestyle", "Finance", "Education",
  "Entertainment", "Music", "Sports"
];

// Foursquare category label → our niche name (for reverse mapping)
const FSQ_CATEGORY_TO_NICHE = {
  "Clothing Store": "Fashion", "Apparel Store": "Fashion",
  "Shoe Store": "Fashion", "Jewelry Store": "Fashion",
  "Beauty Salon": "Beauty", "Salon": "Beauty", "Spa": "Beauty",
  "Barbershop": "Beauty", "Hair Salon": "Beauty",
  "Restaurant": "Food & Beverage", "Café": "Food & Beverage",
  "Bar": "Food & Beverage", "Bakery": "Food & Beverage",
  "Fast Food": "Food & Beverage", "Food": "Food & Beverage",
  "Gym": "Fitness", "Fitness Center": "Fitness",
  "Yoga Studio": "Fitness", "Sports Club": "Fitness",
  "Sports": "Fitness", "Pilates Studio": "Fitness",
  "Electronics Store": "Tech", "Mobile Store": "Tech",
  "Computer Store": "Tech",
  "Hotel": "Travel", "Hostel": "Travel", "Resort": "Travel",
  "Motel": "Travel", "Travel Agency": "Travel",
  "Arcade": "Gaming", "Game Room": "Gaming",
  "Furniture Store": "Lifestyle", "Home Decor": "Lifestyle",
  "Art Gallery": "Lifestyle", "Florist": "Lifestyle",
  "Bank": "Finance", "ATM": "Finance",
  "Financial Services": "Finance", "Insurance": "Finance",
  "School": "Education", "University": "Education",
  "College": "Education", "Library": "Education",
  "Movie Theater": "Entertainment", "Theater": "Entertainment",
  "Concert Hall": "Music", "Music Venue": "Music",
  "Night Club": "Music",
  "Stadium": "Sports", "Swimming Pool": "Sports",
  "Bowling Alley": "Sports",
};

// ── App State ────────────────────────────────────────────────
const state = {
  creatorLat:    null,
  creatorLng:    null,
  creatorLabel:  '',
  matchedBrands: [],
  map:           null,
  creatorMarker: null,
  brandMarkers:  [],
  radiusCircle:  null,
  _gpsLat: null, _gpsLng: null, _gpsLabel: null,
};

const $ = id => document.getElementById(id);

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildNicheCheckboxes();
  setupSlider();
  setupFilters();
  setupLocationInput();
  $('find-btn').addEventListener('click', handleSearch);
  $('csv-btn').addEventListener('click', exportCSV);
  showEmptyState('Ready to find your collabs?', 'Enter your location and niches, then click "Find Brand Collabs".');
});

// ── GPS location detect ──────────────────────────────────────
function setupLocationInput() {
  const gpsBtn = $('gps-btn');
  if (!gpsBtn) return;

  gpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) { showToast('⚠️ Geolocation not supported.', 'warn'); return; }
    gpsBtn.disabled = true;
    gpsBtn.textContent = '⏳ Detecting…';
    gpsBtn.classList.add('gps-loading');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        state._gpsLat = lat; state._gpsLng = lng;
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'User-Agent': 'ColabMap/1.0' } });
          const data = await res.json();
          const label = data.display_name
            ? data.display_name.split(',').slice(0, 3).join(',').trim()
            : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          $('location-input').value = label;
          state._gpsLabel = label;
        } catch {
          $('location-input').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          state._gpsLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
        showToast('📍 Location detected!', 'success');
        gpsBtn.disabled = false; gpsBtn.textContent = '📍 Use My Location';
        gpsBtn.classList.remove('gps-loading');
      },
      (err) => {
        const msgs = { 1:'🔒 Permission denied.', 2:'📡 Unavailable.', 3:'⏱️ Timed out.' };
        showToast(msgs[err.code] || '❌ Could not get location.', 'warn');
        gpsBtn.disabled = false; gpsBtn.textContent = '📍 Use My Location';
        gpsBtn.classList.remove('gps-loading');
      },
      { timeout: 10000 }
    );
  });

  $('location-input').addEventListener('input', () => {
    state._gpsLat = state._gpsLng = state._gpsLabel = null;
  });
}

// ── Build niche checkboxes ───────────────────────────────────
function buildNicheCheckboxes() {
  const grid = $('niche-grid');
  const ICONS = {
    'Fashion':'👗','Beauty':'💄','Food & Beverage':'🍜','Fitness':'💪',
    'Tech':'💻','Travel':'✈️','Gaming':'🎮','Lifestyle':'🌟',
    'Finance':'📈','Education':'📚','Entertainment':'🎬','Music':'🎵','Sports':'⚽'
  };
  ALL_NICHES.forEach(niche => {
    const id = `niche-${niche.replace(/[\s&]+/g,'_')}`;
    const input = document.createElement('input');
    input.type='checkbox'; input.id=id; input.className='niche-checkbox';
    input.value=niche; input.name='niches';
    const label = document.createElement('label');
    label.htmlFor=id; label.className='niche-label';
    label.innerHTML=`<span class="niche-dot"></span>${ICONS[niche]||'🔹'} ${niche}`;
    grid.appendChild(input); grid.appendChild(label);
  });
}

// ── Slider ───────────────────────────────────────────────────
function setupSlider() {
  const slider = $('radius-slider'), display = $('radius-display');
  slider.addEventListener('input', () => {
    const v = +slider.value;
    display.textContent = v + ' km';
    display.style.color = v > 50 ? '#f59e0b' : '';
    if (state.radiusCircle && state.creatorLat)
      state.radiusCircle.setRadius(v * 1000);
  });
}

// ── Filters ──────────────────────────────────────────────────
function setupFilters() {
  $('filter-input')?.addEventListener('input', renderCards);
  $('filter-type')?.addEventListener('change', renderCards);
}
function getSelectedNiches() {
  return [...document.querySelectorAll('input[name="niches"]:checked')].map(el => el.value);
}

// ════════════════════════════════════════════════════════════
//  MAIN SEARCH
// ════════════════════════════════════════════════════════════
async function handleSearch() {
  const locationText    = $('location-input').value.trim();
  const selectedNiches  = getSelectedNiches();
  const radiusKm        = parseFloat($('radius-slider').value);

  if (!locationText)           { showToast('⚠️ Please enter your location.', 'warn'); return; }
  if (!selectedNiches.length)  { showToast('⚠️ Select at least one niche.', 'warn'); return; }

  setLoading(true);
  $('find-btn').disabled = $('csv-btn').disabled = true;

  try {
    let lat, lng, displayLabel;

    // Step 1: Get coordinates
    if (state._gpsLat && state._gpsLng) {
      lat = state._gpsLat; lng = state._gpsLng;
      displayLabel = state._gpsLabel || locationText;
    } else {
      updateStatus('📍 Locating address…');
      const coords = await geocodeLocation(locationText);
      if (!coords) {
        showToast('❌ Location not found. Try a city name or full address.', 'error');
        setLoading(false); $('find-btn').disabled = false; return;
      }
      lat = coords.lat; lng = coords.lng; displayLabel = locationText;
    }

    state.creatorLat = lat; state.creatorLng = lng; state.creatorLabel = displayLabel;

    // Step 2: Call Flask proxy → Foursquare
    updateStatus(`🔍 Searching Foursquare for nearby brands…`);
    const places = await fetchPlacesFromServer(lat, lng, radiusKm, selectedNiches);
    console.log(`[ColabMap] Foursquare returned ${places.length} places`);

    // Step 3: Process
    updateStatus(`⚙️ Processing ${places.length} results…`);
    state.matchedBrands = processPlaces(places, lat, lng, selectedNiches);
    console.log(`[ColabMap] ${state.matchedBrands.length} brands after processing`);

    // Step 4: Map
    updateStatus('🗺️ Drawing map…');
    renderMap(lat, lng, displayLabel, radiusKm);

    // Step 5: Cards
    renderCards();

    $('results-count').textContent = $('results-count-badge').textContent = state.matchedBrands.length;
    $('csv-btn').disabled = $('csv-btn-top').disabled = state.matchedBrands.length === 0;

    const msg = state.matchedBrands.length > 0
      ? `✅ Found ${state.matchedBrands.length} brand(s) within ${radiusKm} km!`
      : `😕 No results within ${radiusKm} km. Try a larger radius or different niches.`;
    showToast(msg, state.matchedBrands.length > 0 ? 'success' : 'warn');

  } catch (err) {
    console.error(err);
    showToast(`❌ ${err.message || 'Something went wrong.'}`, 'error');
  } finally {
    setLoading(false); $('find-btn').disabled = false;
  }
}

// ── Geocode via Nominatim (free, no key) ─────────────────────
async function geocodeLocation(locationStr) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr)}&format=json&limit=1`;
  const res  = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'ColabMap/1.0' } });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// ── Call Flask proxy ─────────────────────────────────────────
async function fetchPlacesFromServer(lat, lng, radiusKm, selectedNiches) {
  const params = new URLSearchParams({
    lat, lng,
    radius: Math.round(radiusKm * 1000),
    niches: selectedNiches.join(',')
  });

  const res = await fetch(`/api/places?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  const data = await res.json();
  return data.places || [];
}

// ── Process Foursquare results ────────────────────────────────
function processPlaces(places, creatorLat, creatorLng, selectedNiches) {
  return places.map(place => {
    const geocodes  = place.geocodes?.main;
    if (!geocodes) return null;

    const lat = geocodes.latitude, lng = geocodes.longitude;

    // Detect niches from Foursquare categories
    const cats = (place.categories || []).map(c => c.name);
    const detectedNiches = [...new Set(
      cats.flatMap(cat =>
        Object.entries(FSQ_CATEGORY_TO_NICHE)
          .filter(([key]) => cat.toLowerCase().includes(key.toLowerCase()))
          .map(([, niche]) => niche)
      )
    )];

    // If we can't detect niche from categories, assign from request context
    const matchedNiches = detectedNiches.length
      ? detectedNiches.filter(n => selectedNiches.includes(n))
      : selectedNiches.slice(0, 1);

    // Location string
    const loc = place.location || {};
    const locationParts = [loc.address, loc.locality || loc.city, loc.region, loc.country].filter(Boolean);
    const locationStr = locationParts.join(', ') || 'See map pin';

    // Type classification by stats
    const ratings = place.stats?.total_ratings || 0;
    let type = 'Local';
    if (ratings > 5000) type = 'International';
    else if (ratings > 500) type = 'National';

    const dist = haversineDistance(creatorLat, creatorLng, lat, lng);

    return {
      fsqId:        place.fsq_id,
      name:         place.name,
      phone:        place.tel || '—',
      email:        '—',
      location:     locationStr,
      lat, lng,
      niches:       detectedNiches.length ? detectedNiches : matchedNiches,
      matchedNiches,
      type,
      website:      place.website || '',
      instagram:    place.social_media?.instagram ? `@${place.social_media.instagram}` : '',
      description:  cats.join(', ') || matchedNiches.join(', '),
      distanceKm:   dist,
      openingHours: place.hours?.display || '',
      rating:       place.rating || null,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.distanceKm - b.distanceKm)
  .slice(0, 200);
}

// ── Haversine distance ────────────────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ════════════════════════════════════════════════════════════
//  RENDER MAP  (Leaflet + CartoDB dark — free, no key)
// ════════════════════════════════════════════════════════════
function renderMap(lat, lng, locationName, radiusKm) {
  $('map-placeholder').style.display = 'none';
  $('map').style.display = 'block';

  if (!state.map) {
    state.map = L.map('map', { zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19
    }).addTo(state.map);
  }

  state.brandMarkers.forEach(m => state.map.removeLayer(m));
  state.brandMarkers = [];
  if (state.creatorMarker) state.map.removeLayer(state.creatorMarker);
  if (state.radiusCircle)  state.map.removeLayer(state.radiusCircle);

  // Radius circle
  state.radiusCircle = L.circle([lat, lng], {
    radius: radiusKm * 1000, color: '#7c3aed',
    fillColor: '#7c3aed', fillOpacity: 0.05, weight: 1.5, dashArray: '6 4'
  }).addTo(state.map);

  // Creator pin
  const creatorIcon = L.divIcon({
    className: '',
    html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 0 20px rgba(124,58,237,0.8);border:3px solid rgba(255,255,255,0.3);animation:pulsePin 2s ease-in-out infinite;">⭐</div>`,
    iconSize: [40, 40], iconAnchor: [20, 20]
  });
  const creatorName = $('creator-name').value.trim() || 'You (Creator)';
  state.creatorMarker = L.marker([lat, lng], { icon: creatorIcon, zIndexOffset: 9999 })
    .addTo(state.map)
    .bindPopup(`<div class="popup-name">⭐ ${creatorName}</div><div class="popup-niche">📍 ${locationName}</div><div class="popup-detail">Creator Location · Radius: ${radiusKm} km</div>`, { maxWidth: 260 });

  // Brand pins
  const typeColors = { 'Local': '#10b981', 'National': '#a78bfa', 'International': '#f59e0b' };
  state.matchedBrands.forEach((brand, i) => {
    const color = typeColors[brand.type] || '#06b6d4';
    const icon  = L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;border-radius:50%;background:${color}22;border:2.5px solid ${color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${color};box-shadow:0 0 8px ${color}66;">${i+1}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
    const popup = `
      <div class="popup-name">${brand.name}</div>
      <div class="popup-niche">${brand.matchedNiches.join(' · ')}</div>
      <div class="popup-detail">
        📍 ${brand.location}<br>
        ${brand.phone !== '—' ? `📞 ${brand.phone}<br>` : ''}
        📏 ${brand.distanceKm.toFixed(1)} km away
        ${brand.rating ? `<br>⭐ ${brand.rating}/10` : ''}
        ${brand.website ? `<br>🌐 <a href="${brand.website}" target="_blank" style="color:#06b6d4">${brand.website.replace(/^https?:\/\//,'')}</a>` : ''}
      </div>`;
    const m = L.marker([brand.lat, brand.lng], { icon }).addTo(state.map).bindPopup(popup, { maxWidth: 280 });
    state.brandMarkers.push(m);
  });

  const bounds = [[lat, lng], ...state.matchedBrands.map(b => [b.lat, b.lng])];
  if (bounds.length > 1) state.map.fitBounds(L.latLngBounds(bounds).pad(0.15));
  else state.map.setView([lat, lng], 14);
}

// ════════════════════════════════════════════════════════════
//  RENDER BRAND CARDS
// ════════════════════════════════════════════════════════════
function renderCards() {
  const grid       = $('results-grid');
  const empty      = $('empty-state');
  const filterText = ($('filter-input')?.value || '').toLowerCase();
  const filterType = $('filter-type')?.value || 'all';

  const filtered = state.matchedBrands.filter(b => {
    const text = [b.name, b.location, ...b.niches].join(' ').toLowerCase();
    return text.includes(filterText) && (filterType === 'all' || b.type.toLowerCase() === filterType);
  });

  grid.innerHTML = '';

  if (!state.matchedBrands.length && !state.creatorLat) {
    showEmptyState('Ready to find your collabs?', 'Enter your location and niches, then hit "Find Brand Collabs".');
    return;
  }
  if (!filtered.length) {
    showEmptyState('No brands match your filters', 'Try adjusting the search text or brand type filter.');
    return;
  }

  empty.style.display = 'none';

  filtered.forEach((brand, i) => {
    const badgeClass = { Local:'badge-local', National:'badge-national', International:'badge-international' }[brand.type] || 'badge-local';
    const nicheTags = brand.niches.map(n =>
      `<span class="niche-tag ${brand.matchedNiches.includes(n)?'matched':''}">${n}</span>`
    ).join('');

    const card = document.createElement('div');
    card.className = 'brand-card';
    card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = `
      <div class="card-top">
        <div class="card-name">${brand.name}</div>
        <div class="card-distance">📏 ${brand.distanceKm.toFixed(1)} km</div>
      </div>
      <span class="card-type-badge ${badgeClass}">${brand.type}</span>
      <div class="card-niches">${nicheTags}</div>
      <div class="card-desc">${brand.description}</div>
      <div class="card-contacts">
        ${brand.phone !== '—' ? `<div class="card-contact-row"><span class="contact-icon">📞</span><a href="tel:${brand.phone}">${brand.phone}</a></div>` : ''}
        <div class="card-contact-row"><span class="contact-icon">📍</span><span>${brand.location}</span></div>
        ${brand.website ? `<div class="card-contact-row"><span class="contact-icon">🌐</span><a href="${brand.website}" target="_blank" rel="noopener">${brand.website.replace(/^https?:\/\//,'')}</a></div>` : ''}
        ${brand.instagram ? `<div class="card-contact-row"><span class="contact-icon">📸</span><a href="https://instagram.com/${brand.instagram.replace('@','')}" target="_blank">${brand.instagram}</a></div>` : ''}
        ${brand.openingHours ? `<div class="card-contact-row"><span class="contact-icon">🕒</span><span>${brand.openingHours}</span></div>` : ''}
        ${brand.rating ? `<div class="card-contact-row"><span class="contact-icon">⭐</span><span>${brand.rating}/10 on Foursquare</span></div>` : ''}
      </div>`;

    card.addEventListener('click', () => {
      if (state.brandMarkers[i] && state.map) {
        state.map.setView([brand.lat, brand.lng], 16, { animate: true });
        state.brandMarkers[i].openPopup();
      }
    });
    grid.appendChild(card);
  });

  $('results-count').textContent = $('results-count-badge').textContent = filtered.length;
}

// ════════════════════════════════════════════════════════════
//  CSV EXPORT
// ════════════════════════════════════════════════════════════
function exportCSV() {
  if (!state.matchedBrands.length) return;
  const headers = ['Brand Name','Phone','Location','Latitude','Longitude','Niche(s)','Matched Niche(s)','Type','Distance (km)','Website','Instagram','Opening Hours','Rating','Description','FSQ ID'];
  const rows = state.matchedBrands.map(b => [
    b.name, b.phone, b.location, b.lat, b.lng,
    b.niches.join(' | '), b.matchedNiches.join(' | '),
    b.type, b.distanceKm.toFixed(2), b.website, b.instagram,
    b.openingHours, b.rating ?? '', b.description, b.fsqId
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell??'').replace(/"/g,'""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `colabmap_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast(`📥 Exported ${state.matchedBrands.length} brands!`, 'success');
}

// ════════════════════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════════════════════
function setLoading(active) {
  const overlay = $('loading-overlay'), grid = $('results-grid'), empty = $('empty-state');
  if (active) { grid.innerHTML=''; empty.style.display='none'; overlay.classList.add('active'); }
  else overlay.classList.remove('active');
}
function updateStatus(msg) { const el = $('loading-status'); if (el) el.textContent = msg; }
function showEmptyState(title, body) {
  const empty = $('empty-state');
  empty.querySelector('h3').textContent = title;
  empty.querySelector('p').textContent  = body;
  empty.style.display = 'flex';
}
let _toastTimer;
function showToast(msg, type = 'info') {
  const toast = $('toast'), toastMsg = $('toast-msg');
  const icons  = { success:'✅', warn:'⚠️', error:'❌', info:'ℹ️' };
  const colors = { success:'#10b981', warn:'#f59e0b', error:'#ef4444', info:'#06b6d4' };
  toastMsg.textContent = msg;
  toast.querySelector('.toast-icon').textContent = icons[type] || 'ℹ️';
  toast.style.borderLeftColor = colors[type] + '88';
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
}
