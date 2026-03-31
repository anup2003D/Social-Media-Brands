// ============================================================
// app.js — ColabMap | Influencer-Brand Collab Finder
//
// HOW IT WORKS:
//  1. Creator enters location (typed address OR GPS detect)
//  2. Creator selects niches   → mapped to OpenStreetMap tags
//  3. Overpass API is queried  → returns REAL businesses from OSM near creator
//  4. Results plotted on map   → Leaflet + CartoDB dark tiles
//  5. Brand cards shown        → sorted by distance, filterable
//  6. CSV exported on demand   → all found brands with contact info
// ============================================================

// ── Niche definitions & OpenStreetMap tag mappings ───────────
// (All brands are searched LIVE from OSM — no hardcoded brand database)

const ALL_NICHES = [
  "Fashion", "Beauty", "Food & Beverage", "Fitness", "Tech",
  "Travel", "Gaming", "Lifestyle", "Finance", "Education",
  "Entertainment", "Music", "Sports"
];

// Maps each niche → list of [OSM key, OSM value] pairs to query via Overpass API
const NICHE_TAGS = {
  "Fashion": [
    ["shop", "clothes"],
    ["shop", "fashion"],
    ["shop", "boutique"],
    ["shop", "accessories"],
    ["shop", "jewelry"],
    ["shop", "shoes"],
    ["shop", "leather"]
  ],
  "Beauty": [
    ["shop", "beauty"],
    ["shop", "cosmetics"],
    ["amenity", "beauty_salon"],
    ["shop", "hairdresser"],
    ["shop", "perfumery"],
    ["shop", "chemist"],
    ["shop", "herbalist"]
  ],
  "Food & Beverage": [
    ["amenity", "restaurant"],
    ["amenity", "cafe"],
    ["amenity", "bar"],
    ["shop", "bakery"],
    ["amenity", "fast_food"],
    ["shop", "beverage"],
    ["amenity", "food_court"],
    ["shop", "confectionery"],
    ["amenity", "ice_cream"]
  ],
  "Fitness": [
    ["leisure", "fitness_centre"],
    ["leisure", "sports_centre"],
    ["amenity", "gym"],
    ["shop", "sports"],
    ["leisure", "swimming_pool"],
    ["leisure", "yoga"]
  ],
  "Tech": [
    ["shop", "electronics"],
    ["shop", "computer"],
    ["shop", "mobile_phone"],
    ["office", "it"],
    ["shop", "telephone"],
    ["shop", "camera"]
  ],
  "Travel": [
    ["tourism", "hotel"],
    ["shop", "travel_agency"],
    ["tourism", "hostel"],
    ["tourism", "guest_house"],
    ["tourism", "motel"],
    ["amenity", "travel_agency"]
  ],
  "Gaming": [
    ["shop", "games"],
    ["leisure", "video_arcade"],
    ["shop", "video_games"],
    ["leisure", "amusement_arcade"]
  ],
  "Lifestyle": [
    ["shop", "gift"],
    ["shop", "interior_decoration"],
    ["shop", "home"],
    ["shop", "furniture"],
    ["shop", "florist"],
    ["shop", "stationery"],
    ["shop", "art"]
  ],
  "Finance": [
    ["amenity", "bank"],
    ["office", "financial"],
    ["amenity", "bureau_de_change"],
    ["office", "insurance"],
    ["amenity", "atm"]
  ],
  "Education": [
    ["amenity", "school"],
    ["amenity", "college"],
    ["amenity", "university"],
    ["office", "educational_institution"],
    ["shop", "books"],
    ["amenity", "library"]
  ],
  "Entertainment": [
    ["amenity", "cinema"],
    ["amenity", "theatre"],
    ["leisure", "amusement_arcade"],
    ["amenity", "nightclub"],
    ["leisure", "escape_game"],
    ["amenity", "arts_centre"]
  ],
  "Music": [
    ["shop", "music"],
    ["amenity", "music_venue"],
    ["shop", "musical_instrument"],
    ["amenity", "nightclub"]
  ],
  "Sports": [
    ["shop", "sports"],
    ["leisure", "stadium"],
    ["leisure", "sports_centre"],
    ["leisure", "golf_course"],
    ["leisure", "pitch"]
  ]
};

