"""
main.py — ColabMap Flask Backend
- Serves the frontend (index.html, app.js, style.css)
- Proxies Foursquare Places API calls (keeps API key secure on server)
- Reads API key from .env file
"""

import os
import webbrowser
import threading
import requests as req
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

# ── Load .env ────────────────────────────────────────────────
load_dotenv()
FSQ_API_KEY = os.getenv('FOURSQUARE_API')

# ── Foursquare category IDs per niche ────────────────────────
# Full list: https://docs.foursquare.com/data-products/docs/categories
NICHE_CATEGORIES = {
    "Fashion":         "17114,17126,17063,17000",   # clothes, shoes, jewelry, retail
    "Beauty":          "11039,11066,18008,11000",    # salon, barbershop, spa, health&beauty
    "Food & Beverage": "13065,13034,13003,13002,13000",  # restaurant, cafe, bar, bakery, food
    "Fitness":         "18021,18057,18056,18000",    # gym, yoga, sports club, sports
    "Tech":            "17069,17071,17068",          # electronics, mobile, computer
    "Travel":          "19048,19049,19050,19032",    # hotel, hostel, motel, resort
    "Gaming":          "10010,65f2c4672b6bb07ab57abf9d",  # arcade, game room
    "Lifestyle":       "17012,17121,17076,17031",    # art, furniture, home decor, florist
    "Finance":         "11121,11122,11010",          # bank, ATM, financial services
    "Education":       "12035,12058,12012,12021",    # school, university, college, library
    "Entertainment":   "10024,10000,10025,10041",    # cinema, arts & ent, music venue, theater
    "Music":           "10025,10014,10000",          # music venue, concert hall, arts
    "Sports":          "18000,19014,18026,18043",    # sports, stadium, swimming pool, bowling
}

# ── Flask App ────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=BASE_DIR)


@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


@app.route('/api/places')
def get_places():
    """Proxy endpoint: browser calls this, we call Foursquare with the secret key."""

    lat    = request.args.get('lat')
    lng    = request.args.get('lng')
    radius = request.args.get('radius', 5000, type=int)   # metres
    niches = request.args.get('niches', '')

    if not lat or not lng:
        return jsonify({'error': 'lat and lng are required'}), 400

    if not FSQ_API_KEY:
        return jsonify({'error': 'FOURSQUARE_API key not found in .env'}), 500

    selected_niches = [n.strip() for n in niches.split(',') if n.strip()]

    # Collect unique category IDs across all selected niches
    cat_set = set()
    for niche in selected_niches:
        for cat in NICHE_CATEGORIES.get(niche, '').split(','):
            if cat.strip():
                cat_set.add(cat.strip())

    if not cat_set:
        return jsonify({'places': []})

    all_places = []
    seen_ids   = set()

    # Split into batches of 5 categories (Foursquare recommends smaller category lists)
    cat_list   = list(cat_set)
    batch_size = 5

    for i in range(0, len(cat_list), batch_size):
        batch = ','.join(cat_list[i:i + batch_size])
        params = {
            'll':         f"{lat},{lng}",
            'radius':     min(radius, 100000),
            'categories': batch,
            'limit':      50,
            'fields':     'fsq_id,name,location,geocodes,categories,rating,stats,hours,tel,website,social_media'
        }
        headers = {
            'Authorization': FSQ_API_KEY,
            'Accept':        'application/json'
        }

        try:
            resp = req.get(
                'https://api.foursquare.com/v3/places/search',
                params=params,
                headers=headers,
                timeout=15
            )
            print(f"[ColabMap] FSQ batch {i//batch_size+1}: HTTP {resp.status_code}")

            if resp.ok:
                for place in resp.json().get('results', []):
                    fsq_id = place.get('fsq_id')
                    if fsq_id and fsq_id not in seen_ids:
                        seen_ids.add(fsq_id)
                        all_places.append(place)
            else:
                print(f"[ColabMap] FSQ error: {resp.text[:300]}")

        except Exception as e:
            print(f"[ColabMap] Request failed: {e}")

    print(f"[ColabMap] Total unique places found: {len(all_places)}")
    return jsonify({'places': all_places, 'count': len(all_places)})


# ── Launch ───────────────────────────────────────────────────
def open_browser(port):
    import time; time.sleep(1)
    webbrowser.open(f"http://localhost:{port}")


if __name__ == '__main__':
    PORT = 5000
    print(f"\n✅  ColabMap is running!")
    print(f"🌐  Open this in your browser → http://localhost:{PORT}")
    print(f"🔑  Using Foursquare API key from .env")
    print(f"🛑  Press Ctrl+C to stop.\n")
    threading.Thread(target=open_browser, args=(PORT,), daemon=True).start()
    app.run(host='localhost', port=PORT, debug=False)
