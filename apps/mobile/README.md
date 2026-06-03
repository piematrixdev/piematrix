# SkyWatch

A real-time augmented reality stargazing app built with React Native, Expo, and Three.js. Point your phone at the sky and see stars, planets, constellations, deep sky objects, and more — all rendered at 60fps with GPU-accelerated graphics.

**By Pie Matrix / Sky Guild**

---

## Features

### Core Sky View

- **Real-time AR sky rendering** — Uses device sensors (gyroscope, accelerometer, magnetometer) to track where you're pointing and renders the sky in real time
- **60fps GPU rendering** — Three.js via expo-gl for smooth, high-performance celestial rendering
- **Stereographic projection** — Accurate wide-field projection up to 175° FOV, matching professional planetarium software
- **Day/night sky cycle** — Sky dome color changes realistically based on sun altitude (night → twilight → golden hour → day)

### Stars

- **Progressive star loading** — Stars load in batches from Supabase database, starting with brightest
- **Magnitude-limited display** — Only shows stars visible at your current Bortle scale (light pollution level)
- **Realistic rendering** — Airy disc + diffraction spike shader, spectral color tinting, limb darkening
- **Twinkle effect** — Subtle scintillation on brighter stars
- **Zoom-adaptive loading** — Zooming in loads fainter stars automatically
- **Tap to identify** — Tap any star to see name, magnitude, spectral type, constellation, RA/Dec, distance

### Planets

- **All 7 visible planets** — Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune
- **Textured spheres** — 2K texture maps for realistic appearance
- **Saturn's rings** — Accurate ring tilt based on current orbital geometry
- **Shader-based glow** — Each planet has a colored glow halo
- **Tap to identify** — Shows planet name, magnitude, coordinates

### Moon

- **Phase-accurate rendering** — Real-time illumination fraction and terminator position
- **Procedural surface** — Noise-based maria, craters, and limb darkening
- **Position angle** — Lit crescent faces the correct direction relative to the sun
- **Earthshine** — Subtle blue-grey illumination on the dark side

### Sun

- **Shader-based corona** — Limb darkening, inner/mid/outer corona, radial rays
- **Drives sky lighting** — Sun altitude controls atmosphere color, ground darkening, star visibility
- **Safety** — Clearly labeled when visible

### Deep Sky Objects (DSOs)

- **5 object types** — Galaxies, Nebulae, Open Clusters, Globular Clusters, Planetary Nebulae
- **Unique shaders per type** — Each type has a distinct visual appearance
- **Magnitude-limited** — Shows objects up to mag 12
- **Tap to identify** — Shows object name, type, Messier/NGC designation

### Constellations

- **88 IAU constellations** — Full western constellation set
- **Stick figure lines** — Traditional asterism patterns connecting stars
- **Constellation art** — Beautiful PNG artwork overlaid on the sky (85 constellations)
- **Animated art** — Art fades in/out smoothly as you pan across the sky
- **Labels** — Constellation names displayed at center positions
- **Tap constellation names** — Shows info panel with constellation details
- **IAU boundaries** — Official constellation boundary lines appear when a constellation is selected

### Milky Way

- **Equirectangular texture** — Full-sky Milky Way band rendered as a textured sphere
- **Bortle-adaptive opacity** — Fades based on light pollution level
- **Night-only** — Only visible when sun is below -6° altitude

### Ground & Atmosphere

- **Panoramic ground textures** — Multiple HDRI ground panoramas (selectable)
- **Soft horizon blending** — Custom shader fades ground into sky smoothly (no hard edge)
- **Dynamic darkening** — Ground darkens realistically at night with twilight warm glow
- **Atmosphere dome** — Gradient sky dome with realistic Rayleigh scattering colors
- **Toggleable** — Both ground and atmosphere can be turned off independently

### Grids & Overlays

- **Altitude grid** — Horizontal circles at 15° intervals (cyan)
- **Azimuth grid** — Vertical arcs every 30° from horizon to zenith (cyan)
- **Equatorial grid** — RA hour circles and Dec parallels (pink/magenta)
- **Degree labels** — All grids show degree values at intersections
- **Horizon ring** — Subtle ring marking 0° altitude
- **Cardinal markers** — N/E/S/W direction indicators

### Time Travel

- **Set any date/time** — Jump to any moment in the past or future
- **Hour controls** — ±1h, ±6h quick buttons
- **Day controls** — ±1 day buttons
- **Live mode** — Return to real-time with one tap
- **Instant sky update** — Sky, sun position, lighting all update immediately when time changes
- **Visual time slider** — Shows current position in the day

### Interaction

- **Pinch to zoom** — FOV from 5° (telescope view) to 180° (all-sky)
- **Manual pan mode** — Switch from AR to touch-drag navigation
- **Tap to identify** — Tap any object (star, planet, DSO, moon, sun, constellation) for details
- **Object info panel** — Glass-morphism card showing name, type, magnitude, coordinates, distance, spectral info
- **Dismiss on tap outside** — Tap anywhere to close panels

---

## Navigation & Screens

### Home Screen

- **Tonight's sky** — Shows what's visible tonight based on your location
- **Weather conditions** — Stargazing weather forecast
- **Promo banners** — Rotating promotional cards (from Supabase)
- **Featured products** — Telescope/accessory recommendations
- **Action cards** — Quick access to Telescope Guide, Shop, Feedback
- **Animated tagline** — "Sky is not the limit · Think Beyond" marquee

### Sky View (Main)

