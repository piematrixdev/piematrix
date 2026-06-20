import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Image,
  ActivityIndicator, Modal, TextInput, FlatList, Animated, Platform, Alert, Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Font from 'expo-font';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { ContentProvider } from './src/content/ContentContext';
import { FavoritesProvider, useFavorites } from './src/favorites/FavoritesContext';
import ResetPasswordScreen from './src/auth/ResetPasswordScreen';
import { supabase as authSupabase } from './src/auth/supabaseClient';
import {
  Setting4, Clock, Building,
  ArrowLeft2,
  Star1, Radar, SearchNormal1, Moon, Heart, Maximize4, LocationDiscover, Eye,
  Home2, ShoppingBag, Calendar, ProfileCircle, Discover, Camera, Gallery,
} from 'iconsax-react-native';
import type { HorizontalCoordinates } from '@virtual-window/astronomy-engine';
import { useSkyPointing } from './src/useSkyPointing';
import { getCameraMinDimFovDeg } from './modules/camera-fov';
import SkyRenderer from './src/SkyRenderer';
import type { SkyRendererHandle } from './src/SkyRenderer';
import SkyIcon from './src/components/SkyIcon';
import { effectiveLimitingMagnitude } from './src/stars';
import { resolveStarName } from './src/starNames';
import { useSkyEngine } from './src/hooks/useSkyEngine';
import { useTouchGestures } from './src/hooks/useTouchGestures';
import GlassCard from './src/components/GlassCard';
import TimeTravelPanel from './src/components/TimeTravelPanel';
import { CompassReadout, LiveClock } from './src/components/LiveReadouts';
import ObjectInfoPanel, { SelectedObject } from './src/components/ObjectInfoPanel';
import ShopScreen from './src/ShopScreen';
import SupportScreen from './src/SupportScreen';
import HomeScreen from './src/HomeScreen';
import SkyCalendarScreen from './src/SkyCalendarScreen';
import TelescopeScreen from './src/TelescopeScreen';
import ProductDetailScreen from './src/ProductDetailScreen';
import CategoryScreen from './src/CategoryScreen';
import ProfileScreen from './src/ProfileScreen';
import SettingsPanel from './src/SettingsPanel';
import FeedbackScreen from './src/FeedbackScreen';
import SpaceShooterGame from './src/SpaceShooterGame';
import EventsScreen from './src/EventsScreen';
import PolarScopeScreen from './src/PolarScopeScreen';
import AIChatScreen from './src/AIChatScreen';
import { fetchFeaturedProducts, Product } from './src/shopify';
import { scheduleDailySkyNotification, scheduleEventReminders } from './src/notifications/PushNotificationService';
import * as Notifications from 'expo-notifications';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import OnboardingScreen from './src/OnboardingScreen';
import { getConstellation, formatRA, formatDec, formatAzAlt, getSpectralDescription, estimateDistance, SPECTRAL_COLORS } from './src/starInfo';
import { useFeatureFlags, refreshFeatureFlags } from './src/featureFlags';

const { width: W, height: H } = Dimensions.get('window');

/**
 * AR-matched FOV: the camera FOV used when entering the sky view.
 *
 * FOV here uses Stellarium's convention: angular extent across the screen's
 * MIN dimension (horizontal in portrait). 45° is a comfortable starting
 * value — wide enough to give context, narrow enough that AR pointing at
 * the real sky stays roughly aligned. Users can pinch in/out from there.
 */
const AR_FOV = 45;
/** Default FOV for manual (non-AR) navigation — same default for consistency. */
const DEFAULT_MANUAL_FOV = 45;

const BORTLE_MAG: Record<number, number> = {
  1: 7.6, 2: 7.1, 3: 6.6, 4: 6.2, 5: 5.6, 6: 5.1, 7: 4.6, 8: 4.1, 9: 3.5,
};

type Screen = 'home' | 'skywatch' | 'shop' | 'support' | 'product' | 'calendar' | 'telescope' | 'category' | 'profile' | 'feedback' | 'game' | 'events' | 'polarscope' | 'aichat';

// ─── Main App Content ────────────────────────────────────────────────────────

