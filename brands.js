// ============================================================
// brands.js — Niche definitions & OpenStreetMap tag mappings
// No hardcoded brands — all brands are searched LIVE from OSM
// ============================================================

// All available niches shown in the UI
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