// ── App State ───────────────────────────────────────────────
const state = {
  creatorLat:    null,
  creatorLng:    null,
  creatorLocationLabel: '', // human-readable label for map popup
  matchedBrands: [],       // processed brand objects from Overpass
  map:           null,     // Leaflet map instance
  creatorMarker: null,
  brandMarkers:  [],
  radiusCircle:  null,
};

// ── DOM Helpers ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildNicheCheckboxes();
  setupSlider();
  setupFilters();
  setupLocationInput();
  $('find-btn').addEventListener('click', handleSearch);
  $('csv-btn').addEventListener('click', exportCSV);

  // Show initial empty state
  showEmptyState('Ready to find your collabs?', 'Enter your location and niches, then click "Find Brand Collabs".');
});

// ── Location input & GPS detect ─────────────────────────────
function setupLocationInput() {
  const gpsBtn = $('gps-btn');
  if (!gpsBtn) return;

  gpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('⚠️ Geolocation is not supported by your browser.', 'warn');
      return;
    }

    gpsBtn.disabled = true;
    gpsBtn.textContent = '⏳ Detecting…';
    gpsBtn.classList.add('gps-loading');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Reverse geocode to get a human-readable label
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'ColabMap-InfluencerBrandFinder/1.0' } }
          );
          const data = await res.json();
          const label = data.display_name
            ? data.display_name.split(',').slice(0, 3).join(',').trim()
            : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          $('location-input').value = label;
          // Pre-fill hidden coords so user doesn't need to geocode again
          state._gpsLat = lat;
          state._gpsLng = lng;
          state._gpsLabel = label;
          showToast('📍 Location detected successfully!', 'success');
        } catch {
          $('location-input').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          state._gpsLat = lat;
          state._gpsLng = lng;
          state._gpsLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          showToast('📍 GPS coordinates captured!', 'success');
        }

        gpsBtn.disabled = false;
        gpsBtn.textContent = '📍 Use My Location';
        gpsBtn.classList.remove('gps-loading');
      },
      (err) => {
        let msg = '❌ Could not get your location.';
        if (err.code === 1) msg = '🔒 Location permission denied. Please allow access or type your address.';
        if (err.code === 2) msg = '📡 Location unavailable. Please type your address manually.';
        if (err.code === 3) msg = '⏱️ Location request timed out. Please try again.';
        showToast(msg, 'warn');
        gpsBtn.disabled = false;
        gpsBtn.textContent = '📍 Use My Location';
        gpsBtn.classList.remove('gps-loading');
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  });

  // If user manually types, clear saved GPS coords
  $('location-input').addEventListener('input', () => {
    state._gpsLat = null;
    state._gpsLng = null;
    state._gpsLabel = null;
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
    input.type = 'checkbox'; input.id = id;
    input.className = 'niche-checkbox'; input.value = niche; input.name = 'niches';

    const label = document.createElement('label');
    label.htmlFor = id; label.className = 'niche-label';
    label.innerHTML = `<span class="niche-dot"></span>${ICONS[niche]||'🔹'} ${niche}`;

    grid.appendChild(input);
    grid.appendChild(label);
  });
}

// ── Slider ──────────────────────────────────────────────────
function setupSlider() {
  const slider = $('radius-slider');
  const display = $('radius-display');
  slider.addEventListener('input', () => {
    const v = +slider.value;
    display.textContent = v + ' km';
    if (v > 50) display.style.color = '#f59e0b';  // warn if large
    else         display.style.color = '';
    if (state.radiusCircle && state.creatorLat) {
      state.radiusCircle.setRadius(v * 1000);
    }
  });
}

