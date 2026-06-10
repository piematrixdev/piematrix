/**
 * useSkyEngine — manages the sky calculator lifecycle, star loading,
 * time travel, and all celestial position refs.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  GeographicCoordinates, Star, Planet, HorizontalCoordinates,
  createSkyCalculator, createPlanetCalculator,
  SkyPositions,
  createDeepSkyCatalog, DeepSkyPosition,
  createSatelliteTracker, SatellitePosition, SatelliteTrackerError,
  createMeteorShowerCatalog, MeteorShowerPosition,
  MoonPosition, SunPosition,
  calculateLST,
} from '@virtual-window/astronomy-engine';
import * as Location from 'expo-location';
import { loadStarsProgressively, loadStarsForZoom, loadStarsForMagnitude } from '../stars';
import { getConstellationLines, getConstellationLabels, ConstellationSegment } from '../constellations';
import { getConstellationArt, ProjectedArt } from '../constellationArt';
import { getEquatorialGrid, GridLine } from '../grids';
import { fetchSatelliteTLEs } from '../satellites';
import { getMilkyWayBand, MilkyWayPoint } from '../milkyway';

function sortStarsByMagnitude(stars: Star[]): number[] {
  return stars.map((_, i) => i).sort((a, b) => stars[a].magnitude - stars[b].magnitude);
}

export interface SkyEngineState {
  ready: boolean;
  loadMsg: string;
  error: string | null;
  loadingStars: boolean;
  skyVer: number;
  isRealTime: boolean;
  displayTime: Date;
}

export interface SkyEngineRefs {
  stars: React.MutableRefObject<Star[]>;
  sortedIdx: React.MutableRefObject<number[]>;
  planets: React.MutableRefObject<Planet[]>;
  starPositions: React.MutableRefObject<Map<string, HorizontalCoordinates>>;
  planetPositions: React.MutableRefObject<Map<string, HorizontalCoordinates>>;
  moon: React.MutableRefObject<MoonPosition | null>;
  sun: React.MutableRefObject<SunPosition | null>;
  constellationSegments: React.MutableRefObject<ConstellationSegment[]>;
  constellationLabels: React.MutableRefObject<Array<{ id: string; name: string; pos: HorizontalCoordinates }>>;
  constellationArt: React.MutableRefObject<ProjectedArt[]>;
  coords: React.MutableRefObject<GeographicCoordinates>;
  lst: React.MutableRefObject<number>;
  deepSky: React.MutableRefObject<Map<string, DeepSkyPosition>>;
  satellites: React.MutableRefObject<Map<string, SatellitePosition | SatelliteTrackerError>>;
  /** Next-second prediction for satellites — used by the renderer for smooth interpolation. */
  satellitesNext: React.MutableRefObject<Map<string, SatellitePosition | SatelliteTrackerError>>;
  /** Timestamps {prev, next} for the satellite snapshots, for interpolation. */
  satellitesTime: React.MutableRefObject<{ prev: number; next: number }>;
  meteors: React.MutableRefObject<Map<string, MeteorShowerPosition>>;
  calc: React.MutableRefObject<any>;
}

export interface SkyEngineActions {
  goToTime: (date: Date) => void;
  goLive: () => void;
  adjustHours: (hours: number) => void;
  adjustDays: (days: number) => void;
  loadStarsForCurrentZoom: (fov: number) => void;
}