- **Full-screen GL rendering** — Immersive sky experience
- **Top bar** — Back button, compass direction, AR/Manual mode, altitude
- **Bottom bar** — Current time, Bortle scale, FOV
- **FAB buttons** — Settings, AR/Manual toggle
- **Time travel panel** — Accessible from bottom bar time display

### Settings Panel

- **Bortle scale** — Adjust light pollution (1-9)
- **Layer toggles** — Toggle visibility of: constellations, planets, moon, sun, deep sky, satellites, meteors, labels, horizon, grids, milky way, atmosphere, ground

### Other Screens

- **Shop** — Browse telescopes, binoculars, accessories (Shopify integration)
- **Product Detail** — Full product info with purchase options
- **Category** — Browse by collection
- **Sky Calendar** — Upcoming celestial events
- **Telescope Guide** — Recommendations based on your setup
- **Support** — FAQ and contact info
- **Profile** — User account management
- **Feedback** — Submit feedback (stored in Supabase)
- **Calibration** — Sensor calibration screen on first entry

---

## Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo (SDK 51) |
| 3D Rendering | Three.js via expo-gl + expo-three |
| State | React hooks + refs (no external state lib) |
| Auth | Supabase Auth (email, Apple, Google) |
| Database | Supabase (PostgreSQL) |
| Shop | Shopify Storefront API |
| Sensors | expo-sensors (gyroscope, accelerometer, magnetometer) |
| Location | expo-location |
| Astronomy | @virtual-window/astronomy-engine (custom package) |

### Project Structure

```
apps/mobile/
├── App.tsx                    # Main app orchestrator, navigation, sky view HUD
├── src/
│   ├── SkyRenderer.tsx        # Three.js GL sky rendering (2000+ lines)
│   ├── hooks/
│   │   ├── useSkyEngine.ts    # Sky calculator lifecycle, time travel, star loading
│   │   └── useTouchGestures.ts # Pinch-zoom, pan, tap detection
│   ├── components/
│   │   ├── GlassCard.tsx      # Reusable blur + gradient glass card
│   │   ├── TimeTravelPanel.tsx # Time travel UI
│   │   ├── ObjectInfoPanel.tsx # Tapped object info card
│   │   └── SkyView.tsx        # SVG-based sky view (legacy)
│   ├── auth/
│   │   ├── AuthContext.tsx    # Auth provider
│   │   ├── LoginScreen.tsx    # Login UI
│   │   └── supabaseClient.ts  # Supabase client config
│   ├── data/
│   │   ├── constellations.json          # Constellation line data
│   │   └── constellation-boundaries.json # IAU boundary polygons
│   ├── stars.ts               # Star loading from Supabase
│   ├── constellations.ts      # Constellation line computation
│   ├── constellationArt.ts    # Constellation art positioning
│   ├── grids.ts               # Alt/Az/Equatorial grid generation
│   ├── milkyway.ts            # Milky Way band computation
│   ├── glLabels.ts            # GPU text sprite rendering
│   ├── projection.ts          # Screen projection math
│   ├── useSkyPointing.ts      # Sensor fusion for AR pointing
│   ├── starInfo.ts            # Star metadata utilities
│   ├── tonightsSky.ts         # Tonight's visible objects
│   ├── skyEvents.ts           # Weather & events from Supabase
│   ├── celestialImages.ts     # NASA image API
│   ├── shopify.ts             # Shopify API client
│   ├── HomeScreen.tsx         # Home screen
│   ├── ShopScreen.tsx         # Shop browser
│   ├── SettingsPanel.tsx      # Settings UI
│   ├── FeedbackScreen.tsx     # Feedback form
│   └── ...                    # Other screens
├── assets/
│   ├── planets/               # 2K planet texture maps
│   ├── constellations-png/    # 85 constellation art PNGs
│   ├── grounds/               # Ground panorama textures
│   ├── fonts/                 # Poppins font family
│   └── milkyway.png           # Milky Way equirectangular texture
└── scripts/
    ├── create-feedback-table.sql
    └── seed-promo-banners.sql
```

### Key Design Decisions

- **Refs over state** — Celestial positions update at 60fps via refs to avoid React re-render overhead
- **Equatorial frame** — Stars, DSOs, Milky Way, constellation art placed in equatorial coordinates; a single group rotation handles sidereal time
- **Throttled re-renders** — React state updates throttled to 2s in real-time mode; immediate in time-travel mode
- **Progressive loading** — Stars load in magnitude batches so the app is usable immediately
- **GPU text** — Labels rendered as texture sprites on the GPU, not React Native Text components

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- iOS Simulator or physical device (AR requires real sensors)
- Supabase project with star catalog

### Install & Run

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start -c

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

### Environment

The app connects to a Supabase instance for:
- Star catalog (progressive loading)
- User authentication
- Feedback storage
- Promo banners
- Sky events/weather

---

## Usage Tips

1. **First launch** — Grant location and motion permissions. Hold phone steady for compass calibration.
2. **Best experience** — Use outdoors at night in a dark location. Set Bortle to match your sky.
3. **Identify objects** — Tap anything in the sky. Stars, planets, DSOs, moon, sun, and constellation names are all tappable.
4. **Zoom in** — Pinch to zoom from 5° (deep sky detail) to 180° (full hemisphere).
5. **Time travel** — Tap the time in the bottom bar to open the time panel. Great for planning observations.
6. **Manual mode** — Tap the GPS/finger icon to switch between AR (sensor-driven) and manual (touch-drag) navigation.
7. **Constellation boundaries** — Tap a constellation name to see its official IAU boundary outline.

---

## License

Proprietary — Sky Guild / Pie Matrix. All rights reserved.