// ── Filters ─────────────────────────────────────────────────
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
  const locationText   = $('location-input').value.trim();
  const selectedNiches = getSelectedNiches();
  const radiusKm       = parseFloat($('radius-slider').value);

  // Validate
  if (!locationText)          { showToast('⚠️ Please enter your location or use GPS detection.', 'warn'); return; }
  if (!selectedNiches.length) { showToast('⚠️ Select at least one niche.', 'warn'); return; }

  setLoading(true);
  $('find-btn').disabled = true;
  $('csv-btn').disabled  = true;

  try {
    let lat, lng, displayLabel;

    // If user used GPS button, reuse saved coords (skip geocoding)
    if (state._gpsLat && state._gpsLng) {
      lat = state._gpsLat;
      lng = state._gpsLng;
      displayLabel = state._gpsLabel || locationText;
    } else {
      // ── Step 1: Geocode creator location ──────────────────
      updateStatus('📍 Locating you on the map…');
      const coords = await geocodeLocation(locationText);
      if (!coords) {
        showToast('❌ Location not found. Try a city name like "Mumbai" or "Delhi".', 'error');
        setLoading(false); $('find-btn').disabled = false; return;
      }
      lat = coords.lat;
      lng = coords.lng;
      displayLabel = locationText;
    }

    state.creatorLat = lat;
    state.creatorLng = lng;
    state.creatorLocationLabel = displayLabel;

    // ── Step 2: Query Overpass for real brands ────────────
    updateStatus(`🔍 Searching OpenStreetMap for nearby brands within ${radiusKm} km…`);
    const rawElements = await fetchBrandsFromOSM(lat, lng, radiusKm, selectedNiches);

    // ── Step 3: Process results ───────────────────────────
    updateStatus(`⚙️ Processing ${rawElements.length} locations found…`);
    state.matchedBrands = processOSMResults(rawElements, lat, lng, selectedNiches);

    // ── Step 4: Render map ────────────────────────────────
    updateStatus('🗺️ Drawing map…');
    renderMap(lat, lng, displayLabel, radiusKm);

    // ── Step 5: Render cards ──────────────────────────────
    renderCards();

    // Update stats
    $('results-count').textContent       = state.matchedBrands.length;
    $('results-count-badge').textContent = state.matchedBrands.length;
    $('csv-btn').disabled = state.matchedBrands.length === 0;

    // Sync top CSV button
    $('csv-btn-top').disabled = state.matchedBrands.length === 0;

    const msg = state.matchedBrands.length > 0
      ? `✅ Found ${state.matchedBrands.length} real brand(s) within ${radiusKm} km of ${displayLabel}!`
      : `😕 No matching businesses found within ${radiusKm} km. Try a larger radius or different niches.`;
    showToast(msg, state.matchedBrands.length > 0 ? 'success' : 'warn');

  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('timeout')) {
      showToast('⏱️ Search timed out — try a smaller radius.', 'error');
    } else {
      showToast('❌ Something went wrong. Check your internet connection.', 'error');
    }
  } finally {
    setLoading(false);
    $('find-btn').disabled = false;
  }
}

// ════════════════════════════════════════════════════════════
//  GEOCODING — Nominatim (OpenStreetMap, free, no key)
// ════════════════════════════════════════════════════════════
async function geocodeLocation(locationStr) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationStr)}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'ColabMap-InfluencerBrandFinder/1.0'
    }
  });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = await res.json();

  if (!data.length) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name
  };
}

// ════════════════════════════════════════════════════════════
//  OVERPASS API — Search real businesses from OpenStreetMap
// ════════════════════════════════════════════════════════════

/**
 * Builds an Overpass QL query for all OSM tags matching selected niches,
 * filtered to named businesses within given radius of creator.
 */