function AppContent() {
  // --- Navigation ---
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const flags = useFeatureFlags();
  const [selectedProductHandle, setSelectedProductHandle] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{ handle: string; title: string } | null>(null);
  const screenHistory = useRef<string[]>(['home']);

  // Kick off a feature-flag fetch as early as possible so gated UI shows
  // up correctly on first paint after the network round-trip lands.
  useEffect(() => { refreshFeatureFlags().catch(() => {}); }, []);

  // --- Push Notifications ---
  const { user } = useAuth();
  useEffect(() => {
    if (!user?.id) return;
    // Only (re)schedule local notifications if the user has ALREADY granted
    // notification permission — never trigger a permission prompt on launch.
    // The opt-in prompt happens in Profile when the user enables alerts.
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        scheduleDailySkyNotification(19, 0);
        const { fetchUpcomingEvents } = require('./src/skyEvents');
        const events = await fetchUpcomingEvents();
        if (events && events.length > 0) {
          scheduleEventReminders(events);
        }
      } catch {}
    })();

    // Handle notification tap — navigate to sky view or calendar
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'skywatch') {
        navigateTo('skywatch');
      } else if (data?.screen === 'calendar') {
        navigateTo('calendar');
      }
    });
    return () => sub.remove();
  }, [user?.id]);

  const navigateTo = (screen: string) => {
    screenHistory.current.push(screen);
    setCurrentScreen(screen as Screen);
  };
  const goBack = () => {
    if (screenHistory.current.length > 1) {
      screenHistory.current.pop();
      setCurrentScreen(screenHistory.current[screenHistory.current.length - 1] as Screen);
    } else {
      setCurrentScreen('home');
    }
  };

  // --- Settings ---
  const [bortle, setBortle] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [showTimePanel, setShowTimePanel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [calibratingToast, setCalibratingToast] = useState(false);
  // One-time gentle hint, shown when the sky view opens, pointing at the
  // compass button so the user knows how to re-align if the sky looks off.
  const [showCompassHint, setShowCompassHint] = useState(false);
  const compassPulse = useRef(new Animated.Value(0)).current;
  // Camera passthrough (AR) — overlay the stars on the live camera feed.
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  // Device camera FOV (across the screen's MIN dimension) measured natively
  // when the overlay turns on; null until measured (then renderer uses its
  // calibrated default). Lets the star overlay match the live feed 1:1.
  const [cameraFovDeg, setCameraFovDeg] = useState<number | null>(null);
  // Live mirror of cameraFovDeg for pinch-calibration (synchronous reads in the
  // gesture handler). Defaults to the renderer's calibrated fallback.
  const cameraFovRef = useRef(33);
  const [searchTarget, setSearchTarget] = useState<{ name: string; azimuth: number; altitude: number } | null>(null);
  const [fov, setFov] = useState(AR_FOV);
  const fovRef = useRef(AR_FOV);
  const [groundId, setGroundId] = useState('default');
  const [arMode, setArMode] = useState(true);
  const [manualAz, setManualAz] = useState(180);
  const [manualAlt, setManualAlt] = useState(45);
  const manualAzRef = useRef(180);
  const manualAltRef = useRef(45);
  const manualPosRef = useRef({ azimuth: 180, altitude: 45 });
  const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(null);
  const selectedObjectRef = useRef<{ name: string | null; type: string | null }>({ name: null, type: null });
  const skyRendererRef = useRef<SkyRendererHandle | null>(null);
  // Products for AI chat recommendations (cached once)
  const [chatProducts, setChatProducts] = useState<Product[]>([]);
  useEffect(() => { fetchFeaturedProducts(20).then(setChatProducts).catch(() => {}); }, []);
  // Star trail long-exposure simulation
  const [exposureActive, setExposureActive] = useState(false);
  const [exposureProgress, setExposureProgress] = useState(0); // 0–1
  const [exposureDone, setExposureDone] = useState(false);
  // Bumping this number tells SkyRenderer to wipe the accumulated trail.
  // Trails persist on screen (across exposureActive=false) until cleared.
  const [trailClearToken, setTrailClearToken] = useState(0);
  // Saving the captured frame to the device photo library.
  const [savingPhoto, setSavingPhoto] = useState(false);
  // One-tap dismissal of the "motion sensors off" banner.
  const [motionPromptDismissed, setMotionPromptDismissed] = useState(false);

  // Auto-stop exposure at 100% — leaves the trail rendered on screen so the
  // user can save / admire it. Tapping the comet again now clears it.
  useEffect(() => {
    if (exposureProgress >= 1 && exposureActive) {
      setExposureActive(false);
      setExposureDone(true);
    }
  }, [exposureProgress, exposureActive]);
  const [show, setShow] = useState({
    planets: true, moon: true, sun: true, constellations: true,
    deepSky: true, satellites: true, meteors: true, labels: true,
    horizon: true, altGrid: false, azGrid: false, eqGrid: false, milkyWay: true,
    atmosphere: true, ground: true, constellationBounds: false, redMode: false,
    targetPointer: false,
  });

  // Reset FOV to default every time the sky view becomes active.
  // AR mode uses a narrower FOV that matches typical phone-at-arm's-length
  // viewing geometry so the rendered sky aligns with the real sky.
  useEffect(() => {
    if (currentScreen === 'skywatch') {
      const target = arMode ? AR_FOV : DEFAULT_MANUAL_FOV;
      setFov(target);
      fovRef.current = target;
    }
  }, [currentScreen, arMode]);

  // When the sky view opens in AR mode, briefly highlight the compass button
  // (pulse + callout) so the user knows they can tap it to re-align the sky if
  // it looks off. Auto-dismisses after a few seconds.
  useEffect(() => {
    if (currentScreen !== 'skywatch' || !arMode) {
      setShowCompassHint(false);
      compassPulse.stopAnimation();
      compassPulse.setValue(0);
      return;
    }
    setShowCompassHint(true);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(compassPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(compassPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    const hide = setTimeout(() => setShowCompassHint(false), 6000);
    return () => {
      loop.stop();
      compassPulse.stopAnimation();
      compassPulse.setValue(0);
      clearTimeout(hide);
    };
  }, [currentScreen, arMode]);
  const toggle = (k: keyof typeof show) => setShow(p => ({ ...p, [k]: !p[k] }));

  // --- Sky engine ---
  const { state: sky, refs: skyRefs, actions: skyActions } = useSkyEngine(bortle);
  const { pointing, pointingRef: skyRef, recalibrate } = useSkyPointing();
  const glProjectRef = useRef<((az: number, alt: number, r?: number) => { x: number; y: number } | null) | null>(null);
  const zoomLoadTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If the device has no usable motion sensors (or Motion & Fitness permission
  // was denied), AR mode can't work — fall back to manual so the sky view still
  // opens and the user can pan by touch instead of being stuck.
  useEffect(() => {
    if (pointing.ready && pointing.arAvailable === false && arMode) {
      setArMode(false);
    }
  }, [pointing.ready, pointing.arAvailable, arMode]);

  // Camera passthrough only makes sense in AR (orientation-driven) mode — if AR
  // turns off (or sensors are unavailable), turn the camera overlay off too.
  useEffect(() => {
    if (!arMode && cameraMode) setCameraMode(false);
  }, [arMode, cameraMode]);

  // Toggle the live-camera star overlay. Requests camera permission in context
  // and forces AR mode so the sky tracks where the phone is pointed.
  const toggleCamera = useCallback(async () => {
    if (cameraMode) { setCameraMode(false); return; }
    let granted = cameraPerm?.granted ?? false;
    if (!granted) {
      const res = await requestCameraPerm();
      granted = !!res?.granted;
    }
    if (!granted) {
      Alert.alert(
        'Camera access needed',
        'To overlay the stars on your surroundings, enable camera access for Pie Matrix in Settings.',
        [{ text: 'OK' }],
      );
      return;
    }
    if (!arMode) {
      setArMode(true);
      setFov(AR_FOV);
      fovRef.current = AR_FOV;
    }
    setCameraMode(true);
    // Measure the real camera FOV so the overlay matches the live preview.
    //
    // `videoFieldOfView` reflects the device's CURRENT active format. Read too
    // early it returns the default full-sensor format (a wider FOV, ~74°);
    // once CameraView starts it switches the shared AVCaptureDevice to a
    // narrower preview format (~65°), which is what we actually want (matches
    // Stellarium). So we don't stop at the first reading — we keep polling for
    // a few seconds and use the latest value, so the post-configuration FOV
    // wins. Pinch-calibration afterwards can still override it.
    let tries = 0;
    const measure = () => {
      const f = getCameraMinDimFovDeg();
      if (f != null) { setCameraFovDeg(f); cameraFovRef.current = f; }
      if (tries++ < 14) setTimeout(measure, 250); // poll ~3.5s, always updating
    };
    measure();
  }, [cameraMode, cameraPerm, requestCameraPerm, arMode]);

  const limMag = BORTLE_MAG[bortle] ?? 5.6;

  // --- View center ---
  const viewCenter = useMemo(() => (
    arMode
      ? { azimuth: pointing.azimuth, altitude: pointing.altitude }
      : { azimuth: manualAz, altitude: manualAlt }
  ), [arMode, pointing.azimuth, pointing.altitude, manualAz, manualAlt]);

  // --- Sun altitude (drives sky/ground lighting) ---
  const sunAlt = Math.round(skyRefs.sun.current?.altitude ?? -20);

  // --- Touch gestures ---
  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchGestures({
    arMode,
    fovRef,
    cameraMode,
    cameraFovRef,
    onCameraFovChange: (f) => setCameraFovDeg(f),
    onFovChange: (newFov) => { fovRef.current = newFov; },
    onPan: (dAz, dAlt) => {
      manualAzRef.current = ((manualAzRef.current + dAz) % 360 + 360) % 360;
      manualAltRef.current = Math.max(-90, Math.min(90, manualAltRef.current - dAlt));
      manualPosRef.current = { azimuth: manualAzRef.current, altitude: manualAltRef.current };
    },
    onTap: (x, y) => findNearestObject(x, y),
    onZoomEnd: () => {
      if (zoomLoadTimeout.current) clearTimeout(zoomLoadTimeout.current);
      zoomLoadTimeout.current = setTimeout(() => skyActions.loadStarsForCurrentZoom(fovRef.current), 1500);
      // Sync refs back to state for UI display
      setFov(fovRef.current);
      if (!arMode) {
        setManualAz(manualAzRef.current);
        setManualAlt(manualAltRef.current);
      }
    },
  });

  // --- Object detection ---
  const findNearestObject = useCallback((tapX: number, tapY: number) => {
    const proj = glProjectRef.current;
    if (!proj) return;

    const stars = skyRefs.stars.current;
    const starPos = skyRefs.starPositions.current;
    const planetPos = skyRefs.planetPositions.current;

    // Match the magnitude limit the renderer uses for the current FOV so
    // the user can only tap stars that are actually drawn on screen.
    // Zooming in raises the limit, making fainter stars tappable.
    const fov = fovRef.current;
    const magLimit = effectiveLimitingMagnitude(fov, limMag);

    // Approximate the on-screen pixel size of a star with the given
    // magnitude — mirrors the formula used in the star shader so the
    // tap-hit area matches what the user sees rendered.
    const approxStarPx = (mag: number): number => {
      const flux = Math.pow(2.512, 5 - mag);
      const radius = 0.45 + Math.pow(flux, 0.45) * 0.7;
      const zoom = Math.max(0.7, Math.min(3.0, 60 / Math.max(fov, 5)));
      const brightFactor = Math.max(0, Math.min(1, (1.5 - mag) * 0.4));
      const brightBoost = 1 + brightFactor * 0.7;
      // dpr ≈ 3 on most modern phones; constant 1.1 matches shader.
      return Math.max(2, Math.min(50, radius * 3 * zoom * brightBoost * 1.1));
    };

    // We score every candidate by (distance / hitRadius). Lower = better.
    // Same physical distance gives a smaller normalized score for bigger
    // objects, so a tap "near" a bright star beats a tap "on" a faint
    // star nearby — which matches user intent.
    let best: { score: number; obj: SelectedObject } | null = null;
    const consider = (sx: number, sy: number, hitRadius: number, makeObj: () => SelectedObject) => {
      const d = Math.sqrt((sx - tapX) ** 2 + (sy - tapY) ** 2);
      if (d > hitRadius) return;
      const score = d / hitRadius;
      if (!best || score < best.score) {
        best = { score, obj: makeObj() };
      }
    };

    for (const star of stars) {
      // Skip stars that are too faint to be drawn at the current FOV.
      if (star.magnitude > magLimit) continue;
      const pos = starPos.get(star.id);
      if (!pos) continue;
      const sp = proj(pos.azimuth, pos.altitude, 100);
      if (!sp) continue;
      // Hit area: visible star size + small forgiveness margin. Bright
      // stars get wide hit zones (matching their halo), faint stars get
      // tight ones so they don't accidentally win over neighbors.
      const px = approxStarPx(star.magnitude);
      const hitRadius = Math.max(7, px * 0.6 + 4);
      consider(sp.x, sp.y, hitRadius, () => {
        // Easter egg star
        if (star.id === 'PIE-001') {
          return {
            type: 'Star', name: 'Raagavi',
            magnitude: star.magnitude, ra: star.ra, dec: star.dec,
            spectralType: 'M',
            constellation: 'Libra',
            extra: 'I built this entire sky — every star, every planet, every pixel you see. And when it came time to name one, there was only one choice.\n\nThis star is for my daughter, Raagavi. She doesn\'t know it yet, but her dad put her name in the cosmos before she could even spell it. One day she\'ll open this app, tap this dot, and realize her old man was kind of cool.\n\nBuilt with mass amounts of coffee and mass amounts of love.\n\nNeed an app built? I do that too. Hit me up.\n— Abhilash\nabhilash@myinstinct.in',
            azimuth: pos.azimuth, altitude: pos.altitude,
            spectralDesc: 'Named by her father, who built this sky',
            spectralColor: '#ffcc6f',
            raFormatted: formatRA(star.ra), decFormatted: formatDec(star.dec),
            azFormatted: formatAzAlt(pos.azimuth), altFormatted: formatAzAlt(pos.altitude),
          };
        }
        return {
          type: 'Star',
          // Prefer the catalog's own name, else look up the IAU/Bayer
          // catalog by position; fall back to the Gaia ID only if the
          // tapped star isn't in any named-star list.
          name: resolveStarName(star.name, star.id, star.ra, star.dec, star.magnitude),
          magnitude: star.magnitude, ra: star.ra, dec: star.dec,
          spectralType: star.spectralType,
          constellation: getConstellation(star.id) ?? undefined,
          azimuth: pos.azimuth, altitude: pos.altitude,
          distance: estimateDistance(star.magnitude, star.spectralType) ?? undefined,
          spectralDesc: getSpectralDescription(star.spectralType),
          spectralColor: SPECTRAL_COLORS[star.spectralType] ?? '#fff',
          raFormatted: formatRA(star.ra), decFormatted: formatDec(star.dec),
          azFormatted: formatAzAlt(pos.azimuth), altFormatted: formatAzAlt(pos.altitude),
        };
      });
    }

    // Planets are visually large (textured spheres or billboards); generous
    // hit radius matches their on-screen prominence.
    for (const planet of skyRefs.planets.current) {
      const pos = planetPos.get(planet.id);
      if (!pos) continue;
      const sp = proj(pos.azimuth, pos.altitude, 97);
      if (!sp) continue;
      consider(sp.x, sp.y, 35, () => ({
        type: 'Planet', name: planet.name,
        magnitude: planet.magnitude, ra: planet.ra, dec: planet.dec,
        azimuth: pos.azimuth, altitude: pos.altitude,
        raFormatted: formatRA(planet.ra), decFormatted: formatDec(planet.dec),
        azFormatted: formatAzAlt(pos.azimuth), altFormatted: formatAzAlt(pos.altitude),
      }));
    }

    for (const dso of skyRefs.deepSky.current.values()) {
      if (!dso.isVisible) continue;
      const sp = proj(dso.azimuth, dso.altitude, 97);
      if (!sp) continue;
      // DSOs are small fuzzy patches; use a moderate radius.
      consider(sp.x, sp.y, 22, () => ({
        type: 'Deep Sky', name: dso.object.name || dso.object.id,
        extra: dso.object.type + ' · ' + dso.object.id,
        azimuth: dso.azimuth, altitude: dso.altitude,
        azFormatted: formatAzAlt(dso.azimuth), altFormatted: formatAzAlt(dso.altitude),
      }));
    }

    const moon = skyRefs.moon.current;
    if (moon) {
      const sp = proj(moon.azimuth, moon.altitude, 97);
      if (sp) {
        consider(sp.x, sp.y, 40, () => ({
          type: 'Moon', name: 'Moon',
          extra: `${moon.phaseName} · ${moon.illumination.toFixed(0)}% illuminated`,
          azimuth: moon.azimuth, altitude: moon.altitude,
          azFormatted: formatAzAlt(moon.azimuth), altFormatted: formatAzAlt(moon.altitude),
        }));
      }
    }

    const sun = skyRefs.sun.current;
    if (sun) {
      const sp = proj(sun.azimuth, sun.altitude, 97);
      if (sp) {
        consider(sp.x, sp.y, 45, () => ({
          type: 'Sun', name: 'Sun', extra: sun.status,
          azimuth: sun.azimuth, altitude: sun.altitude,
          azFormatted: formatAzAlt(sun.azimuth), altFormatted: formatAzAlt(sun.altitude),
        }));
      }
    }

    // Check constellation labels (larger tap radius since labels are bigger)
    for (const cl of skyRefs.constellationLabels.current) {
      const sp = proj(cl.pos.azimuth, cl.pos.altitude, 97);
      if (!sp) continue;
      consider(sp.x, sp.y, 45, () => ({
        type: 'Constellation', name: cl.name,
        constellation: cl.name,
        azimuth: cl.pos.azimuth, altitude: cl.pos.altitude,
        azFormatted: formatAzAlt(cl.pos.azimuth), altFormatted: formatAzAlt(cl.pos.altitude),
      }));
    }

    setSelectedObject(best?.obj ?? null);
    selectedObjectRef.current = {
      name: best?.obj?.name ?? null,
      type: best?.obj?.type ?? null,
    };
  }, [limMag]);

  // ─── Screen routing ──────────────────────────────────────────────────────────

  if (currentScreen === 'home') {
    return (
      <View style={{ flex: 1 }}>
        <HomeScreen
          onNavigate={(screen) => {
            if (screen === 'skywatch') { recalibrate(); }
            navigateTo(screen);
          }}
          onProductSelect={(handle) => { setSelectedProductHandle(handle); navigateTo('product'); }}
          onCategorySelect={(handle, title) => { setSelectedCategory({ handle, title }); navigateTo('category'); }}
          onSearchObject={(target) => {
            // Recompute position from live sky data (HomeScreen positions may be
            // computed for a different time, e.g. 10 PM preview during daytime)
            let liveTarget = target;
            const deepSky = skyRefs.deepSky.current;
            const planetPos = skyRefs.planetPositions.current;
            const planets = skyRefs.planets.current;
            const moon = skyRefs.moon.current;
            const sun = skyRefs.sun.current;

            // Try to find the object in live sky data by name match
            const tName = target.name.toLowerCase();
            if (tName === 'moon' && moon) {
              liveTarget = { name: target.name, azimuth: moon.azimuth, altitude: moon.altitude };
            } else if (tName === 'sun' && sun) {
              liveTarget = { name: target.name, azimuth: sun.azimuth, altitude: sun.altitude };
            } else {
              // Check planets
              for (const p of planets) {
                if (p.name.toLowerCase() === tName) {
                  const pos = planetPos.get(p.id);
                  if (pos) liveTarget = { name: target.name, azimuth: pos.azimuth, altitude: pos.altitude };
                  break;
                }
              }
              // Check DSOs by id or name
              for (const dso of deepSky.values()) {
                const dsoName = (dso.object.name || '').toLowerCase();
                const dsoId = dso.object.id.toLowerCase();
                if (dsoId === tName || dsoName === tName || tName.includes(dsoId) || tName.includes(dsoName)) {
                  liveTarget = { name: target.name, azimuth: dso.azimuth, altitude: dso.altitude };
                  break;
                }
              }
            }

            setSearchTarget(liveTarget);
            recalibrate();
            navigateTo('skywatch');
          }}
          observer={skyRefs.coords.current}
        />
        {/* Bottom Tab Navigator */}
        <BottomTabBar active="home" onNav={(screen) => {
          if (screen === 'skywatch') recalibrate();
          navigateTo(screen);
        }} />
      </View>
    );
  }
  if (currentScreen === 'calendar') return (<View style={{ flex: 1 }}><SkyCalendarScreen observer={skyRefs.coords.current} onClose={() => navigateTo('home')} /><BottomTabBar active="calendar" onNav={(sc) => { if (sc === 'skywatch') recalibrate(); navigateTo(sc); }} /></View>);
  if (currentScreen === 'telescope') return (<View style={{ flex: 1 }}><TelescopeScreen observer={skyRefs.coords.current} onClose={() => navigateTo('home')} onOpenPolarScope={() => navigateTo('polarscope')} /><BottomTabBar active="" onNav={(sc) => { if (sc === 'skywatch') recalibrate(); navigateTo(sc); }} /></View>);
  if (currentScreen === 'product' && selectedProductHandle) return <ProductDetailScreen handle={selectedProductHandle} onClose={goBack} />;
  if (currentScreen === 'category' && selectedCategory) return <CategoryScreen collectionHandle={selectedCategory.handle} title={selectedCategory.title} onClose={goBack} onProductSelect={(handle) => { setSelectedProductHandle(handle); navigateTo('product'); }} />;
  if (currentScreen === 'shop') return (<View style={{ flex: 1 }}><ShopScreen onClose={() => navigateTo('home')} onProductSelect={(handle) => { setSelectedProductHandle(handle); navigateTo('product'); }} onCategorySelect={(handle, title) => { setSelectedCategory({ handle, title }); navigateTo('category'); }} /><BottomTabBar active="shop" onNav={(sc) => { if (sc === 'skywatch') recalibrate(); navigateTo(sc); }} /></View>);
  if (currentScreen === 'polarscope') return <PolarScopeScreen onClose={goBack} observerLongitude={skyRefs.coords.current.longitude} />;
  if (currentScreen === 'aichat') {
    if (!flags.ai_chat_enabled) {
      // Feature gated off — bounce back home rather than render the chat.
      navigateTo('home');
      return null;
    }
    return <AIChatScreen
      onClose={goBack}
      onNavigate={(screen) => navigateTo(screen as any)}
      onProductSelect={(handle) => { setSelectedProductHandle(handle); navigateTo('product'); }}
      onSearchObject={(target) => { setSearchTarget(target); recalibrate(); navigateTo('skywatch'); }}
      products={chatProducts}
    />;
  }
  if (currentScreen === 'support') return <SupportScreen onClose={goBack} />;
  if (currentScreen === 'feedback') return <FeedbackScreen onClose={goBack} />;
  if (currentScreen === 'events') return <EventsScreen onClose={goBack} />;
  if (currentScreen === 'game') return <SpaceShooterGame onClose={goBack} />;
  if (currentScreen === 'profile') return (<View style={{ flex: 1 }}><ProfileScreen onClose={() => navigateTo('home')} onNavigate={(sc) => navigateTo(sc as any)} /><BottomTabBar active="profile" onNav={(sc) => { if (sc === 'skywatch') recalibrate(); navigateTo(sc); }} /></View>);

  // --- Loading / error states ---
  if (sky.error) return <View style={s.center}><Text style={s.err}>{sky.error}</Text></View>;
  if (!sky.ready) return <View style={s.center}><Star1 size={48} color="#d4c5a0" variant="Bulk" /><Text style={s.loadSub}>{sky.loadMsg}</Text></View>;
  if (!pointing.ready) return <View style={s.center}><SkyIcon name="satellite" size={48} color="#d4c5a0" /><Text style={s.loadSub}>Waiting for sensors…</Text></View>;
  if (showSettings) return <SettingsPanel bortle={bortle} setBortle={b => setBortle(Math.max(1, Math.min(9, b)))} show={show} toggle={toggle} groundId={groundId} setGroundId={setGroundId} onClose={() => setShowSettings(false)} onOpenPolarScope={() => { setShowSettings(false); navigateTo('polarscope'); }} />;

  // ─── Sky View ────────────────────────────────────────────────────────────────

  const constSegs = skyRefs.constellationSegments.current.map(seg => ({ start: seg.start, end: seg.end }));

  return (
    <View style={s.root}>
      {/* Live camera feed behind the (transparent) sky renderer for AR overlay */}
      {cameraMode && cameraPerm?.granted && (
        <CameraView style={StyleSheet.absoluteFillObject} facing="back" />
      )}
      {/* Three.js sky renderer */}
      <SkyRenderer
        ref={skyRendererRef}
        azimuth={viewCenter.azimuth}
        altitude={viewCenter.altitude}
        fov={fov}
        fovRef={fovRef}
        pointingRef={skyRef}
        manualPosRef={manualPosRef}
        arMode={arMode}
        projectRef={glProjectRef}
        stars={skyRefs.stars.current}
        starPositions={skyRefs.starPositions.current}
        planets={skyRefs.planets.current}
        planetPositions={skyRefs.planetPositions.current}
        moonPosition={skyRefs.moon.current}
        sunPosition={skyRefs.sun.current}
        deepSkyPositions={skyRefs.deepSky.current}
        satellitePositions={skyRefs.satellites.current}
        satellitePositionsNextRef={skyRefs.satellitesNext}
        satelliteTimeRef={skyRefs.satellitesTime}
        sunAltitude={sunAlt}
        constellationSegments={constSegs}
        constellationLabels={skyRefs.constellationLabels.current}
        dataVersion={sky.skyVer}
        showAtmosphere={show.atmosphere}
        showGround={show.ground}
        showLayers={show}
        selectedConstellationId={selectedObject?.constellation ?? null}
        lst={skyRefs.lst.current}
        observerLatitude={skyRefs.coords.current.latitude}
        limitingMag={limMag}
        redMode={show.redMode ?? false}
        cameraMode={cameraMode}
        cameraFovDeg={cameraFovDeg ?? undefined}
        exposureMode={exposureActive}
        onExposureProgress={setExposureProgress}
        clearTrailToken={trailClearToken}
        groundId={groundId}
        selectedObjectRef={selectedObjectRef}
      />

      {/* Touch overlay */}
      <View
        style={StyleSheet.absoluteFill}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        pointerEvents="box-only"
      />

      {/* Center viewfinder / target reticle — marks the exact screen centre so
          you can precisely aim the phone at an object. Non-interactive. */}
      {show.targetPointer && (
      <View pointerEvents="none" style={s.reticleWrap}>
        <View style={s.reticleBox}>
          <View style={[s.reticleRing, show.redMode && { borderColor: 'rgba(255,68,68,0.7)' }]}>
            <View style={[s.reticleDot, show.redMode && { backgroundColor: '#ff4444' }]} />
          </View>
          <View style={[s.reticleTick, s.reticleTickTop, show.redMode && { backgroundColor: 'rgba(255,68,68,0.8)' }]} />
          <View style={[s.reticleTick, s.reticleTickBottom, show.redMode && { backgroundColor: 'rgba(255,68,68,0.8)' }]} />
          <View style={[s.reticleTick, s.reticleTickLeft, show.redMode && { backgroundColor: 'rgba(255,68,68,0.8)' }]} />
          <View style={[s.reticleTick, s.reticleTickRight, show.redMode && { backgroundColor: 'rgba(255,68,68,0.8)' }]} />
        </View>
      </View>
      )}

      {/* Red night mode — handled entirely in GL renderer */}

      {/* Pie Matrix logo */}
      <View style={[s.logo, show.redMode && { backgroundColor: 'rgba(60,0,0,0.9)' }]}>
        <Image source={require('./assets/pie-logo.png')} style={{ width: 36, height: 36, tintColor: show.redMode ? '#ff4444' : undefined } as any} resizeMode="contain" />
      </View>

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={goBack}>
          <GlassCard style={s.backBtn} intensity={20} borderRadius={19}>
            <View style={s.backBtnInner}>
              <ArrowLeft2 size={20} color={show.redMode ? '#ff4444' : '#fff'} variant="Linear" />
            </View>
          </GlassCard>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <CompassReadout
            pointingRef={skyRef}
            manualPosRef={manualPosRef}
            arMode={arMode}
            loadingStars={sky.loadingStars}
            redMode={show.redMode}
          />
        </View>
        <TouchableOpacity onPress={() => { recalibrate(); setCalibratingToast(true); setShowCompassHint(false); setTimeout(() => setCalibratingToast(false), 2500); }}>
          <View>
            {/* Pulsing attention ring (only while the open-hint is active) */}
            {showCompassHint && (
              <Animated.View
                pointerEvents="none"
                style={[
                  s.compassPulse,
                  {
                    opacity: compassPulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.6] }),
                    transform: [{ scale: compassPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
                  },
                ]}
              />
            )}
            <GlassCard style={s.backBtn} intensity={20} borderRadius={19}>
              <View style={s.backBtnInner}>
                <SkyIcon name="compass" size={20} color={showCompassHint ? '#d4c5a0' : '#fff'} />
              </View>
            </GlassCard>
          </View>
        </TouchableOpacity>
      </View>

      {/* Compass alignment hint — gentle one-time pointer to recalibrate */}
      {showCompassHint && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => { recalibrate(); setCalibratingToast(true); setShowCompassHint(false); setTimeout(() => setCalibratingToast(false), 2500); }}
          style={s.compassHint}
        >
          <Text style={s.compassHintText}>Sky looks off? Tap the compass to re-align</Text>
        </TouchableOpacity>
      )}

      {/* Calibrating toast */}
      {calibratingToast && (
        <View style={s.calibToast}>
          <Text style={s.calibToastText}>Calibrating… move phone gently</Text>
        </View>
      )}

      {/* Bottom info bar */}
      <GlassCard style={s.bottomBar} intensity={25} borderRadius={0}>
        <View style={s.bottomBarInner}>
          <View style={s.infoRow}>
            <TouchableOpacity style={s.infoGroup} onPress={() => setShowTimePanel(!showTimePanel)}>
              <Clock size={16} color={show.redMode ? '#ff4444' : showTimePanel ? '#d4c5a0' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
              <LiveClock timeRef={skyRefs.displayTime} isRealTime={sky.isRealTime} redMode={show.redMode} />
            </TouchableOpacity>
            <TouchableOpacity style={s.infoGroup} onPress={() => setShowSettings(true)}>
              <Building size={16} color={show.redMode ? '#ff4444' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
              <View>
                <Text style={[s.infoVal, show.redMode && { color: '#ff4444' }]}>Bortle {bortle}</Text>
                <Text style={[s.infoSub, show.redMode && { color: '#991111' }]}>mag {limMag.toFixed(1)}</Text>
              </View>
            </TouchableOpacity>
            <View style={s.infoGroup}>
              <Maximize4 size={16} color={show.redMode ? '#ff4444' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
              <View>
                <Text style={[s.infoVal, show.redMode && { color: '#ff4444' }]}>FOV {(cameraMode && cameraFovDeg != null ? cameraFovDeg : fov).toFixed(1)}°</Text>
                <Text style={[s.infoSub, show.redMode && { color: '#991111' }]}>mag {limMag.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        </View>
      </GlassCard>

      {/* Time travel panel */}
      {showTimePanel && (
        <TimeTravelPanel
          displayTime={sky.displayTime}
          isRealTime={sky.isRealTime}
          onAdjustHours={skyActions.adjustHours}
          onAdjustDays={skyActions.adjustDays}
          onGoLive={skyActions.goLive}
          onClose={() => setShowTimePanel(false)}
        />
      )}

      {/* Motion sensors prompt — shown when DeviceMotion is unavailable
          (denied/disabled). The sky still renders in manual pan mode, but
          AR alignment depends on motion access — point users to Settings. */}
      {pointing.ready && pointing.arAvailable === false && !motionPromptDismissed && (
        <View style={s.motionPrompt}>
          <View style={s.motionPromptInner}>
            <SkyIcon name="satellite" size={18} color="#fbbf24" />
            <View style={{ flex: 1 }}>
              <Text style={s.motionPromptTitle}>Motion access off</Text>
              <Text style={s.motionPromptBody}>
                Enable Motion &amp; Fitness so the sky aligns with where your phone is pointed.
              </Text>
            </View>
            <TouchableOpacity style={s.motionPromptBtn} onPress={() => Linking.openSettings()}>
              <Text style={s.motionPromptBtnText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMotionPromptDismissed(true)} style={s.motionPromptDismiss}>
              <Text style={s.motionPromptDismissText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* FAB — right side */}
      <View style={s.fab}>
        <TouchableOpacity style={s.fabBtn} onPress={() => setShowSearch(true)}>
          <SearchNormal1 size={20} color={show.redMode ? '#ff4444' : '#fff'} variant="Linear" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.fabBtn, show.redMode && s.fabRed]} onPress={() => toggle('redMode' as any)}>
          <Moon size={20} color={show.redMode ? '#ff4444' : '#fff'} variant={show.redMode ? 'Bold' : 'Linear'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.fabBtn, (exposureActive || exposureDone) && s.fabActive]}
          onPress={() => {
            if (exposureDone) {
              // Trail is being shown after a completed/stopped exposure —
              // tapping again wipes it.
              setTrailClearToken(t => t + 1);
              setExposureDone(false);
              setExposureProgress(0);
            } else if (exposureActive) {
              // Manually stopping mid-exposure: keep the partial trail so the
              // user can still capture / save it. Next tap clears.
              setExposureActive(false);
              setExposureDone(true);
            } else {
              // Idle → start a fresh exposure. SkyRenderer's "just started"
              // branch wipes any prior trail buffers itself, so we don't need
              // to bump clearTrailToken here (doing so would race with the
              // start-block and zero out trailStartTime).
              setExposureProgress(0);
              setExposureDone(false);
              setExposureActive(true);
            }
          }}
        >
          <SkyIcon name="comet2" size={20} color={exposureActive ? '#22c55e' : (exposureDone ? '#fbbf24' : (show.redMode ? '#ff4444' : '#fff'))} />
        </TouchableOpacity>
        {/* Save trailed sky to Photos — only useful while a trail is rendered */}
        {(exposureActive || exposureDone) && (
          <TouchableOpacity
            style={[s.fabBtn, savingPhoto && s.fabActive]}
            disabled={savingPhoto}
            onPress={async () => {
              if (savingPhoto) return;
              setSavingPhoto(true);
              try {
                const uri = await skyRendererRef.current?.captureSnapshot();
                if (!uri) {
                  Alert.alert('Capture failed', 'Could not snapshot the current sky. Please try again.');
                  return;
                }
                const { saveImageToPhotos } = require('./src/savePhoto');
                const r = await saveImageToPhotos(uri);
                if (r.ok) {
                  Alert.alert('Saved', 'Star trail saved to your Photos library.');
                } else if (r.reason === 'failed') {
                  Alert.alert('Save failed', 'The image was captured but could not be written to your library.');
                }
              } finally {
                setSavingPhoto(false);
              }
            }}
          >
            <Gallery size={20} color={savingPhoto ? '#22c55e' : (show.redMode ? '#ff4444' : '#fff')} variant={savingPhoto ? 'Bold' : 'Linear'} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.fabBtn} onPress={() => setShowSettings(true)}>
          <Setting4 size={20} color={show.redMode ? '#ff4444' : '#fff'} variant="Bulk" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.fabBtn, cameraMode && s.fabActive]} onPress={toggleCamera}>
          <Camera size={20} color={show.redMode ? '#ff4444' : (cameraMode ? '#22c55e' : '#fff')} variant="Bulk" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.fabBtn, !arMode && s.fabActive]}
          onPress={() => {
            setArMode(prev => {
              const next = !prev;
              if (prev) {
                // Switching from AR → manual: keep current view direction,
                // open up the FOV for easier navigation.
                setManualAz(pointing.azimuth); setManualAlt(pointing.altitude);
                manualAzRef.current = pointing.azimuth;
                manualAltRef.current = pointing.altitude;
                manualPosRef.current = { azimuth: pointing.azimuth, altitude: pointing.altitude };
                setFov(DEFAULT_MANUAL_FOV);
                fovRef.current = DEFAULT_MANUAL_FOV;
              } else {
                // Switching to AR: snap to the AR-matched FOV so the rendered
                // sky aligns with what the eye sees through the phone.
                setFov(AR_FOV);
                fovRef.current = AR_FOV;
              }
              return next;
            });
          }}
        >
          {arMode ? <SkyIcon name="ar-view" size={22} color={show.redMode ? '#ff4444' : '#22c55e'} /> : <SkyIcon name="ar-device" size={22} color={show.redMode ? '#ff4444' : '#d4c5a0'} />}
        </TouchableOpacity>
      </View>

      {/* Object info panel */}
      {(exposureActive || exposureDone) && (
        <View style={[s.exposureBanner, exposureDone && { borderColor: 'rgba(251,191,36,0.5)' }]} pointerEvents="none">
          <View style={[s.exposureDot, exposureDone && { backgroundColor: '#fbbf24' }]} />
          {exposureDone ? (
            <View style={s.exposureRow}>
              <Text style={[s.exposureText, { color: '#fbbf24' }]}>Star Trail Ready · Tap </Text>
              <Gallery size={14} color="#fbbf24" variant="Linear" />
              <Text style={[s.exposureText, { color: '#fbbf24' }]}> to save · Tap </Text>
              <SkyIcon name="comet2" size={14} color="#fbbf24" />
              <Text style={[s.exposureText, { color: '#fbbf24' }]}> to clear</Text>
            </View>
          ) : (
            <Text style={s.exposureText}>{`Star Trail Exposure · ${Math.round(exposureProgress * 100)}%`}</Text>
          )}
        </View>
      )}
      {selectedObject && (
        <ObjectInfoPanel object={selectedObject} onClose={() => { setSelectedObject(null); selectedObjectRef.current = { name: null, type: null }; }} />
      )}

      {/* Search targeting reticle */}
      {searchTarget && (
        <SearchReticle
          target={searchTarget}
          viewCenter={viewCenter}
          projectRef={glProjectRef}
          onCancel={() => setSearchTarget(null)}
          pointingRef={skyRef}
          arMode={arMode}
          manualPosRef={manualPosRef}
        />
      )}

      {/* Search modal */}
      {showSearch && (
        <SearchModal
          stars={skyRefs.stars.current}
          planets={skyRefs.planets.current}
          constellationLabels={skyRefs.constellationLabels.current}
          starPositions={skyRefs.starPositions.current}
          planetPositions={skyRefs.planetPositions.current}
          moon={skyRefs.moon.current}
          sun={skyRefs.sun.current}
          deepSky={skyRefs.deepSky.current}
          onSelect={(target) => {
            setSearchTarget(target);
            setShowSearch(false);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cardinal(az: number): string {
  const d = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return d[Math.round(az / 45) % 8] ?? 'N';
}

// ─── Bottom Tab Bar ──────────────────────────────────────────────────────────

function BottomTabBar({ active, onNav }: { active: string; onNav: (screen: string) => void }) {
  const tabs = [
    { key: 'home', label: 'Home', Icon: Home2 },
    { key: 'shop', label: 'Shop', Icon: ShoppingBag },
    { key: 'skywatch', label: 'Sky View', Icon: null },
    { key: 'calendar', label: 'Calendar', Icon: Calendar },
    { key: 'profile', label: 'Profile', Icon: ProfileCircle },
  ];

  return (
    <View style={tabS.wrap}>
      {tabs.map(tab => {
        if (tab.key === 'skywatch') {
          return (
            <TouchableOpacity key={tab.key} style={tabS.centerBtn} onPress={() => onNav('skywatch')} activeOpacity={0.8}>
              <Image source={require('./assets/milkyway.png')} style={tabS.centerImg} />
              <View style={tabS.centerIcon}>
                <SkyIcon name="telescope" size={26} color="#fff" />
              </View>
            </TouchableOpacity>
          );
        }
        const isActive = active === tab.key;
        const Icon = tab.Icon!;
        return (
          <TouchableOpacity key={tab.key} style={tabS.tab} onPress={() => onNav(tab.key)} activeOpacity={0.7}>
            <Icon size={22} color={isActive ? '#d4c5a0' : 'rgba(255,255,255,0.35)'} variant={isActive ? 'Bold' : 'Linear'} />
            <Text style={[tabS.tabLabel, isActive && { color: '#d4c5a0' }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabS = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 24, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: 'rgba(10,10,20,0.92)',
    borderRadius: 28, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  tab: { alignItems: 'center', paddingVertical: 4, minWidth: 54 },
  tabLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontFamily: 'Poppins-Regular', marginTop: 3 },
  centerBtn: { width: 56, height: 56, borderRadius: 28, marginTop: -28, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  centerImg: { ...StyleSheet.absoluteFillObject, width: 56, height: 56, borderRadius: 28 } as any,
  centerIcon: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
});

// ─── Search Components ───────────────────────────────────────────────────────

function SearchModal({ stars, planets, constellationLabels, starPositions, planetPositions, moon, sun, deepSky, onSelect, onClose }: {
  stars: any[]; planets: any[]; constellationLabels: any[];
  starPositions: Map<string, any>; planetPositions: Map<string, any>;
  moon: any; sun: any; deepSky: Map<string, any>;
  onSelect: (target: { name: string; azimuth: number; altitude: number }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState('');
  const { favorites } = useFavorites();

  const results = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    const items: Array<{ name: string; type: string; azimuth: number; altitude: number; isFav?: boolean }> = [];

    // Sun
    if (sun && (q === '' || 'sun'.includes(q))) {
      items.push({ name: 'Sun', type: 'Sun', azimuth: sun.azimuth, altitude: sun.altitude });
    }

    // Moon
    if (moon && (q === '' || 'moon'.includes(q))) {
      items.push({ name: 'Moon', type: 'Moon', azimuth: moon.azimuth, altitude: moon.altitude });
    }

    // Planets
    for (const p of planets) {
      const pos = planetPositions.get(p.id);
      if (pos && (q === '' || p.name.toLowerCase().includes(q))) {
        items.push({ name: p.name, type: 'Planet', azimuth: pos.azimuth, altitude: pos.altitude });
      }
    }

    // Deep sky objects
    if (deepSky) {
      for (const dso of deepSky.values()) {
        if (!dso.isVisible) continue;
        // Display as "M6 — Butterfly Cluster" or just "M93" if no common name
        const displayName = dso.object.name
          ? `${dso.object.id} — ${dso.object.name}`
          : dso.object.id;
        if (q === '' ? dso.object.magnitude < 6 : displayName.toLowerCase().includes(q) || dso.object.id.toLowerCase().includes(q)) {
          items.push({ name: displayName, type: dso.object.type, azimuth: dso.azimuth, altitude: dso.altitude });
        }
      }
    }

    // Named stars (bright ones by default, all when searching)
    for (const star of stars) {
      if (star.name && (q === '' ? star.magnitude < 2.0 : star.name.toLowerCase().includes(q))) {
        const pos = starPositions.get(star.id);
        if (pos) items.push({ name: star.name, type: 'Star', azimuth: pos.azimuth, altitude: pos.altitude });
      }
    }

    // Constellations
    for (const c of constellationLabels) {
      if (q === '' || c.name.toLowerCase().includes(q)) {
        items.push({ name: c.name, type: 'Constellation', azimuth: c.pos.azimuth, altitude: c.pos.altitude });
      }
    }

    return items.slice(0, 30);
  }, [query, stars, planets, constellationLabels, moon, sun, deepSky]);

  // Build favorites that are currently in the sky (have live positions)
  const favResults = React.useMemo(() => {
    if (favorites.length === 0) return [];
    const favItems: Array<{ name: string; type: string; azimuth: number; altitude: number; isFav: boolean }> = [];
    const favNames = new Set(favorites.map(f => f.name.toLowerCase()));

    // Check planets
    for (const p of planets) {
      if (favNames.has(p.name.toLowerCase())) {
        const pos = planetPositions.get(p.id);
        if (pos) favItems.push({ name: p.name, type: 'Planet', azimuth: pos.azimuth, altitude: pos.altitude, isFav: true });
      }
    }

    // Check sun/moon
    if (sun && favNames.has('sun')) {
      favItems.push({ name: 'Sun', type: 'Sun', azimuth: sun.azimuth, altitude: sun.altitude, isFav: true });
    }
    if (moon && favNames.has('moon')) {
      favItems.push({ name: 'Moon', type: 'Moon', azimuth: moon.azimuth, altitude: moon.altitude, isFav: true });
    }

    // Check deep sky
    if (deepSky) {
      for (const dso of deepSky.values()) {
        const name = dso.object.name || dso.object.id;
        if (favNames.has(name.toLowerCase())) {
          favItems.push({ name, type: dso.object.type, azimuth: dso.azimuth, altitude: dso.altitude, isFav: true });
        }
      }
    }

    // Check stars
    for (const star of stars) {
      if (star.name && favNames.has(star.name.toLowerCase())) {
        const pos = starPositions.get(star.id);
        if (pos) favItems.push({ name: star.name, type: 'Star', azimuth: pos.azimuth, altitude: pos.altitude, isFav: true });
      }
    }

    // Check constellations
    for (const c of constellationLabels) {
      if (favNames.has(c.name.toLowerCase())) {
        favItems.push({ name: c.name, type: 'Constellation', azimuth: c.pos.azimuth, altitude: c.pos.altitude, isFav: true });
      }
    }

    // Also include favorites that aren't currently visible (no position) so user knows they're saved
    for (const fav of favorites) {
      if (!favItems.some(fi => fi.name.toLowerCase() === fav.name.toLowerCase())) {
        favItems.push({ name: fav.name, type: fav.type, azimuth: 0, altitude: -90, isFav: true });
      }
    }

    return favItems;
  }, [favorites, planets, planetPositions, moon, sun, deepSky, stars, starPositions, constellationLabels]);

  // Filter favorites by query too
  const filteredFavs = React.useMemo(() => {
    if (query.trim() === '') return favResults;
    const q = query.toLowerCase().trim();
    return favResults.filter(f => f.name.toLowerCase().includes(q));
  }, [favResults, query]);

  // Remove favorites from main results to avoid duplicates
  const filteredResults = React.useMemo(() => {
    const favNameSet = new Set(filteredFavs.map(f => f.name.toLowerCase()));
    return results.filter(r => !favNameSet.has(r.name.toLowerCase()));
  }, [results, filteredFavs]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={searchStyles.overlay}>
        <View style={searchStyles.container}>
          <View style={searchStyles.header}>
            <TextInput
              style={searchStyles.input}
              placeholder="Search stars, planets, constellations..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <TouchableOpacity onPress={onClose} style={searchStyles.cancelBtn}>
              <Text style={searchStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={[
              ...(filteredFavs.length > 0 ? [{ __section: 'favorites' } as any] : []),
              ...filteredFavs,
              ...(filteredFavs.length > 0 && filteredResults.length > 0 ? [{ __section: 'suggestions' } as any] : []),
              ...filteredResults,
            ]}
            keyExtractor={(item, i) => item.__section ? `section-${item.__section}` : `${item.name}-${i}`}
            renderItem={({ item }) => {
              // Section headers
              if (item.__section) {
                return (
                  <View style={searchStyles.sectionHeader}>
                    {item.__section === 'favorites' && <Heart size={14} color="#ef4444" variant="Bold" />}
                    <Text style={searchStyles.sectionTitle}>
                      {item.__section === 'favorites' ? 'Favorites' : 'Suggestions'}
                    </Text>
                  </View>
                );
              }
              const belowHorizon = item.altitude < 0;
              return (
                <TouchableOpacity
                  style={[searchStyles.resultRow, belowHorizon && { opacity: 0.45 }]}
                  onPress={() => !belowHorizon && onSelect(item)}
                  disabled={belowHorizon}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    {item.isFav && <Heart size={14} color="#ef4444" variant="Bold" />}
                    <View style={{ flex: 1 }}>
                      <Text style={searchStyles.resultName}>{item.name}</Text>
                      <Text style={searchStyles.resultType}>
                        {item.type} · {belowHorizon ? 'Below horizon' : `Alt ${item.altitude.toFixed(0)}°`}
                      </Text>
                    </View>
                  </View>
                  {!belowHorizon && <Text style={searchStyles.arrow}>→</Text>}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={query.length > 0 ? (
              <Text style={searchStyles.empty}>No results found</Text>
            ) : (
              <Text style={searchStyles.empty}>Type to search the sky</Text>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

function SearchReticle({ target, viewCenter, projectRef, onCancel, pointingRef, arMode, manualPosRef }: {
  target: { name: string; azimuth: number; altitude: number };
  viewCenter: { azimuth: number; altitude: number };
  projectRef: React.MutableRefObject<any>;
  onCancel: () => void;
  pointingRef?: React.MutableRefObject<{ azimuth: number; altitude: number; quaternion: [number, number, number, number]; ready: boolean }>;
  arMode?: boolean;
  manualPosRef?: React.MutableRefObject<{ azimuth: number; altitude: number }>;
}) {
  const pulseAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  // Live center position — updated at ~30fps from refs for responsive tracking
  const [liveCenter, setLiveCenter] = React.useState(viewCenter);

  React.useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ])).start();
  }, []);

  // Poll the live pointing ref at ~30fps so the reticle responds in real-time
  React.useEffect(() => {
    let frameId: number;
    let lastUpdate = 0;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      const now = Date.now();
      if (now - lastUpdate < 33) return; // ~30fps
      lastUpdate = now;
      if (arMode && pointingRef && pointingRef.current.ready) {
        setLiveCenter({ azimuth: pointingRef.current.azimuth, altitude: pointingRef.current.altitude });
      } else if (!arMode && manualPosRef) {
        setLiveCenter({ azimuth: manualPosRef.current.azimuth, altitude: manualPosRef.current.altitude });
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [arMode, pointingRef, manualPosRef]);

  // Angular distance from view center to target
  let dAz = target.azimuth - liveCenter.azimuth;
  if (dAz > 180) dAz -= 360;
  if (dAz < -180) dAz += 360;
  const dAlt = target.altitude - liveCenter.altitude;
  const angularDist = Math.sqrt(dAz * dAz + dAlt * dAlt);
  const isFound = angularDist < 3;

  // Smoothly animate circle scale (base size is 240, scale 0.25–1.0)
  const targetScale = isFound ? 0.25 : Math.max(0.25, Math.min(1.0, angularDist / 60));
  React.useEffect(() => {
    Animated.spring(scaleAnim, { toValue: targetScale, friction: 12, tension: 40, useNativeDriver: true }).start();
  }, [Math.round(targetScale * 20)]);

  // Direction angle (radians) from center to target
  const dirAngle = Math.atan2(-dAlt, dAz);
  const dynamicRadius = targetScale * 120; // visual radius for arrow positioning
  const arrowX = Math.cos(dirAngle) * dynamicRadius;
  const arrowY = Math.sin(dirAngle) * dynamicRadius;
  const arrowRotation = (dirAngle * 180 / Math.PI) + 90;

  // Compute where the target dot should appear
  const scale = dynamicRadius / 30;
  const dotX = W / 2 + dAz * scale;
  const dotY = H / 2 - dAlt * scale;
  const dotInCircle = Math.sqrt((dotX - W / 2) ** 2 + (dotY - H / 2) ** 2) < dynamicRadius;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Large centered viewfinder circle */}
      <View style={searchStyles.viewfinder}>
        <Animated.View style={[searchStyles.circle, {
          borderColor: isFound ? '#4ade80' : 'rgba(255,255,255,0.35)',
          transform: [
            { scale: Animated.multiply(scaleAnim, pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] })) },
          ],
        }]}>
          {/* Degree text in center */}
          <Text style={[searchStyles.degreeText, isFound && { color: '#4ade80' }]}>
            {isFound ? '✓' : `${Math.round(angularDist)}°`}
          </Text>
        </Animated.View>

        {/* Target dot — moves within the circle as you get closer */}
        {dotInCircle && !isFound && (
          <View style={[searchStyles.targetDot, { left: dotX - 6, top: dotY - 6 }]} />
        )}

        {/* Crosshair lines */}
        <View style={searchStyles.crossH} />
        <View style={searchStyles.crossV} />

        {/* Direction arrow on circle edge — points toward target */}
        {!isFound && angularDist > 5 && (
          <View style={[searchStyles.arrowWrap, {
            transform: [
              { translateX: arrowX },
              { translateY: arrowY },
              { rotate: `${arrowRotation}deg` },
            ],
          }]}>
            <View style={searchStyles.arrowTriangle} />
          </View>
        )}
      </View>

      {/* Top info bar */}
      <View style={searchStyles.reticleHeader}>
        <View style={searchStyles.targetPill}>
          <Text style={searchStyles.targetName}>{target.name}</Text>
          <Text style={searchStyles.targetDist}>
            {isFound ? 'Object found' : `${Math.round(angularDist)}° away`}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={searchStyles.reticleCancel}>
          <Text style={searchStyles.reticleCancelText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Found banner */}
      {isFound && (
        <View style={searchStyles.foundBanner}>
          <Text style={searchStyles.foundText}>✓ {target.name}</Text>
        </View>
      )}
    </View>
  );
}

const searchStyles = StyleSheet.create({
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(3,3,8,0.95)' },
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, fontFamily: 'Poppins-Regular', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 4 },
  cancelText: { color: '#d4c5a0', fontSize: 14, fontFamily: 'Poppins-Bold' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  resultName: { color: '#fff', fontSize: 15, fontFamily: 'Poppins-Regular' },
  resultType: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'Poppins-Light', marginTop: 2 },
  arrow: { color: '#d4c5a0', fontSize: 18 },
  empty: { color: 'rgba(255,255,255,0.3)', fontSize: 14, textAlign: 'center', marginTop: 40, fontFamily: 'Poppins-Light' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Poppins-Bold', letterSpacing: 1, textTransform: 'uppercase' },

  // Reticle — centered viewfinder
  viewfinder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  circle: { width: 240, height: 240, borderRadius: 120, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  degreeText: { color: 'rgba(255,255,255,0.6)', fontSize: 28, fontWeight: '300', fontFamily: 'Poppins-Light' },
  targetDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#d4c5a0', shadowColor: '#d4c5a0', shadowOpacity: 0.8, shadowRadius: 4 },
  crossH: { position: 'absolute', width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  crossV: { position: 'absolute', width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  arrowWrap: { position: 'absolute' },
  arrowTriangle: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#d4c5a0' },
  reticleHeader: { position: 'absolute', top: 110, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetPill: { backgroundColor: 'rgba(10,10,20,0.8)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,197,160,0.3)' },
  targetName: { color: '#d4c5a0', fontSize: 13, fontFamily: 'Poppins-Bold' },
  targetDist: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Poppins-Light', marginTop: 2 },
  reticleCancel: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  reticleCancelText: { color: '#fff', fontSize: 16 },
  foundBanner: { position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center' },
  foundText: { color: '#4ade80', fontSize: 16, fontFamily: 'Poppins-Bold', backgroundColor: 'rgba(74,222,128,0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, overflow: 'hidden' },
});

// ─── Auth Gate ───────────────────────────────────────────────────────────────

function AuthGate() {
  const { user, loading, passwordRecovery } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  // Check if onboarding was already seen (persisted locally)
  useEffect(() => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.getItem('onboarding_seen').then((val: string | null) => {
      setOnboardingSeen(val === 'true');
    }).catch(() => setOnboardingSeen(false));
  }, []);

  useEffect(() => {
    if (!user) { setOnboardingDone(null); return; }
    // Check if onboarding is complete
    setCheckingProfile(true);
    (async () => {
      try {
        const { data, error } = await authSupabase
          .from('user_profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          setOnboardingDone(false);
        } else {
          setOnboardingDone(data?.onboarding_complete === true);
        }
      } catch (e: any) {
        setOnboardingDone(false);
      } finally {
        setCheckingProfile(false);
      }
    })();
  }, [user?.id]);

  const markOnboardingSeen = async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('onboarding_seen', 'true');
    setOnboardingSeen(true);
    setOnboardingDone(true);
  };

  // Show branded loading screen
  if (loading || onboardingSeen === null || (user && onboardingDone === null && checkingProfile)) {
    return (
      <View style={s.center}>
        <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#fff', padding: 10, justifyContent: 'center', alignItems: 'center' }}>
          <Image source={require('./assets/pie-logo.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
        </View>
        <ActivityIndicator size="small" color="#d4c5a0" style={{ marginTop: 16 }} />
      </View>
    );
  }
  // Password recovery flow
  if (passwordRecovery && user) return <ResetPasswordScreen />;
  // First time — show onboarding (includes sign-up)
  if (!onboardingSeen) return <OnboardingScreen onComplete={markOnboardingSeen} />;
  // Onboarding done but no session — show sign-in only
  if (!user) {
    const LoginScreen = require('./src/auth/LoginScreen').default;
    return <LoginScreen />;
  }
  // Signed in but profile not set up — show onboarding again (for social sign-in users)
  if (onboardingDone === false) return <OnboardingScreen onComplete={markOnboardingSeen} />;
  return <AppContent />;
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      'Poppins-Light': require('./assets/fonts/Poppins-Light.ttf'),
      'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
      'Poppins-Medium': require('./assets/fonts/Poppins-Medium.ttf'),
      'Poppins-SemiBold': require('./assets/fonts/Poppins-SemiBold.ttf'),
      'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
      'Poppins-ExtraBold': require('./assets/fonts/Poppins-ExtraBold.ttf'),
      'Poppins-Black': require('./assets/fonts/Poppins-Black.ttf'),
    }).then(() => setFontsLoaded(true)).catch(() => setFontsLoaded(true));
  }, []);

  // App Tracking Transparency — present Apple's ATT prompt once, on first
  // launch, after the UI is up (iOS only). Required because the app declares
  // NSUserTrackingUsageDescription; without this call the system dialog never
  // appears, which is what App Review flags. We only ask while the status is
  // still "undetermined" so we never nag a user who already chose.
  useEffect(() => {
    if (!fontsLoaded || Platform.OS !== 'ios') return;
    let cancelled = false;
    (async () => {
      try {
        const { status, canAskAgain } = await getTrackingPermissionsAsync();
        if (cancelled || status !== 'undetermined' || !canAskAgain) return;
        // Small delay so it doesn't collide with app launch / other prompts.
        await new Promise((r) => setTimeout(r, 1000));
        if (cancelled) return;
        await requestTrackingPermissionsAsync();
      } catch {
        // Non-fatal — tracking simply stays disabled if the request fails.
      }
    })();
    return () => { cancelled = true; };
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={s.center}>
        <Star1 size={48} color="#d4c5a0" variant="Bulk" />
        <ActivityIndicator size="small" color="#d4c5a0" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ContentProvider>
          <FavoritesProvider>
            <AuthGate />
          </FavoritesProvider>
        </ContentProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Error boundary to catch crashes and show something instead of blank screen
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error) {
    console.error('[App Crash]', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#030308', justifyContent: 'center', alignItems: 'center', padding: 30 }}>
          <Text style={{ color: '#ff6666', fontSize: 16, fontWeight: '700', marginBottom: 10 }}>Something went wrong</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' }}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000011' },
  center: { flex: 1, backgroundColor: '#000011', justifyContent: 'center', alignItems: 'center' },
  loadSub: { color: '#888', fontSize: 15, marginTop: 12 },
  err: { color: '#f66', fontSize: 15, padding: 20, textAlign: 'center' },

  // Logo
  logo: { position: 'absolute', bottom: 95, left: 14, width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },

  // Top bar
  topBar: { position: 'absolute', top: 54, left: 14, right: 14, flexDirection: 'row', alignItems: 'center' },
  topBarCenter: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19 },
  backBtnInner: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },

  // Calibrating toast
  calibToast: { position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' },
  calibToastText: { color: '#d4c5a0', fontSize: 13, fontFamily: 'Poppins-Regular', backgroundColor: 'rgba(10,10,20,0.85)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,197,160,0.2)' },

  // Compass alignment hint (shown briefly when the sky view opens)
  compassPulse: {
    position: 'absolute', top: 0, left: 0, width: 38, height: 38, borderRadius: 19,
    borderWidth: 2, borderColor: '#d4c5a0', backgroundColor: 'rgba(212,197,160,0.18)',
  },
  compassHint: {
    position: 'absolute', top: 100, right: 14, maxWidth: 230,
    backgroundColor: 'rgba(10,10,20,0.88)', paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,197,160,0.3)',
  },
  compassHintText: { color: '#d4c5a0', fontSize: 12.5, fontFamily: 'Poppins-Regular', textAlign: 'right' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 5 },
  pillBold: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Poppins-Bold' },
  pillLight: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Poppins-Light' },
  pillDim: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'Poppins-Light' },
  loadingPill: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },
  // Center viewfinder / target reticle
  reticleWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  reticleBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  reticleRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  reticleDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.9)' },
  reticleTick: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)' },
  reticleTickTop: { width: 1.5, height: 6, top: 1, left: 23.25 },
  reticleTickBottom: { width: 1.5, height: 6, bottom: 1, left: 23.25 },
  reticleTickLeft: { width: 6, height: 1.5, left: 1, top: 23.25 },
  reticleTickRight: { width: 6, height: 1.5, right: 1, top: 23.25 },
  modePill: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  modePillManual: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)' },
  modeText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700' },
  exposureBanner: { position: 'absolute', top: 120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' },
  exposureDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  exposureText: { color: '#22c55e', fontSize: 12, fontWeight: '700', fontFamily: 'Poppins-SemiBold' },
  exposureRow: { flexDirection: 'row', alignItems: 'center' },

  // "Motion access off" banner — shown on the sky view when DeviceMotion is
  // unavailable / denied. Compact, top-of-screen, dismissable.
  motionPrompt: { position: 'absolute', top: 60, left: 12, right: 12 },
  motionPromptInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(8,10,18,0.92)',
    borderColor: 'rgba(251,191,36,0.45)', borderWidth: 1, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  motionPromptTitle: { color: '#fbbf24', fontSize: 12, fontWeight: '800', fontFamily: 'Poppins-Bold' },
  motionPromptBody: { color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 14, marginTop: 2 },
  motionPromptBtn: {
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderColor: 'rgba(251,191,36,0.5)', borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  motionPromptBtnText: { color: '#fbbf24', fontSize: 11, fontWeight: '700' },
  motionPromptDismiss: { padding: 4, marginLeft: 2 },
  motionPromptDismissText: { color: 'rgba(255,255,255,0.5)', fontSize: 18, lineHeight: 18, fontWeight: '600' },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomBarInner: { paddingBottom: 34, paddingTop: 10, paddingHorizontal: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  infoGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoVal: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', fontFamily: 'Poppins-Regular' },
  infoSub: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: 'Poppins-Light' },

  // FAB
  fab: { position: 'absolute', right: 12, bottom: 110, gap: 10 },
  fabBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(10,10,20,0.7)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  fabActive: { backgroundColor: 'rgba(20,20,40,0.8)', borderColor: 'rgba(255,255,255,0.2)' },
  fabRed: { backgroundColor: 'rgba(40,0,0,0.8)', borderColor: 'rgba(255,68,68,0.4)' },
});