export function useSkyEngine(bortle: number) {
  const [ready, setReady] = useState(false);
  const [loadMsg, setLoadMsg] = useState('Initializing…');
  const [error, setError] = useState<string | null>(null);
  const [loadingStars, setLoadingStars] = useState(false);
  const [skyVer, setSkyVer] = useState(0);
  const skyVerRef = useRef(0);
  const lastSkyEmit = useRef(0);

  const [isRealTime, setIsRealTime] = useState(true);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [displayTime, setDisplayTime] = useState(new Date());
  // Live mirror of displayTime for the isolated LiveClock readout (no re-render).
  const displayTimeRef = useRef(new Date());

  // Celestial data refs (mutated by calculator callback, read by renderer)
  const starsRef = useRef<Star[]>([]);
  const sortedIdxRef = useRef<number[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const starPosRef = useRef<Map<string, HorizontalCoordinates>>(new Map());
  const planetPosRef = useRef<Map<string, HorizontalCoordinates>>(new Map());
  const moonRef = useRef<MoonPosition | null>(null);
  const sunRef = useRef<SunPosition | null>(null);
  const constRef = useRef<ConstellationSegment[]>([]);
  const constLabelsRef = useRef<Array<{ id: string; name: string; pos: HorizontalCoordinates }>>([]);
  const constArtRef = useRef<ProjectedArt[]>([]);
  const coordsRef = useRef<GeographicCoordinates>({ latitude: 0, longitude: 0 });
  const lstRef = useRef(0);
  const deepSkyRef = useRef<Map<string, DeepSkyPosition>>(new Map());
  const satRef = useRef<Map<string, SatellitePosition | SatelliteTrackerError>>(new Map());
  const satNextRef = useRef<Map<string, SatellitePosition | SatelliteTrackerError>>(new Map());
  const satTimeRef = useRef<{ prev: number; next: number }>({ prev: 0, next: 0 });
  const meteorRef = useRef<Map<string, MeteorShowerPosition>>(new Map());
  const calcRef = useRef<any>(null);
  const satTrackerRef = useRef<any>(null);
  const lastConstUpdate = useRef(0);
  const lastEqGridUpdate = useRef(0);

  const limMag = ({
    1: 7.6, 2: 7.1, 3: 6.6, 4: 6.2, 5: 5.6, 6: 5.1, 7: 4.6, 8: 4.1, 9: 3.5,
  } as Record<number, number>)[bortle] ?? 5.6;

  // --- Initialize sky engine ---
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        setLoadMsg('Getting location…');
        let coords: GeographicCoordinates = { latitude: 0, longitude: 0 };
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
        coordsRef.current = coords;

        setLoadMsg('Calculating planets…');
        const pc = createPlanetCalculator();
        planetsRef.current = pc.calculatePlanetPositions(new Date(), coords);

        setLoadMsg('Loading catalogs…');
        const dsc = createDeepSkyCatalog();
        dsc.setConfig({ maxMagnitude: 12 });
        const sat = createSatelliteTracker();
        await sat.loadDefaultISS();

        /**
         * Compute satellite positions for two consecutive moments — "now"
         * and "now + 1s" — and store them in satRef / satNextRef. The
         * renderer interpolates between these snapshots every frame to
         * produce smooth motion without recomputing SGP4 at 60Hz.
         */
        const SAT_TICK_MS = 1000;
        const updateSatelliteSnapshots = () => {
          const tracker = satTrackerRef.current;
          const sunPos = sunRef.current;
          if (!tracker || !sunPos) return;
          const tPrev = Date.now();
          const tNext = tPrev + SAT_TICK_MS;
          const prev = tracker.calculateAll(new Date(tPrev), coordsRef.current, sunPos);
          const next = tracker.calculateAll(new Date(tNext), coordsRef.current, sunPos);
          if (prev && prev.size > 0) {
            // Mutate in place — see comment in onPositionsUpdate below.
            satRef.current.clear();
            for (const [k, v] of prev) satRef.current.set(k, v);
          }
          if (next && next.size > 0) {
            satNextRef.current.clear();
            for (const [k, v] of next) satNextRef.current.set(k, v);
          }
          satTimeRef.current = { prev: tPrev, next: tNext };
        };

        // Load real-time satellite TLEs from CelesTrak (non-blocking).
        // As soon as TLEs arrive, compute positions immediately so satellites
        // appear without waiting for the next 1s satInterval tick.
        fetchSatelliteTLEs().then((tles) => {
          for (const tle of tles) {
            sat.setTLE(tle.name, {
              name: tle.name,
              line1: tle.line1,
              line2: tle.line2,
              fetchedAt: new Date(),
            });
          }
          // Eager first computation — runs the moment TLEs are loaded
          // (provided sun position is also ready).
          if (!disposed && sunRef.current) {
            updateSatelliteSnapshots();
          }
        }).catch(() => {});

        setLoadMsg('Starting sky engine…');
        const calc = createSkyCalculator({
          observer: coords,
          onPositionsUpdate: (pos: SkyPositions) => {
            if (disposed) return;
            lstRef.current = pos.lst;
            starPosRef.current = pos.starPositions;
            planetPosRef.current = pos.planetPositions;
            moonRef.current = pos.moonPosition;
            sunRef.current = pos.sunPosition;
            const ts = Date.now();
            // Constellation LABEL positions are the only thing here the app
            // actually consumes (tap detection + search). The renderer draws
            // constellation lines/art and the Milky Way from its own bundled
            // data, rotating them on the GPU — so recomputing lines/art/milkyway
            // here is wasted CPU that was stalling the GL loop every 15–30s.
            // The sky drifts only ~0.25°/min, so labels every 60s is plenty.
            if (ts - lastConstUpdate.current > 60000) {
              lastConstUpdate.current = ts;
              constLabelsRef.current = getConstellationLabels(coordsRef.current, pos.lst);
            }
            if (pos.deepSkyPositions) deepSkyRef.current = pos.deepSkyPositions;
            // Note: we deliberately ignore pos.satellitePositions here — the
            // satInterval below is the single source of truth for satellites
            // and feeds both satRef (now) and satNextRef (now + 1s) for the
            // renderer's per-frame interpolation. Letting the calc also write
            // to satRef would desync the prev/next pair.
            if (pos.meteorShowerRadiants) meteorRef.current = pos.meteorShowerRadiants;
            const now = Date.now();
            // Always emit immediately for time-travel; throttle only in real-time
            const shouldEmit = !calcRef.current?.isRealTime() || (now - lastSkyEmit.current > 5000);
            if (shouldEmit) {
              lastSkyEmit.current = now;
              skyVerRef.current++;
              setSkyVer(skyVerRef.current);
            }
          },
        });
        calc.setPlanets(planetsRef.current);
        calc.startUpdates();
        calcRef.current = calc;
        satTrackerRef.current = sat;

        // Compute satellite snapshot pair (now + now+1s) every 1 second.
        // The renderer interpolates between them every frame for smooth motion.
        const satInterval = setInterval(() => {
          if (disposed || !satTrackerRef.current) return;
          updateSatelliteSnapshots();
        }, 1000);
        // Backup compute in case TLE fetch took longer than 3s — won't
        // duplicate work if the eager path already ran.
        setTimeout(() => {
          if (disposed) return;
          updateSatelliteSnapshots();
        }, 3000);

        const initLst = calculateLST(coords.longitude, new Date());
        constRef.current = getConstellationLines(coords, initLst);
        constLabelsRef.current = getConstellationLabels(coords, initLst);
        constArtRef.current = getConstellationArt();
        lastConstUpdate.current = Date.now();
        lastEqGridUpdate.current = Date.now();

        setReady(true);

        loadStarsProgressively((stars, phase) => {
          if (disposed) return;
          // Easter egg: inject a hidden star dedicated to the developer
          const easterEggStar = {
            id: 'PIE-001',
            name: 'Raagavi Shrivastava',
            ra: 15.1,   // RA in hours — a quiet corner of Libra
            dec: -19.0, // Dec in degrees — inside Libra's boundary
            magnitude: 3.8,  // Subtle — visible but blends in, not obvious
            spectralType: 'M',  // Warm golden color
          };
          stars = stars.filter(s => s.id !== 'PIE-001');
          stars.push(easterEggStar as any);
          starsRef.current = stars;
          sortedIdxRef.current = sortStarsByMagnitude(stars);
          calc.setStars(stars);
          setLoadMsg(phase);
        });

        return () => { disposed = true; calc.dispose(); };
      } catch (e: any) {
        setError(e.message ?? 'Init failed');
      }
    })();
  }, []);

  // --- Load stars when Bortle changes ---
  useEffect(() => {
    setLoadingStars(true);
    loadStarsForMagnitude(limMag, (stars, phase) => {
      // Always keep the easter egg star
      stars = stars.filter(s => s.id !== 'PIE-001');
      stars.push({ id: 'PIE-001', name: 'Raagavi Shrivastava', ra: 15.1, dec: -19.0, magnitude: 3.8, spectralType: 'M' } as any);
      starsRef.current = stars;
      sortedIdxRef.current = sortStarsByMagnitude(stars);
      calcRef.current?.setStars(stars);
      setLoadMsg(phase);
      setLoadingStars(false);
    }).then(() => setLoadingStars(false));
  }, [limMag]);

  // --- Display time tick (real-time mode only) ---
  // Update the REF only — no setState, so AppContent never re-renders on the
  // 1s tick. The isolated <LiveClock> reads displayTimeRef on its own interval.
  useEffect(() => {
    if (!isRealTime) return;
    displayTimeRef.current = new Date();
    const interval = setInterval(() => { displayTimeRef.current = new Date(); }, 1000);
    return () => clearInterval(interval);
  }, [isRealTime]);

  // --- Time travel actions ---
  const goToTime = useCallback((date: Date) => {
    setSelectedTime(date);
    setDisplayTime(date);
    displayTimeRef.current = date;
    setIsRealTime(false);
    calcRef.current?.setTime(date);
    lastConstUpdate.current = 0;
    // Force immediate re-render — setTime → recalculate already updated sunRef
    skyVerRef.current++;
    setSkyVer(skyVerRef.current);
  }, []);

  const goLive = useCallback(() => {
    setIsRealTime(true);
    setSelectedTime(new Date());
    setDisplayTime(new Date());
    displayTimeRef.current = new Date();
    calcRef.current?.setRealTime();
    lastConstUpdate.current = 0;
  }, []);

  const adjustHours = useCallback((hours: number) => {
    setSelectedTime(prev => {
      const newTime = new Date(prev.getTime() + hours * 3600000);
      goToTime(newTime);
      return newTime;
    });
  }, [goToTime]);

  const adjustDays = useCallback((days: number) => {
    setSelectedTime(prev => {
      const newTime = new Date(prev.getTime() + days * 86400000);
      goToTime(newTime);
      return newTime;
    });
  }, [goToTime]);

  const loadStarsForCurrentZoom = useCallback((fov: number) => {
    setLoadingStars(true);
    loadStarsForZoom(fov, (stars, phase) => {
      stars = stars.filter(s => s.id !== 'PIE-001');
      stars.push({ id: 'PIE-001', name: 'Raagavi Shrivastava', ra: 15.1, dec: -19.0, magnitude: 3.8, spectralType: 'M' } as any);
      starsRef.current = stars;
      sortedIdxRef.current = sortStarsByMagnitude(stars);
      calcRef.current?.setStars(stars);
      setLoadMsg(phase);
      setLoadingStars(false);
    }).then(() => setLoadingStars(false));
  }, []);

  return {
    state: { ready, loadMsg, error, loadingStars, skyVer, isRealTime, displayTime },
    refs: {
      stars: starsRef,
      sortedIdx: sortedIdxRef,
      planets: planetsRef,
      starPositions: starPosRef,
      planetPositions: planetPosRef,
      moon: moonRef,
      sun: sunRef,
      constellationSegments: constRef,
      constellationLabels: constLabelsRef,
      constellationArt: constArtRef,
      coords: coordsRef,
      lst: lstRef,
      deepSky: deepSkyRef,
      satellites: satRef,
      satellitesNext: satNextRef,
      satellitesTime: satTimeRef,
      meteors: meteorRef,
      calc: calcRef,
      displayTime: displayTimeRef,
    },
    actions: { goToTime, goLive, adjustHours, adjustDays, loadStarsForCurrentZoom },
  };
}