function buildOverpassQuery(lat, lng, radiusM, selectedNiches) {
  const radiusCapped = Math.min(radiusM, 100000); // cap at 100 km for perf
  const parts = [];

  const seen = new Set(); // avoid duplicate tag queries
  selectedNiches.forEach(niche => {
    (NICHE_TAGS[niche] || []).forEach(([key, value]) => {
      const sig = `${key}=${value}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      // Query both nodes (point features) and ways (polygon features e.g. malls)
      parts.push(`  node["${key}"="${value}"]["name"](around:${radiusCapped},${lat},${lng});`);
      parts.push(`  way["${key}"="${value}"]["name"](around:${radiusCapped},${lat},${lng});`);
    });
  });

  if (!parts.length) return null;

  // out center → gives centroid for ways, body for nodes
  return `[out:json][timeout:30];\n(\n${parts.join('\n')}\n);\nout body center qt;`;
}

async function fetchBrandsFromOSM(lat, lng, radiusKm, selectedNiches) {
  const query = buildOverpassQuery(lat, lng, radiusKm * 1000, selectedNiches);
  if (!query) return [];

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query)
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const data = await res.json();
  return data.elements || [];
}

// ════════════════════════════════════════════════════════════
//  PROCESS OSM RESULTS
// ════════════════════════════════════════════════════════════
function processOSMResults(elements, creatorLat, creatorLng, selectedNiches) {
  const seen = new Set();
  const results = [];

  elements.forEach(el => {
    const t = el.tags || {};
    if (!t.name) return; // skip unnamed elements

    // Get lat/lng (nodes have lat/lon directly; ways have a center object)
    const lat = el.type === 'node' ? el.lat : (el.center ? el.center.lat : null);
    const lng = el.type === 'node' ? el.lon : (el.center ? el.center.lon : null);
    if (!lat || !lng) return;

    // Dedup by name + approximate location
    const dedupKey = `${t.name}__${lat.toFixed(3)}__${lng.toFixed(3)}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);

    // Determine which niches this business matches
    const detectedNiches   = detectNiches(t);
    const matchedNiches    = detectedNiches.filter(n => selectedNiches.includes(n));
    if (!matchedNiches.length) return;

    // Classify brand type using OSM brand tags
    let type = 'Local';
    if (t['brand:wikidata'])         type = 'International';
    else if (t['brand'] && t['brand'] !== t.name) type = 'National';

    // Build location string from OSM address tags
    const locationParts = [
      t['addr:housenumber'] && t['addr:street'] ? `${t['addr:housenumber']} ${t['addr:street']}` : t['addr:street'],
      t['addr:city'] || t['addr:town'] || t['addr:village'],
      t['addr:state'],
      t['addr:country']
    ].filter(Boolean);
    const locationStr = locationParts.length ? locationParts.join(', ') : 'See map pin';

    // Phone — OSM uses "phone" or "contact:phone"
    const phone = t.phone || t['contact:phone'] || t['telephone'] || '—';
    // Email
    const email = t.email || t['contact:email'] || '—';
    // Website
    const website = t.website || t['contact:website'] || t['url'] || '';
    // Instagram
    const instagram = t['contact:instagram'] || t['instagram'] || '';
    // Description tag
    const description = t.description || t['brand'] ? `${t['brand'] || t.name} — ${detectedNiches.join(', ')}` : detectedNiches.join(', ');

    const dist = haversineDistance(creatorLat, creatorLng, lat, lng);

    results.push({
      osmId:       el.id,
      name:        t.name,
      phone,
      email,
      location:    locationStr,
      lat,
      lng,
      niches:      detectedNiches,
      matchedNiches,
      type,
      website,
      instagram,
      description,
      distanceKm:  dist,
      openingHours: t['opening_hours'] || '',
      brandTag:    t['brand'] || ''
    });
  });

  // Sort: most niche matches first, then by distance
  return results
    .sort((a, b) => b.matchedNiches.length - a.matchedNiches.length || a.distanceKm - b.distanceKm)
    .slice(0, 200); // safety cap
}

/**
 * Reverse-maps OSM tags back to niche names.
 */
function detectNiches(tags) {
  const detected = new Set();
  for (const [niche, tagList] of Object.entries(NICHE_TAGS)) {
    for (const [key, value] of tagList) {
      if (tags[key] === value) {
        detected.add(niche);
        break;
      }
    }
  }
  return [...detected];
}

// ────────────────────────────────────────────────────────────
//  Haversine distance between two lat/lng points (km)
// ────────────────────────────────────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2
    + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ════════════════════════════════════════════════════════════
//  RENDER MAP (Leaflet + CartoDB dark tiles)
// ════════════════════════════════════════════════════════════
function renderMap(lat, lng, locationName, radiusKm) {
  $('map-placeholder').style.display = 'none';
  $('map').style.display = 'block';

  // Init map once
  if (!state.map) {
    state.map = L.map('map', { zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(state.map);
  }

  // Remove previous overlays
  state.brandMarkers.forEach(m => state.map.removeLayer(m));
  state.brandMarkers = [];
  if (state.creatorMarker) state.map.removeLayer(state.creatorMarker);
  if (state.radiusCircle)  state.map.removeLayer(state.radiusCircle);

  // Search radius circle
  state.radiusCircle = L.circle([lat, lng], {
    radius:      radiusKm * 1000,
    color:       '#7c3aed',
    fillColor:   '#7c3aed',
    fillOpacity: 0.05,
    weight:      1.5,
    dashArray:   '6 4'
  }).addTo(state.map);

  // Creator pin (pulsing star)
  const creatorIcon = L.divIcon({
    className: '',
    html: `<div style="
      width:40px;height:40px;border-radius:50%;
      background:linear-gradient(135deg,#7c3aed,#06b6d4);
      display:flex;align-items:center;justify-content:center;
      font-size:20px;
      box-shadow:0 0 20px rgba(124,58,237,0.8);
      border:3px solid rgba(255,255,255,0.3);
      animation:pulsePin 2s ease-in-out infinite;
    ">⭐</div>`,
    iconSize: [40, 40], iconAnchor: [20, 20]
  });
  const creatorName = $('creator-name').value.trim() || 'You (Creator)';
  state.creatorMarker = L.marker([lat, lng], { icon: creatorIcon, zIndexOffset: 9999 })
    .addTo(state.map)
    .bindPopup(`
      <div class="popup-name">⭐ ${creatorName}</div>
      <div class="popup-niche">📍 ${locationName}</div>
      <div class="popup-detail">Creator Location · Search Radius: ${radiusKm} km</div>
    `, { maxWidth: 260 });

  // Brand pins (color by type)
  const typeColors = { 'Local': '#10b981', 'National': '#a78bfa', 'International': '#f59e0b' };

  state.matchedBrands.forEach((brand, i) => {
    const color = typeColors[brand.type] || '#06b6d4';
    const brandIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:28px;height:28px;border-radius:50%;
        background:${color}22;border:2.5px solid ${color};
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:700;color:${color};
        box-shadow:0 0 8px ${color}66;
      ">${i + 1}</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14]
    });

    const websiteLink = brand.website
      ? `<br>🌐 <a href="${brand.website}" target="_blank" style="color:#06b6d4">${brand.website.replace(/^https?:\/\//,'')}</a>`
      : '';

    const m = L.marker([brand.lat, brand.lng], { icon: brandIcon })
      .addTo(state.map)
      .bindPopup(`
        <div class="popup-name">${brand.name}</div>
        <div class="popup-niche">${brand.matchedNiches.join(' · ')}</div>
        <div class="popup-detail">
          📍 ${brand.location}<br>
          ${brand.phone !== '—' ? `📞 ${brand.phone}<br>` : ''}
          ${brand.email !== '—' ? `✉️ ${brand.email}<br>` : ''}
          📏 ${brand.distanceKm.toFixed(1)} km away
          ${websiteLink}
        </div>
      `, { maxWidth: 280 });

    state.brandMarkers.push(m);
  });

  // Fit bounds to show creator + all brand pins
  const bounds = [[lat, lng], ...state.matchedBrands.map(b => [b.lat, b.lng])];
  if (bounds.length > 1) {
    state.map.fitBounds(L.latLngBounds(bounds).pad(0.15));
  } else {
    state.map.setView([lat, lng], 13);
  }
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
    return text.includes(filterText)
      && (filterType === 'all' || b.type.toLowerCase() === filterType);
  });

  grid.innerHTML = '';

  if (!state.matchedBrands.length && !state.creatorLat) {
    showEmptyState('Ready to find your collabs?', 'Fill in your location and niches, then hit "Find Brand Collabs".');
    return;
  }
  if (!filtered.length) {
    showEmptyState('No brands match your filters', 'Try adjusting the search text, brand type, or increase your radius.');
    return;
  }

  empty.style.display = 'none';

  filtered.forEach((brand, i) => {
    const badgeClass = { Local:'badge-local', National:'badge-national', International:'badge-international' }[brand.type] || 'badge-national';
    const nicheTags = brand.niches
      .map(n => `<span class="niche-tag ${brand.matchedNiches.includes(n) ? 'matched' : ''}">${n}</span>`)
      .join('');

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
        ${brand.phone !== '—' ? `
        <div class="card-contact-row">
          <span class="contact-icon">📞</span>
          <a href="tel:${brand.phone}">${brand.phone}</a>
        </div>` : ''}
        ${brand.email !== '—' ? `
        <div class="card-contact-row">
          <span class="contact-icon">✉️</span>
          <a href="mailto:${brand.email}">${brand.email}</a>
        </div>` : ''}
        <div class="card-contact-row">
          <span class="contact-icon">📍</span>
          <span>${brand.location}</span>
        </div>
        ${brand.website ? `
        <div class="card-contact-row">
          <span class="contact-icon">🌐</span>
          <a href="${brand.website}" target="_blank" rel="noopener">${brand.website.replace(/^https?:\/\//,'')}</a>
        </div>` : ''}
        ${brand.instagram ? `
        <div class="card-contact-row">
          <span class="contact-icon">📸</span>
          <a href="https://instagram.com/${brand.instagram.replace('@','')}" target="_blank">${brand.instagram}</a>
        </div>` : ''}
        ${brand.openingHours ? `
        <div class="card-contact-row">
          <span class="contact-icon">🕒</span>
          <span>${brand.openingHours}</span>
        </div>` : ''}
      </div>
    `;

    // Click card → open map popup for that brand
    card.addEventListener('click', () => {
      if (state.brandMarkers[i] && state.map) {
        state.map.setView([brand.lat, brand.lng], 16, { animate: true });
        state.brandMarkers[i].openPopup();
      }
    });

    grid.appendChild(card);
  });

  $('results-count').textContent       = filtered.length;
  $('results-count-badge').textContent = filtered.length;
}

// ════════════════════════════════════════════════════════════
//  CSV EXPORT
// ════════════════════════════════════════════════════════════
function exportCSV() {
  if (!state.matchedBrands.length) return;

  const headers = [
    'Brand Name', 'Phone', 'Email', 'Location',
    'Latitude', 'Longitude', 'Niche(s)', 'Matched Niche(s)',
    'Type', 'Distance (km)', 'Website', 'Instagram',
    'Opening Hours', 'Description', 'OSM ID'
  ];

  const rows = state.matchedBrands.map(b => [
    b.name, b.phone, b.email, b.location,
    b.lat, b.lng,
    b.niches.join(' | '), b.matchedNiches.join(' | '),
    b.type, b.distanceKm.toFixed(2),
    b.website, b.instagram,
    b.openingHours, b.description, b.osmId
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  const loc  = $('location-input').value.trim().replace(/\s+/g,'_') || 'search';
  a.download = `colabmap_brands_${loc}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`📥 Exported ${state.matchedBrands.length} brands to CSV!`, 'success');
}

// ════════════════════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════════════════════
function setLoading(active) {
  const overlay = $('loading-overlay');
  const grid    = $('results-grid');
  const empty   = $('empty-state');
  if (active) {
    grid.innerHTML = '';
    empty.style.display = 'none';
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

function updateStatus(msg) {
  const el = $('loading-status');
  if (el) el.textContent = msg;
}

function showEmptyState(title, body) {
  const empty = $('empty-state');
  empty.querySelector('h3').textContent = title;
  empty.querySelector('p').textContent  = body;
  empty.style.display = 'flex';
}

let _toastTimer;
function showToast(msg, type = 'info') {
  const toast    = $('toast');
  const toastMsg = $('toast-msg');
  const icons    = { success:'✅', warn:'⚠️', error:'❌', info:'ℹ️' };
  const colors   = { success:'#10b981', warn:'#f59e0b', error:'#ef4444', info:'#06b6d4' };
  toastMsg.textContent = msg;
  toast.querySelector('.toast-icon').textContent = icons[type] || 'ℹ️';
  toast.style.borderLeftColor = colors[type] + '88';
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}
