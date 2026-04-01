# 🤝 ColabMap — Influencer × Brand Collaboration Finder

> **Discover real, local brands near you that match your content niche — and reach out for trusted brand collaborations.**

---

## 🎯 The Problem It Solves

Growing as a content creator is tough — especially when it comes to **finding brand deals**. Most influencers face the same painful cycle:

- 📭 Sending cold DMs to big brands who never reply
- 🔍 Spending hours manually searching Google Maps for local businesses
- ❌ Reaching out to brands that don't even match their content niche
- 😕 Missing out on **thousands of local brands** that are actively looking for creators

**ColabMap solves all of this.**

Instead of guessing, ColabMap gives you a live, interactive map of real businesses near you — filtered by your exact content niche — so you can **find the right brand and reach out with confidence**.

---

## ✨ What ColabMap Does

| Feature | Description |
|---|---|
| 📍 **Location-Based Search** | Enter your city/address or use GPS to find brands in your area |
| 🎯 **Niche Matching** | Filter by 13 content niches — Fashion, Beauty, Food, Fitness, Tech, and more |
| 🗺️ **Live Interactive Map** | See every matched brand plotted on a dark Leaflet map with numbered pins |
| 📏 **Custom Radius** | Set your search radius from 1 km to 100 km |
| 🏷️ **Brand Classification** | Brands are auto-labelled as Local, National, or International |
| 📞 **Contact Info** | View phone numbers, websites, Instagram handles, and opening hours |
| 📥 **CSV Export** | Download your full list of matched brands as a spreadsheet |
| 🔒 **Secure API Proxy** | Your Foursquare API key stays hidden on the server — never exposed to the browser |

---

## 🧠 Who Is This For?

- **Nano & Micro Influencers** (1K–100K followers) looking for their first brand deals
- **Content Creators** who want to work with brands that actually align with their niche
- **Local Business Promoters** who want to pitch themselves to nearby businesses
- **Social Media Managers** scouting for brand partnership opportunities for their clients

---

## 🔍 Supported Content Niches

| | | |
|---|---|---|
| 👗 Fashion | 💄 Beauty | 🍜 Food & Beverage |
| 💪 Fitness | 💻 Tech | ✈️ Travel |
| 🎮 Gaming | 🌟 Lifestyle | 📈 Finance |
| 📚 Education | 🎬 Entertainment | 🎵 Music |
| ⚽ Sports | | |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML, CSS, Vanilla JavaScript |
| **Map** | [Leaflet.js](https://leafletjs.com/) + CartoDB Dark Tiles (free, no key) |
| **Geocoding** | [Nominatim](https://nominatim.org/) — OpenStreetMap (free) |
| **Brand Data** | [Foursquare Places API](https://foursquare.com/developers/) |
| **Backend** | Python + Flask (API proxy server) |
| **Config** | `.env` file for secure API key storage |

---

## ⚙️ How It Works

```
You type your location / press GPS
        ↓
Nominatim geocodes it → lat, lng
        ↓
Flask server calls Foursquare with your niche categories
        ↓
Real businesses returned, filtered, and classified
        ↓
Leaflet map renders pins + brand cards appear
```

Your **Foursquare API key** never leaves your server — the browser only talks to your local Flask backend at `/api/places`.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/anup2003D/Social-Media-Brands.git
cd Social-Media-Brands
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Add your Foursquare API key

Create a `.env` file in the project root:

```env
FOURSQUARE_API=your_foursquare_api_key_here
```

> 🔑 Get a free API key at [foursquare.com/developers](https://foursquare.com/developers/)

### 4. Run the app

```bash
python main.py
```

Visit **http://localhost:5000** in your browser. The app opens automatically.

---

## 📸 How to Use

1. **Enter your name** and social media handle
2. **Type your location** (city, area, or full address) — or click **📍 Use My Location**
3. **Set your search radius** using the slider (default: 25 km)
4. **Select your content niches** (pick as many as you want)
5. Click **🔍 Find Brand Collabs**
6. Browse the map and brand cards — click any card to fly to it on the map
7. **Download a CSV** of all matched brands to use in your outreach

---

## 📁 Project Structure

```
Social-Media-Brands/
├── main.py          # Flask backend — API proxy for Foursquare
├── index.html       # App UI structure
├── app.js           # All frontend logic (map, search, cards, CSV)
├── style.css        # UI styles
├── .env             # API key (not committed to Git)
├── requirements.txt # Python dependencies
└── README.md        # You are here
```

---

## 📦 Requirements

```
flask
python-dotenv
requests
```

---

## 🤝 Contributing

Pull requests are welcome! If you have ideas for new niches, better brand classification, or UI improvements, feel free to open an issue.

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<p align="center">Made for creators who are done waiting for brands to find them. 🚀</p>
