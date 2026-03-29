import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import {
  GeographicCoordinates,
  Star,
  Planet,
  createSkyCalculator,
  createPlanetCalculator,
  SkyPositions,
  createHorizonLine,
  HorizonPoint,
  MoonPosition,
  SunPosition,
  Constellation,
  createDeepSkyCatalog,
  DeepSkyPosition,
  createSatelliteTracker,
  SatellitePosition,
  SatelliteTrackerError,
  createMeteorShowerCatalog,
  MeteorShowerPosition,
  calculateLST,
} from '@virtual-window/astronomy-engine';
import { getSunPosition, getMoonPosition, getISSPosition, getVisibleSatellites, getActiveMeteorShowers, getISSPasses, getPeopleInSpace, MeteorShowerData, SatellitePass } from '../src/services/celestial-service';
import { WebGeolocationService, LocationStatus } from '../src/services/geolocation-service';
import { isWebGLAvailable } from '../src/components/SkyView2D';
import { fetchConstellationsWithStars } from '../src/services/astronomy-api';
import { supabase } from '../src/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { Building, Star1, Calendar, Clock, ArrowLeft2, ArrowRight2, Refresh, User as UserIcon, Lock1, Pause, Play, Global, Refresh2, Location, SearchNormal1, Gps, InfoCircle, Moon, Sun, Discover, Radar, Magicpen, Grid1, Eye, Text } from 'iconsax-react';

// Dynamic imports for Three.js components (client-side only)
const SkyDome = dynamic(() => import('../src/components/SkyDome'), { ssr: false });
const SkyView2D = dynamic(() => import('../src/components/SkyView2D'), { ssr: false });
const AuthPanel = dynamic(() => import('../src/components/AuthPanel'), { ssr: false });
const ObjectDetailPanel = dynamic(() => import('../src/components/ObjectDetailPanel'), { ssr: false });

interface AppState {
  observer: GeographicCoordinates | null;
  locationStatus: LocationStatus;
  locationName: string | null;
  stars: Star[];
  planets: Planet[];
  fov: number;
  isLoading: boolean;
  error: string | null;
  isRealTime: boolean;
  currentTime: Date;
  useWebGL: boolean;
  viewAzimuth: number;
  viewAltitude: number;
  horizonPoints: HorizonPoint[];
  moonPosition: MoonPosition | null;
  sunPosition: SunPosition | null;
  constellations: Constellation[];
  deepSkyPositions: Map<string, DeepSkyPosition>;
  satellitePositions: Map<string, SatellitePosition | SatelliteTrackerError>;
  meteorShowerRadiants: Map<string, MeteorShowerPosition>;
  // Display toggles
  showConstellations: boolean;
  showDeepSky: boolean;
  showSatellites: boolean;
  showMeteorShowers: boolean;
  showAllDeepSky: boolean; // Show all Messier objects regardless of horizon
  showStarLabels: boolean;
  showPlanets: boolean;
  showMoon: boolean;
  showSun: boolean;
  showAltitudeGrid: boolean;
  showAzimuthGrid: boolean;
  showEquatorialGrid: boolean;
  showAtmosphere: boolean;
  showGround: boolean;
  // Light pollution (Bortle scale 1-9)
  lightPollution: number;
  // Zoom level for progressive star loading
  zoomLevel: number; // 1 = default, 2 = 2x zoom, etc.
  maxMagnitude: number; // Maximum star magnitude to display
  // Real-time update tracking
  lastUpdateTime: Date | null;
  isUpdating: boolean;
  // User and UI state
  user: User | null;
  showAuthPanel: boolean;
  selectedObject: {
    type: 'star' | 'planet' | 'messier' | 'constellation' | 'moon' | 'sun' | 'deepsky';
    id: string;
    name: string;
    ra?: number;
    dec?: number;
    magnitude?: number;
    spectralType?: string;
    // Additional fields for specific object types
    illumination?: number;
    phaseName?: string;
    objectType?: string; // For deep sky objects (Galaxy, Nebula, etc.)
    status?: string; // For sun (daylight, twilight, night)
  } | null;
  // Progressive loading state
  loadingProgress: number; // 0-100
  totalStarsToLoad: number;
  isLoadingMoreStars: boolean; // True when loading additional stars on zoom
  currentMagnitudeLimit: number; // Current magnitude limit loaded
  // Local Sidereal Time for real-time sky rotation
  lst: number;
  // Time travel state
  showTimeSelector: boolean;
  selectedDate: Date;
  // Location selector state
  showLocationSelector: boolean;
  locationSearchQuery: string;
  locationSearchResults: Array<{ name: string; lat: number; lon: number }>;
  isSearchingLocation: boolean;
  // Credits modal
  showCredits: boolean;
  // Object search state
  showObjectSearch: boolean;
  objectSearchQuery: string;
  objectSearchResults: Array<{
    type: 'star' | 'planet' | 'constellation' | 'deepsky' | 'satellite' | 'moon' | 'sun';
    id: string;
    name: string;
    ra?: number;
    dec?: number;
    magnitude?: number;
  }>;
  highlightedObjectId: string | null;
  cameraTarget: { azimuth: number; altitude: number } | null;
  // Meteor showers and satellite passes
  activeMeteorShowers: MeteorShowerData[];
  upcomingIssPasses: SatellitePass[];
  peopleInSpace: { number: number; people: { name: string; craft: string }[] } | null;
}

const initialState: AppState = {
  observer: null,
  locationStatus: 'pending',
  locationName: null,
  stars: [],
  planets: [],
  fov: 60,
  isLoading: true,
  error: null,
  isRealTime: true,
  currentTime: new Date(),
  useWebGL: true,
  viewAzimuth: 180,
  viewAltitude: 45,
  horizonPoints: [],
  moonPosition: null,
  sunPosition: null,
  constellations: [],
  deepSkyPositions: new Map(),
  satellitePositions: new Map(),
  meteorShowerRadiants: new Map(),
  // Display toggles - default on
  showConstellations: false, // false = single animated constellation (default), true = show all
  showDeepSky: true,
  showSatellites: true,
  showMeteorShowers: true,
  showAllDeepSky: false, // Only show objects above horizon by default
  showStarLabels: true,
  showPlanets: true,
  showMoon: true,
  showSun: true,
  showAltitudeGrid: false,
  showAzimuthGrid: false,
  showEquatorialGrid: false,
  showAtmosphere: true,
  showGround: true,
  // Light pollution - default to Bortle 5 (suburban sky)
  lightPollution: 5,
  // Zoom settings
  zoomLevel: 1,
  maxMagnitude: 6, // Start with bright stars only
  // Real-time update tracking
  lastUpdateTime: null,
  isUpdating: false,
  // User and UI state
  user: null,
  showAuthPanel: false,
  selectedObject: null,
  // Progressive loading state
  loadingProgress: 0,
  totalStarsToLoad: 120000,
  isLoadingMoreStars: false,
  currentMagnitudeLimit: 6.0,
  // Local Sidereal Time
  lst: 0,
  // Time travel state
  showTimeSelector: false,
  selectedDate: new Date(),
  // Location selector state
  showLocationSelector: false,
  locationSearchQuery: '',
  locationSearchResults: [],
  isSearchingLocation: false,
  // Credits modal
  showCredits: false,
  // Object search state
  showObjectSearch: false,
  objectSearchQuery: '',
  objectSearchResults: [],
  highlightedObjectId: null,
  cameraTarget: null,
  // Meteor showers and satellite passes
  activeMeteorShowers: [],
  upcomingIssPasses: [],
  peopleInSpace: null,
};

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [mounted, setMounted] = useState(false);
  const [displayTime, setDisplayTime] = useState<Date>(new Date());
  const geolocationRef = useRef<WebGeolocationService | null>(null);
  const skyCalculatorRef = useRef<ReturnType<typeof createSkyCalculator> | null>(null);
  const horizonLineRef = useRef<ReturnType<typeof createHorizonLine> | null>(null);
  const deepSkyCatalogRef = useRef<ReturnType<typeof createDeepSkyCatalog> | null>(null);
  const satelliteTrackerRef = useRef<ReturnType<typeof createSatelliteTracker> | null>(null);
  const meteorShowerCatalogRef = useRef<ReturnType<typeof createMeteorShowerCatalog> | null>(null);
  const initializationRef = useRef<boolean>(false);
  const timeSliderThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTimeRef = useRef<Date | null>(null);
  
  // Pre-calculated position cache for smooth time slider
  // Stores positions at 15-minute intervals (96 snapshots per day)
  const positionCacheRef = useRef<{
    date: string; // YYYY-MM-DD to invalidate on date change
    observer: GeographicCoordinates | null;
    snapshots: Map<number, { // key = minutes from midnight (0-1439)
      deepSkyPositions: Map<string, DeepSkyPosition>;
      meteorShowerRadiants: Map<string, MeteorShowerPosition>;
      lst: number;
    }>;
    isBuilding: boolean;
  }>({
    date: '',
    observer: null,
    snapshots: new Map(),
    isBuilding: false,
  });

  // Fetch location name using reverse geocoding
  const fetchLocationName = useCallback(async (coords: GeographicCoordinates): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=10`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      // Extract city, state, country
      const address = data.address || {};
      const parts = [
        address.city || address.town || address.village || address.county,
        address.state,
        address.country
      ].filter(Boolean);
      
      return parts.length > 0 ? parts.join(', ') : null;
    } catch (error) {
      console.warn('Failed to fetch location name:', error);
      return null;
    }
  }, []);

  // Track last update times for throttling different calculations
  const lastLstUpdateRef = useRef<number>(0);
  const lastDeepSkyUpdateRef = useRef<number>(0);
  const lastMeteorUpdateRef = useRef<number>(0);
  
<<<<<<< Updated upstream
  // Handle sky position updates - heavily throttled to reduce re-renders
=======
  // Build position cache for the current day (runs in background)
  const buildPositionCache = useCallback((date: Date, observer: GeographicCoordinates) => {
    const dateStr = date.toISOString().split('T')[0];
    const cache = positionCacheRef.current;
    
    // Skip if already building or cache is current
    if (cache.isBuilding || (cache.date === dateStr && cache.observer?.latitude === observer.latitude && cache.observer?.longitude === observer.longitude)) {
      return;
    }
    
    cache.isBuilding = true;
    cache.date = dateStr;
    cache.observer = observer;
    cache.snapshots.clear();
    
    // Build cache in chunks to avoid blocking UI
    const INTERVAL = 15; // minutes between snapshots
    let currentMinute = 0;
    
    const buildChunk = () => {
      const chunkSize = 12; // Build 12 snapshots per frame (3 hours worth)
      const endMinute = Math.min(currentMinute + chunkSize * INTERVAL, 1440);
      
      while (currentMinute < endMinute) {
        const snapshotDate = new Date(date);
        snapshotDate.setHours(0, 0, 0, 0);
        snapshotDate.setMinutes(currentMinute);
        
        const lst = calculateLST(observer.longitude, snapshotDate);
        
        // Calculate deep sky positions
        const deepSkyArray = deepSkyCatalogRef.current?.getVisibleObjects(observer, lst) ?? [];
        const deepSkyPositions = new Map<string, DeepSkyPosition>();
        for (const pos of deepSkyArray) {
          deepSkyPositions.set(pos.object.id, pos);
        }
        
        // Calculate meteor shower radiants
        const meteorArray = meteorShowerCatalogRef.current?.getRadiantPositions(snapshotDate, observer, lst) ?? [];
        const meteorShowerRadiants = new Map<string, MeteorShowerPosition>();
        for (const pos of meteorArray) {
          meteorShowerRadiants.set(pos.shower.id, pos);
        }
        
        cache.snapshots.set(currentMinute, {
          deepSkyPositions,
          meteorShowerRadiants,
          lst,
        });
        
        currentMinute += INTERVAL;
      }
      
      if (currentMinute < 1440) {
        // Continue building in next frame
        requestAnimationFrame(buildChunk);
      } else {
        cache.isBuilding = false;
        console.log('Position cache built:', cache.snapshots.size, 'snapshots');
      }
    };
    
    // Start building after a short delay to not block initial render
    setTimeout(() => requestAnimationFrame(buildChunk), 100);
  }, []);
  
  // Get cached positions for a given time (interpolates between snapshots)
  const getCachedPositions = useCallback((time: Date): {
    deepSkyPositions: Map<string, DeepSkyPosition>;
    meteorShowerRadiants: Map<string, MeteorShowerPosition>;
    lst: number;
  } | null => {
    const cache = positionCacheRef.current;
    const dateStr = time.toISOString().split('T')[0];
    
    // Check if cache is valid for this date
    if (cache.date !== dateStr || cache.snapshots.size === 0) {
      return null;
    }
    
    const minutes = time.getHours() * 60 + time.getMinutes();
    const INTERVAL = 15;
    
    // Find the nearest snapshot (round to nearest interval)
    const nearestMinute = Math.round(minutes / INTERVAL) * INTERVAL;
    const clampedMinute = Math.min(Math.max(nearestMinute, 0), 1425); // 1425 = 23:45
    
    return cache.snapshots.get(clampedMinute) || null;
  }, []);

  // Handle sky position updates - throttle LST updates to reduce re-renders
>>>>>>> Stashed changes
  const handlePositionsUpdate = useCallback((positions: SkyPositions) => {
    setState(prev => {
      if (!prev.observer) return { ...prev, currentTime: positions.timestamp };

      const time = positions.timestamp;
      const observer = prev.observer;
      const now = Date.now();
      
      // Update LST every 1 second for smooth sky rotation
      const shouldUpdateLst = now - lastLstUpdateRef.current > 1000;
      const lst = shouldUpdateLst ? calculateLST(observer.longitude, time) : prev.lst;
      if (shouldUpdateLst) {
        lastLstUpdateRef.current = now;
      }

      // Calculate moon position using suncalc (fast, do every update)
      const moonData = getMoonPosition(time, observer.latitude, observer.longitude);
      const moonPosition: MoonPosition = {
        ra: moonData.ra,
        dec: moonData.dec,
        altitude: moonData.altitude,
        azimuth: moonData.azimuth,
        phaseName: moonData.phaseName as any,
        illumination: moonData.illumination,
        magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
        isBelowHorizon: moonData.isBelowHorizon,
      };

      // Calculate sun position using suncalc (fast, do every update)
      const sunData = getSunPosition(time, observer.latitude, observer.longitude);
      const sunPosition: SunPosition = {
        ra: sunData.ra,
        dec: sunData.dec,
        altitude: sunData.altitude,
        azimuth: sunData.azimuth,
        status: sunData.status,
        safetyWarning: sunData.safetyWarning,
        isBelowHorizon: sunData.isBelowHorizon,
      };

      // Deep sky positions - update every 30 seconds (they move slowly)
      const shouldUpdateDeepSky = now - lastDeepSkyUpdateRef.current > 30000;
      let deepSkyPositions = prev.deepSkyPositions;
      if (shouldUpdateDeepSky && shouldUpdateLst) {
        lastDeepSkyUpdateRef.current = now;
        const deepSkyArray = deepSkyCatalogRef.current?.getVisibleObjects(observer, lst) ?? [];
        deepSkyPositions = new Map<string, DeepSkyPosition>();
        for (const pos of deepSkyArray) {
          deepSkyPositions.set(pos.object.id, pos);
        }
      }

      // Satellite positions - keep previous (updated by separate interval)
      const satellitePositions = prev.satellitePositions;

      // Meteor shower radiants - update every 60 seconds (they barely move)
      const shouldUpdateMeteors = now - lastMeteorUpdateRef.current > 60000;
      let meteorShowerRadiants = prev.meteorShowerRadiants;
      if (shouldUpdateMeteors && shouldUpdateLst) {
        lastMeteorUpdateRef.current = now;
        const meteorArray = meteorShowerCatalogRef.current?.getRadiantPositions(time, observer, lst) ?? [];
        meteorShowerRadiants = new Map<string, MeteorShowerPosition>();
        for (const pos of meteorArray) {
          meteorShowerRadiants.set(pos.shower.id, pos);
        }
      }

      return {
        ...prev,
        currentTime: time,
        lst,
        moonPosition,
        sunPosition,
        deepSkyPositions,
        satellitePositions,
        meteorShowerRadiants,
      };
    });
  }, []);

  // Update display time every second for real-time clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setDisplayTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Real-time satellite tracking - update every 5 seconds for visible movement
  useEffect(() => {
    if (!state.observer || !state.showSatellites) return;
    
    const updateSatellites = async () => {
      try {
        const satellites = await getVisibleSatellites(state.observer!.latitude, state.observer!.longitude);
        
        setState(prev => {
          const newPositions = new Map<string, SatellitePosition | SatelliteTrackerError>();
          
          // Keep any existing positions from the astronomy-engine tracker
          prev.satellitePositions.forEach((pos, id) => {
            if (!id.startsWith('SAT-') && !id.startsWith('ISS')) {
              newPositions.set(id, pos);
            }
          });
          
          // Add satellites from API
          for (const sat of satellites) {
            if (sat.altitude > -10) { // Show satellites slightly below horizon too
              const satPosition: SatellitePosition = {
                id: `SAT-${sat.id}`,
                name: sat.name,
                altitude: sat.altitude,
                azimuth: sat.azimuth,
                isVisible: sat.isVisible,
                isStale: false,
                range: sat.height,
              };
              newPositions.set(sat.name, satPosition);
            }
          }
          
          return { ...prev, satellitePositions: newPositions };
        });
      } catch (error) {
        console.warn('Failed to update satellites:', error);
      }
    };
    
    // Initial fetch
    updateSatellites();
    
    // Update every 5 seconds for smooth movement
    const satelliteInterval = setInterval(updateSatellites, 5000);
    
    return () => clearInterval(satelliteInterval);
  }, [state.observer, state.showSatellites]);

  // Fetch meteor showers and ISS passes when location is available
  useEffect(() => {
    if (!state.observer) return;
    
    const fetchAstronomyData = async () => {
      try {
        // Get active meteor showers
        const showers = getActiveMeteorShowers(state.observer!.latitude, state.observer!.longitude);
        
        // Get upcoming ISS passes
        const passes = await getISSPasses(state.observer!.latitude, state.observer!.longitude, 5);
        
        // Get people in space
        const people = await getPeopleInSpace();
        
        setState(prev => ({
          ...prev,
          activeMeteorShowers: showers,
          upcomingIssPasses: passes,
          peopleInSpace: people,
        }));
      } catch (error) {
        // Silently fail - astronomy data is supplementary
      }
    };
    
    fetchAstronomyData();
    
    // Refresh every 30 minutes
    const interval = setInterval(fetchAstronomyData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.observer]);

  // Check auth status
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setState(prev => ({ ...prev, user: session?.user ?? null }));
      })
      .catch((error) => {
        // Handle lock errors gracefully
        console.warn('Auth session check failed:', error.message);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({ ...prev, user: session?.user ?? null }));
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize app
  useEffect(() => {
    // Prevent re-initialization
    if (initializationRef.current) {
      return;
    }
    initializationRef.current = true;
    
    setMounted(true);
    
    const init = async () => {
      try {
        // Check WebGL availability
        const webglAvailable = isWebGLAvailable();
        setState(prev => ({ ...prev, useWebGL: webglAvailable }));

        // Initialize geolocation
        geolocationRef.current = new WebGeolocationService({
          onStatusChange: (status) => {
            setState(prev => ({ ...prev, locationStatus: status }));
          },
          onError: (error) => {
            console.warn('Location error:', error.message);
          },
        });

        const coords = await geolocationRef.current.requestLocation();
        setState(prev => ({ ...prev, observer: coords }));

        // Fetch location name
        const locationName = await fetchLocationName(coords);
        setState(prev => ({ ...prev, locationName }));

        // Initialize star catalog - zoom-based progressive loading
        // 1. Load constellation stars first (essential for constellation lines)
        // 2. Load bright stars (mag <= 6)
        // 3. More stars load as user zooms in
        let stars: Star[] = [];
        let constellations: Constellation[] = [];
        
        try {
          // First: Load constellations with their stars (essential for constellation lines)
          const constellationResult = await fetchConstellationsWithStars();
          constellations = constellationResult.constellations;
          const constellationStars = constellationResult.stars;
          
          // Create a Set of constellation star IDs to avoid duplicates
          const constellationStarIds = new Set(constellationStars.map(s => s.id));
          
          // Load additional bright stars (mag <= 6)
          const { fetchStarsByMagnitude } = await import('../src/services/supabase-service');
          const brightStars = await fetchStarsByMagnitude(6.0, 10000);
          
          // Merge: constellation stars + bright stars (avoiding duplicates)
          const additionalBrightStars = brightStars.filter(s => !constellationStarIds.has(s.id));
          stars = [...constellationStars, ...additionalBrightStars];
          
          // Update state with initial stars and mark as ready to display
          setState(prev => ({ 
            ...prev, 
            stars,
            constellations,
            loadingProgress: 100,
            currentMagnitudeLimit: 6.0,
            isLoading: false,
          }));
          
        } catch (error) {
          // Fallback to local JSON
          const response = await fetch('/data/bright-stars.json');
          const data = await response.json();
          stars = data.stars.map((s: any) => ({
            id: s.id,
            name: s.name,
            ra: s.ra,
            dec: s.dec,
            magnitude: s.mag,
            spectralType: s.spectralType,
          }));
          
          // Try to load constellations
          try {
            const result = await fetchConstellationsWithStars();
            constellations = result.constellations;
          } catch {
            constellations = [];
          }
          
          setState(prev => ({ 
            ...prev, 
            stars,
            constellations,
            isLoading: false,
          }));
        }
        
        // Fetch celestial bodies (sun, moon, planets) from Astronomy API
        let planets: Planet[] = [];
        let moonPosition: MoonPosition | null = null;
        let sunPosition: SunPosition | null = null;
        
        try {
          const { fetchBodiesFromAstronomyAPI } = await import('../src/services/astronomy-api');
          const now = new Date();
          const bodies = await fetchBodiesFromAstronomyAPI(coords, now);
          
          // Convert API planets to Planet type
          planets = bodies.planets.map(p => ({
            id: p.name.toLowerCase(),
            name: p.name,
            ra: p.ra,
            dec: p.dec,
            magnitude: p.magnitude,
          }));
          
          // Use suncalc for accurate moon position
          const moonData = getMoonPosition(now, coords.latitude, coords.longitude);
          moonPosition = {
            ra: moonData.ra,
            dec: moonData.dec,
            altitude: moonData.altitude,
            azimuth: moonData.azimuth,
            phaseName: moonData.phaseName as any,
            illumination: moonData.illumination,
            magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
            isBelowHorizon: moonData.isBelowHorizon,
          };
          
          // Use suncalc for accurate sun position
          const sunData = getSunPosition(now, coords.latitude, coords.longitude);
          sunPosition = {
            ra: sunData.ra,
            dec: sunData.dec,
            altitude: sunData.altitude,
            azimuth: sunData.azimuth,
            status: sunData.status,
            safetyWarning: sunData.safetyWarning,
            isBelowHorizon: sunData.isBelowHorizon,
          };
        } catch (bodiesError) {
          // Fallback to local calculators for planets
          const planetCalc = createPlanetCalculator();
          planets = planetCalc.calculatePlanetPositions(new Date(), coords);
          
          // Use suncalc for moon and sun (always reliable)
          const now = new Date();
          const moonData = getMoonPosition(now, coords.latitude, coords.longitude);
          moonPosition = {
            ra: moonData.ra,
            dec: moonData.dec,
            altitude: moonData.altitude,
            azimuth: moonData.azimuth,
            phaseName: moonData.phaseName as any,
            illumination: moonData.illumination,
            magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
            isBelowHorizon: moonData.isBelowHorizon,
          };
          
          const sunData = getSunPosition(now, coords.latitude, coords.longitude);
          sunPosition = {
            ra: sunData.ra,
            dec: sunData.dec,
            altitude: sunData.altitude,
            azimuth: sunData.azimuth,
            status: sunData.status,
            safetyWarning: sunData.safetyWarning,
            isBelowHorizon: sunData.isBelowHorizon,
          };
        }

        // Initialize horizon line
        horizonLineRef.current = createHorizonLine();
        const horizonPoints = horizonLineRef.current.getHorizonPoints();

        // Initialize deep sky catalog
        deepSkyCatalogRef.current = createDeepSkyCatalog();
        // Set magnitude limit to show all Messier objects (brightest is 1.6, faintest is 10.2)
        deepSkyCatalogRef.current.setConfig({ maxMagnitude: 12.0 });

        // Initialize satellite tracker and load ISS
        satelliteTrackerRef.current = createSatelliteTracker();
        await satelliteTrackerRef.current.loadDefaultISS();
        
        // Also fetch ISS from Where The ISS At API as backup
        await getISSPosition(coords.latitude, coords.longitude);

        // Initialize meteor shower catalog
        meteorShowerCatalogRef.current = createMeteorShowerCatalog();

        // Calculate initial positions
        const now = new Date();
        const lst = calculateLST(coords.longitude, now);
        
        // Convert deep sky array to Map
        const deepSkyArray = deepSkyCatalogRef.current.getVisibleObjects(coords, lst);
        const deepSkyPositions = new Map<string, DeepSkyPosition>();
        for (const pos of deepSkyArray) {
          deepSkyPositions.set(pos.object.id, pos);
        }
        
        // Calculate satellite positions only if we have sun position
        const satellitePositions = sunPosition 
          ? satelliteTrackerRef.current.calculateAll(now, coords, sunPosition)
          : new Map<string, SatellitePosition | SatelliteTrackerError>();
        
        // Convert meteor shower array to Map
        const meteorArray = meteorShowerCatalogRef.current.getRadiantPositions(now, coords, lst);
        const meteorShowerRadiants = new Map<string, MeteorShowerPosition>();
        for (const pos of meteorArray) {
          meteorShowerRadiants.set(pos.shower.id, pos);
        }

        setState(prev => ({
          ...prev,
          stars,
          planets,
          horizonPoints,
          moonPosition,
          sunPosition,
          constellations,
          deepSkyPositions,
          satellitePositions,
          meteorShowerRadiants,
          lst, // Set initial LST for real-time sky rotation
        }));

        // Initialize sky calculator
        skyCalculatorRef.current = createSkyCalculator({
          observer: coords,
          onPositionsUpdate: handlePositionsUpdate,
        });
        skyCalculatorRef.current.setStars(stars);
        skyCalculatorRef.current.setPlanets(planets);
        skyCalculatorRef.current.startUpdates();

        // Set initial last update time
        setState(prev => ({ ...prev, lastUpdateTime: new Date() }));
        
        // Set up real-time updates for celestial bodies (every 5 minutes)
        const updateInterval = setInterval(async () => {
          try {
            setState(prev => ({ ...prev, isUpdating: true }));
            const { fetchBodiesFromAstronomyAPI } = await import('../src/services/astronomy-api');
            const now = new Date();
            const bodies = await fetchBodiesFromAstronomyAPI(coords, now);
            
            // Update planets
            const updatedPlanets = bodies.planets.map(p => ({
              id: p.name.toLowerCase(),
              name: p.name,
              ra: p.ra,
              dec: p.dec,
              magnitude: p.magnitude,
            }));
            
            // Update moon using suncalc
            const moonData = getMoonPosition(now, coords.latitude, coords.longitude);
            const updatedMoon: MoonPosition = {
              ra: moonData.ra,
              dec: moonData.dec,
              altitude: moonData.altitude,
              azimuth: moonData.azimuth,
              phaseName: moonData.phaseName as any,
              illumination: moonData.illumination,
              magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
              isBelowHorizon: moonData.isBelowHorizon,
            };
            
            // Update sun using suncalc
            const sunData = getSunPosition(now, coords.latitude, coords.longitude);
            const updatedSun: SunPosition = {
              ra: sunData.ra,
              dec: sunData.dec,
              altitude: sunData.altitude,
              azimuth: sunData.azimuth,
              status: sunData.status,
              safetyWarning: sunData.safetyWarning,
              isBelowHorizon: sunData.isBelowHorizon,
            };
            
            // Fetch ISS position
            const issData = await getISSPosition(coords.latitude, coords.longitude);
            if (issData) {
              // ISS position fetched successfully
            }
            
            setState(prev => ({
              ...prev,
              planets: updatedPlanets,
              moonPosition: updatedMoon,
              sunPosition: updatedSun,
              lastUpdateTime: new Date(),
              isUpdating: false,
            }));
            
            // Update sky calculator
            if (skyCalculatorRef.current) {
              skyCalculatorRef.current.setPlanets(updatedPlanets);
            }
          } catch (error) {
            setState(prev => ({ ...prev, isUpdating: false }));
          }
        }, 5 * 60 * 1000); // Update every 5 minutes

        setState(prev => ({ ...prev, isLoading: false }));
        
        // Return cleanup function
        return () => {
          clearInterval(updateInterval);
        };
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Initialization failed',
        }));
        // Return empty cleanup function on error
        return () => {};
      }
    };

    init();

    return () => {
      skyCalculatorRef.current?.dispose();
    };
  }, [handlePositionsUpdate]);

  // Handle star click
  const handleStarClick = useCallback((star: Star) => {
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'star',
        id: star.id,
        name: star.name || star.id, // Use star ID (e.g., HIP12345) if no name
        ra: star.ra,
        dec: star.dec,
        magnitude: star.magnitude,
        spectralType: star.spectralType,
      },
    }));
  }, []);

  // Handle planet click
  const handlePlanetClick = useCallback((planet: Planet) => {
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'planet',
        id: planet.id,
        name: planet.name,
        ra: planet.ra,
        dec: planet.dec,
        magnitude: planet.magnitude,
      },
    }));
  }, []);

  // Handle deep sky object click
  const handleDeepSkyClick = useCallback((object: DeepSkyPosition) => {
    // For deep sky objects, prefer showing ID (like M42) with name as secondary
    const displayName = object.object.name 
      ? `${object.object.id} - ${object.object.name}`
      : object.object.id;
    
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'deepsky',
        id: object.object.id,
        name: displayName,
        ra: object.object.ra,
        dec: object.object.dec,
        magnitude: object.object.magnitude,
        objectType: object.object.type,
      },
    }));
  }, []);

  // Handle moon click
  const handleMoonClick = useCallback((moon: MoonPosition) => {
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'moon',
        id: 'moon',
        name: 'Moon',
        ra: moon.ra,
        dec: moon.dec,
        magnitude: moon.magnitude,
        illumination: moon.illumination,
        phaseName: moon.phaseName,
      },
    }));
  }, []);

  // Handle sun click
  const handleSunClick = useCallback((sun: SunPosition) => {
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'sun',
        id: 'sun',
        name: 'Sun',
        ra: sun.ra,
        dec: sun.dec,
        status: sun.status,
      },
    }));
  }, []);

  // Handle constellation click
  const handleConstellationClick = useCallback((constellation: Constellation) => {
    setState(prev => ({
      ...prev,
      selectedObject: {
        type: 'constellation',
        id: constellation.id,
        name: constellation.name,
      },
    }));
  }, []);

  // Load more stars based on zoom level (FOV)
  // Lower FOV = more zoomed in = load fainter stars
  const loadMoreStarsForZoom = useCallback(async (fov: number) => {
    // Calculate target magnitude based on FOV
    // FOV 60° = mag 6, FOV 30° = mag 8, FOV 15° = mag 10, FOV 5° = mag 12
    const targetMagnitude = Math.min(12, Math.max(6, 6 + (60 - fov) / 10));
    
    setState(prev => {
      // Don't load if already loading or if we already have this magnitude
      if (prev.isLoadingMoreStars || prev.currentMagnitudeLimit >= targetMagnitude) {
        return prev;
      }
      
      // Start loading more stars
      (async () => {
        try {
          // Get constellation stars first (they must always be included)
          const constellationResult = await fetchConstellationsWithStars();
          const constellationStars = constellationResult.stars;
          const constellationStarIds = new Set(constellationStars.map(s => s.id));
          
          // Fetch stars by magnitude
          const { fetchStarsByMagnitude } = await import('../src/services/supabase-service');
          const dbStars = await fetchStarsByMagnitude(targetMagnitude, 100000);
          
          // Merge: constellation stars + database stars (avoiding duplicates)
          const additionalStars = dbStars.filter(s => !constellationStarIds.has(s.id));
          const mergedStars = [...constellationStars, ...additionalStars];
          
          setState(p => ({
            ...p,
            stars: mergedStars,
            currentMagnitudeLimit: targetMagnitude,
            isLoadingMoreStars: false,
          }));
          
          // Update sky calculator
          if (skyCalculatorRef.current) {
            skyCalculatorRef.current.setStars(mergedStars);
          }
        } catch (error) {
          setState(p => ({ ...p, isLoadingMoreStars: false }));
        }
      })();
      
      return { ...prev, isLoadingMoreStars: true };
    });
  }, []);

  // Handle camera orientation change
  const handleCameraChange = useCallback((orientation: { azimuth: number; altitude: number; fov: number }) => {
    setState(prev => ({
      ...prev,
      viewAzimuth: orientation.azimuth,
      viewAltitude: orientation.altitude,
      fov: orientation.fov,
    }));
    
    // Load more stars if zoomed in
    loadMoreStarsForZoom(orientation.fov);
  }, [loadMoreStarsForZoom]);

  // Toggle real-time mode
  const toggleRealTime = useCallback(() => {
    if (skyCalculatorRef.current) {
      if (state.isRealTime) {
        skyCalculatorRef.current.setTime(new Date());
      } else {
        skyCalculatorRef.current.setRealTime();
      }
      setState(prev => ({ ...prev, isRealTime: !prev.isRealTime }));
    }
  }, [state.isRealTime]);

  // Manual refresh of celestial bodies
  const refreshCelestialBodies = useCallback(async () => {
    if (!state.observer || state.isUpdating) return;
    
    try {
      setState(prev => ({ ...prev, isUpdating: true }));
      const { fetchBodiesFromAstronomyAPI } = await import('../src/services/astronomy-api');
      const now = new Date();
      const bodies = await fetchBodiesFromAstronomyAPI(state.observer, now);
      
      // Update planets
      const updatedPlanets = bodies.planets.map(p => ({
        id: p.name.toLowerCase(),
        name: p.name,
        ra: p.ra,
        dec: p.dec,
        magnitude: p.magnitude,
      }));
      
      // Update moon using suncalc
      const moonData = getMoonPosition(now, state.observer.latitude, state.observer.longitude);
      const updatedMoon: MoonPosition = {
        ra: moonData.ra,
        dec: moonData.dec,
        altitude: moonData.altitude,
        azimuth: moonData.azimuth,
        phaseName: moonData.phaseName as any,
        illumination: moonData.illumination,
        magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
        isBelowHorizon: moonData.isBelowHorizon,
      };
      
      // Update sun using suncalc
      const sunData = getSunPosition(now, state.observer.latitude, state.observer.longitude);
      const updatedSun: SunPosition = {
        ra: sunData.ra,
        dec: sunData.dec,
        altitude: sunData.altitude,
        azimuth: sunData.azimuth,
        status: sunData.status,
        safetyWarning: sunData.safetyWarning,
        isBelowHorizon: sunData.isBelowHorizon,
      };
      
      // Fetch ISS position
      await getISSPosition(state.observer.latitude, state.observer.longitude);
      
      setState(prev => ({
        ...prev,
        planets: updatedPlanets,
        moonPosition: updatedMoon,
        sunPosition: updatedSun,
        lastUpdateTime: new Date(),
        isUpdating: false,
      }));
      
      // Update sky calculator
      if (skyCalculatorRef.current) {
        skyCalculatorRef.current.setPlanets(updatedPlanets);
      }
    } catch (error) {
      setState(prev => ({ ...prev, isUpdating: false }));
    }
  }, [state.observer, state.isUpdating]);

  // Toggle WebGL/2D mode
  const toggleRenderMode = useCallback(() => {
    setState(prev => ({ ...prev, useWebGL: !prev.useWebGL }));
  }, []);

  // Toggle display options
  const toggleConstellations = useCallback(() => {
    setState(prev => ({ ...prev, showConstellations: !prev.showConstellations }));
  }, []);

  const toggleDeepSky = useCallback(() => {
    setState(prev => ({ ...prev, showDeepSky: !prev.showDeepSky }));
  }, []);

  const toggleAllDeepSky = useCallback(() => {
    setState(prev => ({ ...prev, showAllDeepSky: !prev.showAllDeepSky }));
  }, []);

  const toggleSatellites = useCallback(() => {
    setState(prev => ({ ...prev, showSatellites: !prev.showSatellites }));
  }, []);

  const toggleMeteorShowers = useCallback(() => {
    setState(prev => ({ ...prev, showMeteorShowers: !prev.showMeteorShowers }));
  }, []);

  const toggleStarLabels = useCallback(() => {
    setState(prev => ({ ...prev, showStarLabels: !prev.showStarLabels }));
  }, []);

  const togglePlanets = useCallback(() => {
    setState(prev => ({ ...prev, showPlanets: !prev.showPlanets }));
  }, []);

  const toggleMoon = useCallback(() => {
    setState(prev => ({ ...prev, showMoon: !prev.showMoon }));
  }, []);

  const toggleSun = useCallback(() => {
    setState(prev => ({ ...prev, showSun: !prev.showSun }));
  }, []);

  const toggleAltitudeGrid = useCallback(() => {
    setState(prev => ({ ...prev, showAltitudeGrid: !prev.showAltitudeGrid }));
  }, []);

  const toggleAzimuthGrid = useCallback(() => {
    setState(prev => ({ ...prev, showAzimuthGrid: !prev.showAzimuthGrid }));
  }, []);

  const toggleEquatorialGrid = useCallback(() => {
    setState(prev => ({ ...prev, showEquatorialGrid: !prev.showEquatorialGrid }));
  }, []);

  const toggleAtmosphere = useCallback(() => {
    setState(prev => ({ ...prev, showAtmosphere: !prev.showAtmosphere }));
  }, []);

  const toggleGround = useCallback(() => {
    setState(prev => ({ ...prev, showGround: !prev.showGround }));
  }, []);

  // Time selector controls
  const toggleTimeSelector = useCallback(() => {
    setState(prev => {
      const newShowTimeSelector = !prev.showTimeSelector;
      // Build position cache when opening time selector
      if (newShowTimeSelector && prev.observer) {
        buildPositionCache(prev.selectedDate, prev.observer);
      }
      return { ...prev, showTimeSelector: newShowTimeSelector };
    });
  }, [buildPositionCache]);

  const setSelectedTime = useCallback((date: Date) => {
    setState(prev => ({ ...prev, selectedDate: date, isRealTime: false }));
    // Update sky calculator with new time
    if (skyCalculatorRef.current) {
      skyCalculatorRef.current.setTime(date);
    }
  }, []);

  // Smooth time slider - converts slider value (0-1440 minutes) to time
  // Uses pre-calculated position cache for instant updates
  const handleTimeSliderChange = useCallback((minutes: number) => {
    const newDate = new Date(state.selectedDate);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    newDate.setHours(hours, mins, 0, 0);
    
    // Try to get cached positions for instant update
    const cached = getCachedPositions(newDate);
    
    if (cached && state.observer) {
      // Use cached positions - instant update!
      const sunData = getSunPosition(newDate, state.observer.latitude, state.observer.longitude);
      const sunPosition: SunPosition = {
        ra: sunData.ra,
        dec: sunData.dec,
        altitude: sunData.altitude,
        azimuth: sunData.azimuth,
        status: sunData.status,
        safetyWarning: sunData.safetyWarning,
        isBelowHorizon: sunData.isBelowHorizon,
      };
      
      const moonData = getMoonPosition(newDate, state.observer.latitude, state.observer.longitude);
      const moonPosition: MoonPosition = {
        ra: moonData.ra,
        dec: moonData.dec,
        altitude: moonData.altitude,
        azimuth: moonData.azimuth,
        phaseName: moonData.phaseName as any,
        illumination: moonData.illumination,
        magnitude: -12.7 + (1 - moonData.illumination / 100) * 10,
        isBelowHorizon: moonData.isBelowHorizon,
      };
      
      setState(prev => ({
        ...prev,
        selectedDate: newDate,
        currentTime: newDate,
        isRealTime: false,
        lst: cached.lst,
        deepSkyPositions: cached.deepSkyPositions,
        meteorShowerRadiants: cached.meteorShowerRadiants,
        sunPosition,
        moonPosition,
      }));
      
      // Still update sky calculator for star positions (lightweight)
      if (skyCalculatorRef.current) {
        skyCalculatorRef.current.setTime(newDate);
      }
    } else {
      // No cache - fall back to throttled updates
      setState(prev => ({ ...prev, selectedDate: newDate, isRealTime: false }));
      pendingTimeRef.current = newDate;
      
      if (!timeSliderThrottleRef.current) {
        timeSliderThrottleRef.current = setTimeout(() => {
          if (pendingTimeRef.current && skyCalculatorRef.current) {
            skyCalculatorRef.current.setTime(pendingTimeRef.current);
          }
          timeSliderThrottleRef.current = null;
        }, 100);
      }
    }
  }, [state.selectedDate, state.observer, getCachedPositions]);

  // Finalize time when slider is released - ensures final position is calculated
  const handleTimeSliderRelease = useCallback(() => {
    // Clear any pending throttle
    if (timeSliderThrottleRef.current) {
      clearTimeout(timeSliderThrottleRef.current);
      timeSliderThrottleRef.current = null;
    }
    // Apply the final time immediately
    if (pendingTimeRef.current && skyCalculatorRef.current) {
      skyCalculatorRef.current.setTime(pendingTimeRef.current);
      pendingTimeRef.current = null;
    }
  }, []);

  const adjustTime = useCallback((hours: number) => {
    setState(prev => {
      const newDate = new Date(prev.selectedDate.getTime() + hours * 60 * 60 * 1000);
      if (skyCalculatorRef.current) {
        skyCalculatorRef.current.setTime(newDate);
      }
      return { ...prev, selectedDate: newDate, isRealTime: false };
    });
  }, []);

  const adjustDate = useCallback((days: number) => {
    setState(prev => {
      const newDate = new Date(prev.selectedDate.getTime() + days * 24 * 60 * 60 * 1000);
      if (skyCalculatorRef.current) {
        skyCalculatorRef.current.setTime(newDate);
      }
      // Rebuild cache for new date if time selector is open
      if (prev.showTimeSelector && prev.observer) {
        buildPositionCache(newDate, prev.observer);
      }
      return { ...prev, selectedDate: newDate, isRealTime: false };
    });
  }, [buildPositionCache]);

  const resetToNow = useCallback(() => {
    const now = new Date();
    setState(prev => ({ ...prev, selectedDate: now, isRealTime: true }));
    if (skyCalculatorRef.current) {
      skyCalculatorRef.current.setRealTime();
    }
  }, []);

  // Location selector controls
  const toggleLocationSelector = useCallback(() => {
    setState(prev => ({ ...prev, showLocationSelector: !prev.showLocationSelector }));
  }, []);

  const toggleCredits = useCallback(() => {
    setState(prev => ({ ...prev, showCredits: !prev.showCredits }));
  }, []);

  const toggleObjectSearch = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      showObjectSearch: !prev.showObjectSearch,
      objectSearchQuery: '',
      objectSearchResults: [],
    }));
  }, []);

  // Search for celestial objects
  const searchObjects = useCallback((query: string) => {
    setState(prev => {
      if (!query.trim()) {
        return { ...prev, objectSearchQuery: query, objectSearchResults: [] };
      }
      
      const lowerQuery = query.toLowerCase();
      const results: AppState['objectSearchResults'] = [];
      const maxResults = 15;
      
      // Search planets
      for (const planet of prev.planets) {
        if (planet.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'planet',
            id: planet.id,
            name: planet.name,
            ra: planet.ra,
            dec: planet.dec,
            magnitude: planet.magnitude,
          });
        }
      }
      
      // Search Moon
      if (prev.moonPosition && 'moon'.includes(lowerQuery)) {
        results.push({
          type: 'moon',
          id: 'moon',
          name: 'Moon',
          ra: prev.moonPosition.ra,
          dec: prev.moonPosition.dec,
        });
      }
      
      // Search Sun
      if (prev.sunPosition && 'sun'.includes(lowerQuery)) {
        results.push({
          type: 'sun',
          id: 'sun',
          name: 'Sun',
          ra: prev.sunPosition.ra,
          dec: prev.sunPosition.dec,
        });
      }
      
      // Search constellations
      for (const constellation of prev.constellations) {
        if (constellation.name.toLowerCase().includes(lowerQuery) || 
            constellation.id.toLowerCase().includes(lowerQuery)) {
          // Get center position from first line
          const firstLine = constellation.lines[0];
          if (firstLine) {
            results.push({
              type: 'constellation',
              id: constellation.id,
              name: constellation.name,
              ra: firstLine.star1.ra,
              dec: firstLine.star1.dec,
            });
          }
        }
        if (results.length >= maxResults) break;
      }
      
      // Search deep sky objects (Messier)
      prev.deepSkyPositions.forEach((pos, id) => {
        if (results.length >= maxResults) return;
        const name = pos.object.name || '';
        if (id.toLowerCase().includes(lowerQuery) || 
            name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'deepsky',
            id: pos.object.id,
            name: pos.object.name ? `${pos.object.id} - ${pos.object.name}` : pos.object.id,
            ra: pos.object.ra,
            dec: pos.object.dec,
            magnitude: pos.object.magnitude,
          });
        }
      });
      
      // Search satellites
      prev.satellitePositions.forEach((pos, id) => {
        if (results.length >= maxResults) return;
        if ('name' in pos && pos.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'satellite',
            id: id,
            name: pos.name,
          });
        }
      });
      
      // Search bright stars (named stars only for performance)
      for (const star of prev.stars) {
        if (results.length >= maxResults) break;
        if (star.name && star.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'star',
            id: star.id,
            name: star.name,
            ra: star.ra,
            dec: star.dec,
            magnitude: star.magnitude,
          });
        }
      }
      
      return { ...prev, objectSearchQuery: query, objectSearchResults: results };
    });
  }, []);

  // Helper function to convert RA/Dec to Alt/Az
  const raDecToAltAz = useCallback((ra: number, dec: number, lst: number, latitude: number) => {
    // Calculate Hour Angle
    const haHours = lst - ra;
    const haDegrees = haHours * 15;
    const haRadians = (haDegrees * Math.PI) / 180;
    
    const decRad = (dec * Math.PI) / 180;
    const latRad = (latitude * Math.PI) / 180;
    
    // Calculate altitude
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) +
                   Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRadians);
    const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    
    // Calculate azimuth
    const cosAlt = Math.cos(altitude * Math.PI / 180);
    const cosLat = Math.cos(latRad);
    
    let azimuth = 0;
    if (Math.abs(cosAlt) >= 1e-10 && Math.abs(cosLat) >= 1e-10) {
      const cosAz = (Math.sin(decRad) - sinAlt * Math.sin(latRad)) / (cosAlt * cosLat);
      let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
      if (Math.sin(haRadians) > 0) {
        azRad = 2 * Math.PI - azRad;
      }
      azimuth = azRad * 180 / Math.PI;
    }
    
    // Normalize azimuth to [0, 360)
    azimuth = ((azimuth % 360) + 360) % 360;
    
    // Mirror the azimuth to match the 3D scene coordinate system (same as celestialToHorizontal3D)
    azimuth = (360 - azimuth) % 360;
    
    return { altitude, azimuth };
  }, []);

  // Select and highlight an object from search
  const selectSearchResult = useCallback((result: AppState['objectSearchResults'][0]) => {
    setState(prev => {
      let position: { azimuth: number; altitude: number } | null = null;
      
      // Calculate position based on object type
      if (result.ra !== undefined && result.dec !== undefined && prev.observer) {
        // raDecToAltAz already applies the mirror
        position = raDecToAltAz(result.ra, result.dec, prev.lst, prev.observer.latitude);
      } else if (result.type === 'moon' && prev.moonPosition) {
        // Moon position is in real coordinates, apply mirror to match 3D scene
        position = { 
          azimuth: (360 - prev.moonPosition.azimuth) % 360, 
          altitude: prev.moonPosition.altitude 
        };
      } else if (result.type === 'sun' && prev.sunPosition) {
        // Sun position is in real coordinates, apply mirror to match 3D scene
        position = { 
          azimuth: (360 - prev.sunPosition.azimuth) % 360, 
          altitude: prev.sunPosition.altitude 
        };
      } else if (result.type === 'satellite') {
        const sat = prev.satellitePositions.get(result.id);
        if (sat && 'altitude' in sat) {
          // Satellite position is in real coordinates, apply mirror to match 3D scene
          position = { 
            azimuth: (360 - sat.azimuth) % 360, 
            altitude: sat.altitude 
          };
        }
      } else if (result.type === 'deepsky') {
        const dso = prev.deepSkyPositions.get(result.id);
        if (dso) {
          // Deep sky position is in real coordinates, apply mirror to match 3D scene
          position = { 
            azimuth: (360 - dso.azimuth) % 360, 
            altitude: dso.altitude 
          };
        }
      }
      
      return {
        ...prev,
        highlightedObjectId: result.id,
        cameraTarget: position,
        showObjectSearch: false,
        objectSearchQuery: '',
        objectSearchResults: [],
      };
    });
    
    // Clear camera target after animation completes (but keep highlight)
    setTimeout(() => {
      setState(prev => ({ ...prev, cameraTarget: null }));
    }, 2000);
  }, [raDecToAltAz]);

  // Clear highlight when user clicks close button
  const clearHighlight = useCallback(() => {
    setState(prev => ({ ...prev, highlightedObjectId: null, cameraTarget: null }));
  }, []);

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setState(prev => ({ ...prev, locationSearchResults: [] }));
      return;
    }
    
    setState(prev => ({ ...prev, isSearchingLocation: true }));
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      
      const results = data.map((item: any) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }));
      
      setState(prev => ({ ...prev, locationSearchResults: results, isSearchingLocation: false }));
    } catch (error) {
      console.warn('Location search failed:', error);
      setState(prev => ({ ...prev, isSearchingLocation: false }));
    }
  }, []);

  const selectLocation = useCallback(async (lat: number, lon: number, name?: string) => {
    const newObserver = { latitude: lat, longitude: lon, altitude: 0 };
    
    // Fetch location name if not provided
    let locationName: string | null = name || null;
    if (!locationName) {
      locationName = await fetchLocationName(newObserver);
    } else if (name) {
      // Shorten the name if it's too long
      const parts = name.split(',').slice(0, 3);
      locationName = parts.join(',');
    }
    
    setState(prev => ({
      ...prev,
      observer: newObserver,
      locationName,
      showLocationSelector: false,
      locationSearchQuery: '',
      locationSearchResults: [],
    }));
    
    // Update sky calculator with new location
    if (skyCalculatorRef.current) {
      skyCalculatorRef.current.setObserver(newObserver);
    }
  }, [fetchLocationName]);

  const useCurrentLocation = useCallback(async () => {
    if (geolocationRef.current) {
      try {
        const coords = await geolocationRef.current.requestLocation();
        const locationName = await fetchLocationName(coords);
        setState(prev => ({
          ...prev,
          observer: coords,
          locationName,
          locationStatus: 'granted',
          showLocationSelector: false,
        }));
        
        if (skyCalculatorRef.current) {
          skyCalculatorRef.current.setObserver(coords);
        }
      } catch (error) {
        console.warn('Failed to get current location:', error);
      }
    }
  }, [fetchLocationName]);

  // Handle light pollution change - maps Bortle scale to limiting magnitude
  const handleLightPollutionChange = useCallback((value: number) => {
    setState(prev => ({ ...prev, lightPollution: value }));
  }, []);

  // Get limiting magnitude based on Bortle scale
  const getLimitingMagnitude = (bortle: number): number => {
    // Bortle scale to naked-eye limiting magnitude mapping
    const bortleToMag: Record<number, number> = {
      1: 7.6,  // Excellent dark sky
      2: 7.1,  // Typical dark site
      3: 6.6,  // Rural sky
      4: 6.2,  // Rural/suburban transition
      5: 5.6,  // Suburban sky
      6: 5.1,  // Bright suburban
      7: 4.6,  // Suburban/urban transition
      8: 4.1,  // City sky
      9: 3.5,  // Inner-city sky
    };
    return bortleToMag[bortle] ?? 5.6;
  };

  // Get Bortle scale description
  const getBortleDescription = (bortle: number): string => {
    const descriptions: Record<number, string> = {
      1: 'Excellent Dark Sky',
      2: 'Typical Dark Site',
      3: 'Rural Sky',
      4: 'Rural/Suburban',
      5: 'Suburban Sky',
      6: 'Bright Suburban',
      7: 'Suburban/Urban',
      8: 'City Sky',
      9: 'Inner-City Sky',
    };
    return descriptions[bortle] ?? 'Suburban Sky';
  };

  const limitingMagnitude = getLimitingMagnitude(state.lightPollution);

  const skyConfig = {
    fov: state.fov,
    maxMagnitude: limitingMagnitude,
    showLabels: state.showStarLabels,
    labelMagnitudeThreshold: 2.0,
  };

  if (!mounted) {
    return null;
  }

  if (state.error) {
    return (
      <main style={styles.container}>
        <div style={styles.error}>Error: {state.error}</div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>SkyWatch - Real-time Interactive Star Map | Sky Guild</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            margin: 0;
            padding: 0;
          }
          
          #__next {
            width: 100%;
            height: 100%;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: translateY(0); }
            50% { opacity: 0.5; transform: translateY(-5px); }
          }
          
          @keyframes pulseRing {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
          
          button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          }
          
          button:active:not(:disabled) {
            transform: translateY(0);
          }
          
          /* Light pollution vertical slider */
          .light-pollution-slider {
            -webkit-appearance: none;
            appearance: none;
            background: transparent;
            cursor: pointer;
          }
          
          .light-pollution-slider::-webkit-slider-runnable-track {
            width: 100%;
            height: 4px;
            background: transparent;
            border-radius: 2px;
          }
          
          .light-pollution-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 50%;
            cursor: grab;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
            border: 2px solid rgba(99, 102, 241, 0.5);
            margin-top: -6px;
          }
          
          .light-pollution-slider::-webkit-slider-thumb:active {
            cursor: grabbing;
            transform: scale(1.1);
          }
          
          .light-pollution-slider::-moz-range-track {
            width: 100%;
            height: 4px;
            background: transparent;
            border-radius: 2px;
          }
          
          .light-pollution-slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 50%;
            cursor: grab;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
            border: 2px solid rgba(99, 102, 241, 0.5);
          }
          
          .light-pollution-slider::-moz-range-thumb:active {
            cursor: grabbing;
          }
          
          .light-pollution-slider:focus {
            outline: none;
          }
          
          /* Time Slider Styles */
          .time-slider {
            -webkit-appearance: none;
            appearance: none;
            background: linear-gradient(90deg, rgba(99, 102, 241, 0.3), rgba(34, 211, 238, 0.3));
            border-radius: 3px;
            cursor: pointer;
          }
          
          .time-slider::-webkit-slider-runnable-track {
            width: 100%;
            height: 6px;
            background: linear-gradient(90deg, rgba(99, 102, 241, 0.3), rgba(34, 211, 238, 0.3));
            border-radius: 3px;
          }
          
          .time-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            background: linear-gradient(135deg, #818cf8, #22d3ee);
            border-radius: 50%;
            cursor: grab;
            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.5);
            border: 2px solid rgba(255, 255, 255, 0.9);
            margin-top: -6px;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          
          .time-slider::-webkit-slider-thumb:hover {
            transform: scale(1.15);
            box-shadow: 0 3px 12px rgba(99, 102, 241, 0.7);
          }
          
          .time-slider::-webkit-slider-thumb:active {
            cursor: grabbing;
            transform: scale(1.1);
          }
          
          .time-slider::-moz-range-track {
            width: 100%;
            height: 6px;
            background: linear-gradient(90deg, rgba(99, 102, 241, 0.3), rgba(34, 211, 238, 0.3));
            border-radius: 3px;
          }
          
          .time-slider::-moz-range-thumb {
            width: 18px;
            height: 18px;
            background: linear-gradient(135deg, #818cf8, #22d3ee);
            border-radius: 50%;
            cursor: grab;
            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.5);
            border: 2px solid rgba(255, 255, 255, 0.9);
          }
          
          .time-slider::-moz-range-thumb:active {
            cursor: grabbing;
          }
          
          .time-slider:focus {
            outline: none;
          }
          
          /* Mobile Responsive Styles */
          @media (max-width: 768px) {
            /* Top Bar */
            .top-bar {
              padding: 0 12px !important;
              height: 50px !important;
            }
            
            .logo {
              font-size: 16px !important;
            }
            
            .top-controls {
              gap: 6px !important;
            }
            
            .icon-button {
              width: 36px !important;
              height: 36px !important;
            }
            
            /* Left Sidebar - make it smaller */
            .left-sidebar {
              left: 12px !important;
              padding: 10px 8px !important;
              min-width: 130px !important;
              gap: 4px !important;
            }
            
            .sidebar-title {
              font-size: 9px !important;
              margin-bottom: 4px !important;
            }
            
            /* Right Sidebar - Light Pollution */
            .right-sidebar {
              right: 12px !important;
              padding: 8px !important;
              width: 55px !important;
            }
            
            /* Bottom Bar */
            .bottom-bar {
              height: 55px !important;
              gap: 8px !important;
              padding: 0 12px !important;
            }
            
            .info-group-button {
              padding: 6px 10px !important;
              gap: 8px !important;
            }
            
            .info-value {
              font-size: 12px !important;
              max-width: 120px !important;
            }
            
            .info-sub-value {
              font-size: 9px !important;
            }
            
            .info-divider {
              height: 24px !important;
            }
            
            /* Time/Location Selector Panels */
            .selector-panel {
              width: 90% !important;
              max-width: 320px !important;
              bottom: 65px !important;
              padding: 12px !important;
            }
            
            /* Credits */
            .credits-button {
              bottom: 65px !important;
              left: 12px !important;
              padding: 6px 10px !important;
              font-size: 10px !important;
            }
            
            /* Credits Modal */
            .credits-modal {
              width: 92% !important;
              max-height: 70vh !important;
            }
          }
          
          @media (max-width: 480px) {
            /* Extra small screens */
            .top-bar {
              height: 45px !important;
              padding: 0 10px !important;
            }
            
            .logo {
              font-size: 14px !important;
            }
            
            .icon-button {
              width: 32px !important;
              height: 32px !important;
            }
            
            /* Hide left sidebar on very small screens, show as overlay */
            .left-sidebar {
              display: none !important;
            }
            
            /* Right sidebar smaller */
            .right-sidebar {
              right: 8px !important;
              width: 45px !important;
              padding: 6px !important;
            }
            
            .bottom-bar {
              height: 50px !important;
              gap: 6px !important;
              padding: 0 8px !important;
            }
            
            .info-group-button {
              padding: 5px 8px !important;
              gap: 6px !important;
            }
            
            .info-value {
              font-size: 11px !important;
              max-width: 90px !important;
            }
            
            .info-sub-value {
              display: none !important;
            }
            
            .powered-by {
              display: none !important;
            }
            
            .credits-button {
              bottom: 58px !important;
            }
            
            .credits-text {
              display: none !important;
            }
            
            .selector-panel {
              width: 95% !important;
              bottom: 58px !important;
              padding: 10px !important;
            }
            
            .credits-modal {
              width: 95% !important;
              max-height: 75vh !important;
            }
          }
        `}</style>
      </Head>
      <main style={styles.container}>
      {/* Sky renderer */}
      <div style={styles.skyContainer}>
        {state.useWebGL ? (
          <SkyDome
            stars={state.stars}
            planets={state.showPlanets ? state.planets : []}
            config={skyConfig}
            horizonPoints={state.horizonPoints}
            horizonConfig={{ color: '#4a5568', opacity: 0.6 }}
            moonPosition={state.showMoon ? state.moonPosition : null}
            sunPosition={state.showSun ? state.sunPosition : null}
            constellations={state.constellations}
            constellationConfig={{ enabled: true, showNames: true, showAll: state.showConstellations }}
            deepSkyPositions={state.showDeepSky ? state.deepSkyPositions : new Map()}
            deepSkyConfig={{ enabled: state.showDeepSky, showLabels: true, showAll: state.showAllDeepSky }}
            satellitePositions={state.showSatellites ? state.satellitePositions : new Map()}
            satelliteConfig={{ enabled: state.showSatellites, showLabels: true }}
            meteorShowerRadiants={state.showMeteorShowers ? state.meteorShowerRadiants : new Map()}
            meteorShowerConfig={{ enabled: state.showMeteorShowers, showLabels: true, showInactive: false }}
            gridConfig={{ 
              showAltitude: state.showAltitudeGrid, 
              showAzimuth: state.showAzimuthGrid, 
              showEquatorial: state.showEquatorialGrid,
              altitudeColor: '#00ffff',  // Cyan for altitude lines
              azimuthColor: '#ffaa00',   // Orange for azimuth lines
              opacity: 0.5 
            }}
            // Ground panorama texture - place your equirectangular image (sky removed) in public folder
            groundTexture="/ground-panorama.png"
            showAtmosphere={state.showAtmosphere}
            showGround={state.showGround}
            lst={state.lst}
            observerLatitude={state.observer?.latitude ?? 0}
            highlightedObjectId={state.highlightedObjectId}
            cameraTarget={state.cameraTarget}
            onCloseHighlight={clearHighlight}
            onStarClick={handleStarClick}
            onPlanetClick={handlePlanetClick}
            onDeepSkyClick={handleDeepSkyClick}
            onMoonClick={handleMoonClick}
            onSunClick={handleSunClick}
            onConstellationClick={handleConstellationClick}
            onCameraChange={handleCameraChange}
          />
        ) : (
          <SkyView2D
            stars={state.stars}
            planets={state.showPlanets ? state.planets : []}
            config={skyConfig}
            viewAzimuth={state.viewAzimuth}
            viewAltitude={state.viewAltitude}
            constellations={state.showConstellations ? state.constellations : []}
            moonPosition={state.showMoon ? state.moonPosition : null}
            sunPosition={state.showSun ? state.sunPosition : null}
            {...(state.showDeepSky && state.deepSkyPositions.size > 0 ? { deepSkyPositions: state.deepSkyPositions } : {})}
            {...(state.showSatellites && state.satellitePositions.size > 0 ? { satellitePositions: state.satellitePositions } : {})}
            showConstellations={state.showConstellations}
            showMoon={state.showMoon}
            showSun={state.showSun}
            showDeepSky={state.showDeepSky}
            showSatellites={state.showSatellites}
            showHorizon={true}
            showAltitudeGrid={state.showAltitudeGrid}
            showAzimuthGrid={state.showAzimuthGrid}
            lst={state.lst}
            observerLatitude={state.observer?.latitude ?? 0}
            onStarClick={handleStarClick}
            onPlanetClick={handlePlanetClick}
            onMoonClick={handleMoonClick}
            onSunClick={handleSunClick}
            onDeepSkyClick={handleDeepSkyClick}
            onConstellationClick={handleConstellationClick}
          />
        )}
      </div>

      {/* Top Bar */}
      <div style={styles.topBar} className="top-bar">
        <div style={styles.logoContainer} className="logo">
          <img src="/pie-black-logo.png" alt="PIE" style={styles.pieLogo} />
        </div>
        <div style={styles.topControls} className="top-controls">
          <button 
            onClick={toggleObjectSearch} 
            style={{...styles.iconButton, ...(state.showObjectSearch ? styles.iconButtonActive : {})}} 
            className="icon-button"
            title="Search Objects"
          >
            <SearchNormal1 size={20} color="currentColor" variant={state.showObjectSearch ? "Bold" : "Linear"} />
          </button>
          <button 
            onClick={() => setState(prev => ({ ...prev, showAuthPanel: true }))} 
            style={{...styles.iconButton, ...(state.user ? styles.iconButtonActive : {})}} 
            className="icon-button"
            title={state.user ? 'Account' : 'Sign In'}
          >
            {state.user ? (
              <UserIcon size={20} color="currentColor" variant="Bold" />
            ) : (
              <Lock1 size={20} color="currentColor" variant="Outline" />
            )}
          </button>
          <button 
            onClick={refreshCelestialBodies} 
            style={{...styles.iconButton, ...(state.isUpdating ? styles.iconButtonUpdating : {})}} 
            className="icon-button"
            title="Refresh celestial positions"
            disabled={state.isUpdating}
          >
            <Refresh2 size={20} color="currentColor" variant="Linear" style={state.isUpdating ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
          <button onClick={toggleRealTime} style={styles.iconButton} className="icon-button" title={state.isRealTime ? 'Pause' : 'Resume'}>
            {state.isRealTime ? (
              <Pause size={20} color="currentColor" variant="Bold" />
            ) : (
              <Play size={20} color="currentColor" variant="Bold" />
            )}
          </button>
          <button onClick={toggleRenderMode} style={styles.iconButton} className="icon-button" title={state.useWebGL ? '3D Mode' : '2D Mode'}>
            <Global size={20} color="currentColor" variant={state.useWebGL ? "Bold" : "Linear"} />
          </button>
        </div>
      </div>

      {/* Left Sidebar - Layer Controls */}
      <div style={styles.leftSidebar} className="left-sidebar">
        <div style={styles.sidebarTitle} className="sidebar-title">
          <Eye size={12} color="currentColor" variant="Bold" />
          <span>Layers</span>
        </div>
        
        {/* Celestial Objects Section */}
        <div style={styles.layerSection}>
          <div style={styles.layerSectionTitle}>Celestial</div>
          
          <button 
            onClick={toggleConstellations} 
            style={{...styles.layerButton, ...(state.showConstellations ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Star1 size={16} color={state.showConstellations ? "#818cf8" : "rgba(255,255,255,0.5)"} variant={state.showConstellations ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Constellations</span>
            <div style={{...styles.layerToggle, ...(state.showConstellations ? styles.layerToggleOn : {})}} />
          </button>
          
          <button 
            onClick={togglePlanets} 
            style={{...styles.layerButton, ...(state.showPlanets ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Global size={16} color={state.showPlanets ? "#f59e0b" : "rgba(255,255,255,0.5)"} variant={state.showPlanets ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Planets</span>
            <div style={{...styles.layerToggle, ...(state.showPlanets ? styles.layerToggleOn : {})}} />
          </button>
          
          <button 
            onClick={toggleMoon} 
            style={{...styles.layerButton, ...(state.showMoon ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Moon size={16} color={state.showMoon ? "#e2e8f0" : "rgba(255,255,255,0.5)"} variant={state.showMoon ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Moon</span>
            <div style={{...styles.layerToggle, ...(state.showMoon ? styles.layerToggleOn : {})}} />
          </button>
          
          <button 
            onClick={toggleSun} 
            style={{...styles.layerButton, ...(state.showSun ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Sun size={16} color={state.showSun ? "#fbbf24" : "rgba(255,255,255,0.5)"} variant={state.showSun ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Sun</span>
            <div style={{...styles.layerToggle, ...(state.showSun ? styles.layerToggleOn : {})}} />
          </button>
        </div>
        
        {/* Deep Sky Section */}
        <div style={styles.layerSection}>
          <div style={styles.layerSectionTitle}>Deep Sky</div>
          
          <button 
            onClick={toggleDeepSky} 
            style={{...styles.layerButton, ...(state.showDeepSky ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Discover size={16} color={state.showDeepSky ? "#a78bfa" : "rgba(255,255,255,0.5)"} variant={state.showDeepSky ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Messier Objects</span>
            <div style={{...styles.layerToggle, ...(state.showDeepSky ? styles.layerToggleOn : {})}} />
          </button>
          
          {state.showDeepSky && (
            <button 
              onClick={toggleAllDeepSky} 
              style={{...styles.layerSubButton, ...(state.showAllDeepSky ? styles.layerButtonActive : {})}}
              className="layer-button"
            >
              <span style={styles.layerSubIcon}>{state.showAllDeepSky ? '●' : '○'}</span>
              <span style={styles.layerLabel}>Show below horizon</span>
            </button>
          )}
        </div>
        
        {/* Tracking Section */}
        <div style={styles.layerSection}>
          <div style={styles.layerSectionTitle}>Tracking</div>
          
          <button 
            onClick={toggleSatellites} 
            style={{...styles.layerButton, ...(state.showSatellites ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Radar size={16} color={state.showSatellites ? "#22c55e" : "rgba(255,255,255,0.5)"} variant={state.showSatellites ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Satellites</span>
            <div style={{...styles.layerToggle, ...(state.showSatellites ? styles.layerToggleOn : {})}} />
          </button>
          
          <button 
            onClick={toggleMeteorShowers} 
            style={{...styles.layerButton, ...(state.showMeteorShowers ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Magicpen size={16} color={state.showMeteorShowers ? "#f472b6" : "rgba(255,255,255,0.5)"} variant={state.showMeteorShowers ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Meteor Showers</span>
            <div style={{...styles.layerToggle, ...(state.showMeteorShowers ? styles.layerToggleOn : {})}} />
          </button>
        </div>
        
        {/* Display Section */}
        <div style={styles.layerSection}>
          <div style={styles.layerSectionTitle}>Display</div>
          
          <button 
            onClick={toggleStarLabels} 
            style={{...styles.layerButton, ...(state.showStarLabels ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Text size={16} color={state.showStarLabels ? "#60a5fa" : "rgba(255,255,255,0.5)"} variant={state.showStarLabels ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Star Labels</span>
            <div style={{...styles.layerToggle, ...(state.showStarLabels ? styles.layerToggleOn : {})}} />
          </button>
          
          <button 
            onClick={toggleAltitudeGrid} 
            style={{...styles.layerButton, ...(state.showAltitudeGrid ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Grid1 size={16} color={state.showAltitudeGrid ? "#94a3b8" : "rgba(255,255,255,0.5)"} variant={state.showAltitudeGrid ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Altitude Grid</span>
            <div style={{...styles.layerToggle, ...(state.showAltitudeGrid ? styles.layerToggleOn : {})}} />
          </button>
          
          <button 
            onClick={toggleAzimuthGrid} 
            style={{...styles.layerButton, ...(state.showAzimuthGrid ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Grid1 size={16} color={state.showAzimuthGrid ? "#94a3b8" : "rgba(255,255,255,0.5)"} variant={state.showAzimuthGrid ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Azimuth Grid</span>
            <div style={{...styles.layerToggle, ...(state.showAzimuthGrid ? styles.layerToggleOn : {})}} />
          </button>
          
          <button 
            onClick={toggleEquatorialGrid} 
            style={{...styles.layerButton, ...(state.showEquatorialGrid ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Global size={16} color={state.showEquatorialGrid ? "#22d3ee" : "rgba(255,255,255,0.5)"} variant={state.showEquatorialGrid ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Equatorial Grid</span>
            <div style={{...styles.layerToggle, ...(state.showEquatorialGrid ? styles.layerToggleOn : {})}} />
          </button>
          <button 
            onClick={toggleAtmosphere} 
            style={{...styles.layerButton, ...(state.showAtmosphere ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Sun size={16} color={state.showAtmosphere ? "#22d3ee" : "rgba(255,255,255,0.5)"} variant={state.showAtmosphere ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Atmosphere</span>
            <div style={{...styles.layerToggle, ...(state.showAtmosphere ? styles.layerToggleOn : {})}} />
          </button>
          <button 
            onClick={toggleGround} 
            style={{...styles.layerButton, ...(state.showGround ? styles.layerButtonActive : {})}}
            className="layer-button"
          >
            <Discover size={16} color={state.showGround ? "#22d3ee" : "rgba(255,255,255,0.5)"} variant={state.showGround ? "Bold" : "Linear"} />
            <span style={styles.layerLabel}>Ground</span>
            <div style={{...styles.layerToggle, ...(state.showGround ? styles.layerToggleOn : {})}} />
          </button>
        </div>
      </div>

      {/* Right Sidebar - Light Pollution */}
      <div style={styles.rightSidebar} className="right-sidebar">
        {/* Vertical Slider */}
        <div style={styles.verticalSliderWrapper}>
          {/* City icon at top (high pollution) */}
          <div style={styles.sliderIconTop}>
            <Building size={16} color="rgba(255,255,255,0.4)" variant="Bold" />
          </div>
          
          {/* Slider track with native range input */}
          <div style={styles.verticalSliderContainer}>
            <div style={styles.verticalSliderTrack}>
              {/* Fill from bottom */}
              <div 
                style={{
                  ...styles.verticalSliderFill,
                  height: `${((9 - state.lightPollution) / 8) * 100}%`,
                }}
              />
            </div>
            {/* Native range input - rotated */}
            <input
              type="range"
              min="1"
              max="9"
              step="1"
              value={10 - state.lightPollution}
              onChange={(e) => handleLightPollutionChange(10 - parseInt(e.target.value))}
              className="light-pollution-slider"
              style={styles.verticalRangeInput}
            />
          </div>
          
          {/* Stars icon at bottom (dark sky) */}
          <div style={styles.sliderIconBottom}>
            <Star1 size={16} color="rgba(255,255,255,0.4)" variant="Bold" />
          </div>
        </div>
        
        {/* Bortle info */}
        <div style={styles.bortleInfo}>
          <div style={styles.bortleValue}>{state.lightPollution}</div>
          <div style={styles.bortleDesc}>{getBortleDescription(state.lightPollution)}</div>
        </div>
      </div>

      {/* Object Search Panel */}
      {state.showObjectSearch && (
        <div style={styles.objectSearchPanel} className="selector-panel object-search">
          <div style={styles.objectSearchHeader}>
            <SearchNormal1 size={18} color="#6366f1" variant="Bold" />
            <input
              type="text"
              placeholder="Search stars, planets, constellations..."
              value={state.objectSearchQuery}
              onChange={(e) => searchObjects(e.target.value)}
              style={styles.objectSearchInput}
              autoFocus
            />
            <button onClick={toggleObjectSearch} style={styles.closeSearchButton}>×</button>
          </div>
          
          {state.objectSearchResults.length > 0 && (
            <div style={styles.objectSearchResults}>
              {state.objectSearchResults.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  onClick={() => selectSearchResult(result)}
                  style={styles.objectSearchResultItem}
                >
                  <span style={styles.objectTypeIcon}>
                    {result.type === 'star' && '⭐'}
                    {result.type === 'planet' && '🪐'}
                    {result.type === 'constellation' && '✨'}
                    {result.type === 'deepsky' && '🌌'}
                    {result.type === 'satellite' && '🛰️'}
                    {result.type === 'moon' && '🌙'}
                    {result.type === 'sun' && '☀️'}
                  </span>
                  <div style={styles.objectResultInfo}>
                    <span style={styles.objectResultName}>{result.name}</span>
                    <span style={styles.objectResultType}>
                      {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                      {result.magnitude !== undefined && ` • mag ${result.magnitude.toFixed(1)}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {state.objectSearchQuery && state.objectSearchResults.length === 0 && (
            <div style={styles.noResults}>No objects found</div>
          )}
        </div>
      )}

      {/* Time Selector Panel */}
      {state.showTimeSelector && (
        <div style={styles.timeSelectorPanel} className="selector-panel time-selector">
          <div style={styles.timeSelectorHeader}>
            <div style={styles.timeSelectorTitle}>
              <Calendar size={16} color="#6366f1" variant="Bold" />
              <span>Time Travel</span>
            </div>
            <button onClick={resetToNow} style={styles.resetButton} title="Reset to Now">
              <Refresh size={16} color="currentColor" />
              <span>Now</span>
            </button>
          </div>
          
          {/* Date Controls */}
          <div style={styles.timeControlGroup}>
            <span style={styles.timeControlLabel}>Date</span>
            <div style={styles.timeControlRow}>
              <button onClick={() => adjustDate(-1)} style={styles.timeAdjustButton}>
                <ArrowLeft2 size={16} color="currentColor" />
              </button>
              <input
                type="date"
                value={state.selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    const newDate = new Date(e.target.value + 'T' + state.selectedDate.toTimeString().slice(0, 8));
                    setSelectedTime(newDate);
                  }
                }}
                style={styles.dateInput}
              />
              <button onClick={() => adjustDate(1)} style={styles.timeAdjustButton}>
                <ArrowRight2 size={16} color="currentColor" />
              </button>
            </div>
          </div>
          
          {/* Time Slider */}
          <div style={styles.timeControlGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={styles.timeControlLabel}>Time</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#818cf8' }}>
                {String(state.selectedDate.getHours()).padStart(2, '0')}:{String(state.selectedDate.getMinutes()).padStart(2, '0')}
              </span>
            </div>
            <div style={styles.timeSliderContainer}>
              <input
                type="range"
                min="0"
                max="1439"
                value={state.selectedDate.getHours() * 60 + state.selectedDate.getMinutes()}
                onChange={(e) => handleTimeSliderChange(parseInt(e.target.value, 10))}
                onMouseUp={handleTimeSliderRelease}
                onTouchEnd={handleTimeSliderRelease}
                style={styles.timeSlider}
                className="time-slider"
              />
              <div style={styles.timeSliderMarks}>
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>
          </div>
          
          {/* Quick Jump Buttons */}
          <div style={styles.quickJumpRow}>
            <button onClick={() => adjustTime(-6)} style={styles.quickJumpButton}>-6h</button>
            <button onClick={() => adjustTime(-1)} style={styles.quickJumpButton}>-1h</button>
            <button onClick={() => adjustTime(1)} style={styles.quickJumpButton}>+1h</button>
            <button onClick={() => adjustTime(6)} style={styles.quickJumpButton}>+6h</button>
          </div>
          
          {/* Status */}
          <div style={styles.timeStatus}>
            {state.isRealTime ? (
              <span style={styles.timeStatusLive}>● Live</span>
            ) : (
              <span style={styles.timeStatusCustom}>
                <Clock size={12} color="currentColor" />
                {state.selectedDate.toLocaleDateString()} {state.selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Location Selector Panel */}
      {state.showLocationSelector && (
        <div style={styles.locationSelectorPanel} className="selector-panel location-selector">
          {/* Search Input with GPS button */}
          <div style={styles.locationSearchRow}>
            <div style={styles.locationSearchContainer}>
              <SearchNormal1 size={16} color="rgba(255,255,255,0.4)" />
              <input
                type="text"
                placeholder="Search city or place..."
                value={state.locationSearchQuery}
                onChange={(e) => {
                  setState(prev => ({ ...prev, locationSearchQuery: e.target.value }));
                  searchLocation(e.target.value);
                }}
                style={styles.locationSearchInput}
              />
            </div>
            <button onClick={useCurrentLocation} style={styles.gpsButton} title="Use current GPS location">
              <Gps size={18} color="currentColor" />
            </button>
          </div>
          
          {/* Search Results */}
          {state.locationSearchResults.length > 0 && (
            <div style={styles.locationResults}>
              {state.locationSearchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => selectLocation(result.lat, result.lon, result.name)}
                  style={styles.locationResultItem}
                >
                  <Location size={14} color="rgba(255,255,255,0.5)" />
                  <span style={styles.locationResultText}>{result.name}</span>
                </button>
              ))}
            </div>
          )}
          
          {/* Manual Coordinates - inline */}
          <div style={styles.coordsInputRow}>
            <input
              type="number"
              placeholder="Latitude"
              step="0.0001"
              id="lat-input"
              style={styles.coordInput}
            />
            <input
              type="number"
              placeholder="Longitude"
              step="0.0001"
              id="lon-input"
              style={styles.coordInput}
            />
            <button 
              onClick={() => {
                const latInput = document.getElementById('lat-input') as HTMLInputElement;
                const lonInput = document.getElementById('lon-input') as HTMLInputElement;
                const lat = parseFloat(latInput?.value || '0');
                const lon = parseFloat(lonInput?.value || '0');
                if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
                  selectLocation(lat, lon);
                }
              }}
              style={styles.goButton}
            >
              Go
            </button>
          </div>
        </div>
      )}

      {/* Bottom Bar - Info */}
      <div style={styles.bottomBar} className="bottom-bar">
        {/* Time Group with Toggle */}
        <button 
          onClick={toggleTimeSelector} 
          style={{...styles.infoGroupButton, ...(state.showTimeSelector ? styles.infoGroupButtonActive : {})}}
          className="info-group-button"
        >
          <Clock size={16} color={state.showTimeSelector ? "#818cf8" : "rgba(255,255,255,0.5)"} variant={state.showTimeSelector ? "Bold" : "Linear"} />
          <div style={styles.infoGroupContent}>
            <span style={styles.infoValue} className="info-value">
              {displayTime.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false 
              })}
            </span>
            <span style={styles.infoSubValue} className="info-sub-value">
              {displayTime.toLocaleDateString([], { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </span>
          </div>
        </button>
        
        <div style={styles.infoDivider} className="info-divider" />
        
        {/* Location Group with Toggle */}
        <button 
          onClick={toggleLocationSelector} 
          style={{...styles.infoGroupButton, ...(state.showLocationSelector ? styles.infoGroupButtonActive : {})}}
          className="info-group-button"
        >
          <Location size={16} color={state.showLocationSelector ? "#818cf8" : "rgba(255,255,255,0.5)"} variant={state.showLocationSelector ? "Bold" : "Linear"} />
          <div style={styles.infoGroupContent}>
            <span style={styles.infoValue} className="info-value">
              {state.locationName || (state.observer 
                ? `${state.observer.latitude.toFixed(2)}°, ${state.observer.longitude.toFixed(2)}°`
                : 'Unknown')}
            </span>
            <span style={styles.infoSubValue} className="info-sub-value">
              {state.locationStatus === 'granted' ? 'GPS' : state.locationStatus === 'default' ? 'Default' : 'Loading...'}
            </span>
          </div>
        </button>
        
        <div style={styles.infoDivider} className="info-divider" />
        
        {/* Powered by Sky Guild */}
        <a href="https://www.skyguild.club" target="_blank" rel="noopener noreferrer" style={styles.poweredBy} className="powered-by">
          <span style={styles.poweredByText}>Powered by</span>
          <img src="/SkyGuild_Logo.png" alt="Sky Guild" style={styles.poweredByLogo} />
        </a>
      </div>



      {/* Data Credits - Bottom Left */}
      <button onClick={toggleCredits} style={styles.creditsButtonFixed} className="credits-button" title="Data Credits">
        <InfoCircle size={14} color="currentColor" variant="Linear" />
        <span className="credits-text">Data Credits</span>
      </button>

      {/* Credits Modal */}
      {state.showCredits && (
        <div style={styles.modalOverlay} onClick={toggleCredits}>
          <div style={styles.creditsModal} className="credits-modal" onClick={(e) => e.stopPropagation()}>
            <div style={styles.creditsHeader}>
              <h2 style={styles.creditsTitle}>Data Credits</h2>
              <button onClick={toggleCredits} style={styles.closeButton}>×</button>
            </div>
            
            <div style={styles.creditsContent}>
              <div style={styles.creditSection}>
                <h3 style={styles.creditSectionTitle}>Star Catalog</h3>
                <p style={styles.creditText}>
                  Hipparcos Catalogue (ESA, 1997) - 118,218 stars with high-precision positions and magnitudes
                </p>
                <a href="https://www.cosmos.esa.int/web/hipparcos" target="_blank" rel="noopener noreferrer" style={styles.creditLink}>
                  ESA Hipparcos Mission →
                </a>
              </div>
              
              <div style={styles.creditSection}>
                <h3 style={styles.creditSectionTitle}>Constellation Data</h3>
                <p style={styles.creditText}>
                  IAU Constellation boundaries and star patterns from the International Astronomical Union
                </p>
                <a href="https://www.iau.org/public/themes/constellations/" target="_blank" rel="noopener noreferrer" style={styles.creditLink}>
                  IAU Constellations →
                </a>
              </div>
              
              <div style={styles.creditSection}>
                <h3 style={styles.creditSectionTitle}>Deep Sky Objects</h3>
                <p style={styles.creditText}>
                  Messier Catalog - 110 deep sky objects including galaxies, nebulae, and star clusters
                </p>
                <a href="https://www.messier.seds.org/" target="_blank" rel="noopener noreferrer" style={styles.creditLink}>
                  SEDS Messier Database →
                </a>
              </div>
              
              <div style={styles.creditSection}>
                <h3 style={styles.creditSectionTitle}>Planetary Positions</h3>
                <p style={styles.creditText}>
                  Astronomical calculations using VSOP87 theory and SunCalc library for Sun/Moon positions
                </p>
                <a href="https://github.com/mourner/suncalc" target="_blank" rel="noopener noreferrer" style={styles.creditLink}>
                  SunCalc Library →
                </a>
              </div>
              
              <div style={styles.creditSection}>
                <h3 style={styles.creditSectionTitle}>Satellite Tracking</h3>
                <p style={styles.creditText}>
                  ISS and satellite positions from CelesTrak and Where The ISS At API
                </p>
                <a href="https://celestrak.org/" target="_blank" rel="noopener noreferrer" style={styles.creditLink}>
                  CelesTrak →
                </a>
              </div>
              
              <div style={styles.creditSection}>
                <h3 style={styles.creditSectionTitle}>Geocoding</h3>
                <p style={styles.creditText}>
                  Location search powered by OpenStreetMap Nominatim
                </p>
                <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" style={styles.creditLink}>
                  OpenStreetMap Nominatim →
                </a>
              </div>
            </div>
            
            <div style={styles.creditsFooter}>
              <p style={styles.creditsFooterText}>
                Built with ❤️ by Sky Guild
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading Progress Indicator - shows while loading more stars on zoom */}
      {state.isLoadingMoreStars && (
        <div style={styles.loadingIndicator}>
          <div style={styles.loadingIndicatorContent}>
            <div style={styles.miniSpinner} />
            <span>Loading more stars...</span>
          </div>
        </div>
      )}

      {/* Update Status Indicator */}
      {state.isUpdating && !state.isLoading && (
        <div style={styles.updateIndicator}>
          <div style={styles.updateSpinner} />
          <span>Updating positions...</span>
        </div>
      )}

      {/* WebGL fallback notice */}
      {!state.useWebGL && (
        <div style={styles.fallbackNotice}>
          2D Mode Active
        </div>
      )}

      {/* Auth Panel */}
      {state.showAuthPanel && (
        <AuthPanel onClose={() => setState(prev => ({ ...prev, showAuthPanel: false }))} />
      )}

      {/* Object Detail Panel */}
      {state.selectedObject && state.observer && (
        <ObjectDetailPanel
          object={state.selectedObject}
          location={state.observer}
          onClose={() => setState(prev => ({ ...prev, selectedObject: null }))}
        />
      )}
    </main>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    margin: 0,
    padding: 0,
    background: 'linear-gradient(to bottom, #000814 0%, #001d3d 50%, #000814 100%)',
    position: 'fixed',
    top: 0,
    left: 0,
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  skyContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  
  // Loading Screen with Progress Bar
  loadingScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '24px',
  },
  loadingLogo: {
    fontSize: '48px',
    fontWeight: 600,
    color: '#ffffff',
    letterSpacing: '2px',
    marginBottom: '8px',
  },
  loadingTitle: {
    fontSize: '18px',
    fontWeight: 400,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: '0.5px',
  },
  progressContainer: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
    borderRadius: '4px',
    transition: 'width 0.3s ease-out',
  },
  progressText: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  loadingHint: {
    fontSize: '13px',
    fontWeight: 400,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '8px',
  },
  
  loading: {
    color: '#ffffff',
    fontSize: '18px',
    textAlign: 'center',
    paddingTop: '100px',
    fontWeight: 300,
  },
  error: {
    color: '#ff6b6b',
    fontSize: '16px',
    textAlign: 'center',
    paddingTop: '100px',
    fontWeight: 300,
  },
  
  // Top Bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    background: 'linear-gradient(180deg, rgba(0, 8, 20, 0.95) 0%, rgba(0, 8, 20, 0) 100%)',
    backdropFilter: 'blur(10px)',
    zIndex: 100,
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pieLogo: {
    height: '32px',
    width: 'auto',
    filter: 'invert(1)', // Invert black logo to white for dark background
  },
  logo: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#ffffff',
    letterSpacing: '0.5px',
  },
  topControls: {
    display: 'flex',
    gap: '8px',
  },
  iconButton: {
    width: '40px',
    height: '40px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
  },
  iconButtonUpdating: {
    animation: 'rotate 1s linear infinite',
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  iconButtonActive: {
    background: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
  },
  
  // Left Sidebar - Layers
  leftSidebar: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    background: 'rgba(0, 8, 20, 0.9)',
    backdropFilter: 'blur(20px)',
    padding: '12px',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    zIndex: 50,
    minWidth: '170px',
    maxHeight: 'calc(100vh - 180px)',
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '6px',
    paddingLeft: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  layerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    marginBottom: '8px',
  },
  layerSectionTitle: {
    fontSize: '9px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '4px 8px 2px',
  },
  layerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.7)',
    padding: '8px 10px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  },
  layerSubButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    padding: '6px 10px 6px 28px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  },
  layerSubIcon: {
    fontSize: '8px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  layerButtonActive: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
  },
  layerIcon: {
    fontSize: '14px',
    width: '18px',
    textAlign: 'center',
  },
  layerLabel: {
    fontSize: '12px',
    fontWeight: 500,
    flex: 1,
  },
  layerToggle: {
    width: '28px',
    height: '16px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    transition: 'all 0.2s ease',
  },
  layerToggleOn: {
    background: 'rgba(99, 102, 241, 0.5)',
  },
  
  // Right Sidebar - Light Pollution
  rightSidebar: {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(0, 8, 20, 0.6)',
    backdropFilter: 'blur(12px)',
    padding: '12px 10px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    zIndex: 50,
    width: '70px',
  },
  verticalSliderWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  sliderIconTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  sliderIconBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  verticalSliderContainer: {
    position: 'relative',
    width: '32px',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalSliderTrack: {
    position: 'absolute',
    width: '4px',
    height: '100px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  verticalSliderFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    background: 'rgba(99, 102, 241, 0.6)',
    borderRadius: '2px',
    transition: 'height 0.1s ease',
    pointerEvents: 'none',
  },
  verticalRangeInput: {
    width: '100px',
    height: '32px',
    transform: 'rotate(-90deg)',
    cursor: 'pointer',
    background: 'transparent',
    margin: 0,
    padding: 0,
  },
  bortleInfo: {
    textAlign: 'center',
  },
  bortleValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bortleDesc: {
    fontSize: '9px',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: '1px',
    width: '50px',
    textAlign: 'center',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  lightPollutionStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statLabel: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    flex: 1,
  },
  statValue: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#ffffff',
  },
  
  // Object Search Panel
  objectSearchPanel: {
    position: 'absolute',
    top: '70px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 8, 20, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '12px',
    zIndex: 120,
    width: '360px',
    maxWidth: '90vw',
  },
  objectSearchHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  objectSearchInput: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
  },
  closeSearchButton: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  objectSearchResults: {
    marginTop: '12px',
    maxHeight: '300px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  objectSearchResultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s ease',
  },
  objectTypeIcon: {
    fontSize: '20px',
  },
  objectResultInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  objectResultName: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
  },
  objectResultType: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '11px',
  },
  noResults: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '13px',
    textAlign: 'center',
    padding: '16px',
  },
  
  // Time Selector Panel
  timeSelectorPanel: {
    position: 'absolute',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 8, 20, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '16px',
    zIndex: 110,
    minWidth: '280px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  timeSelectorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeSelectorTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
  },
  resetButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '8px',
    padding: '6px 10px',
    color: '#818cf8',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  timeControlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  timeControlLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  timeControlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  timeAdjustButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  dateInput: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#ffffff',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    colorScheme: 'dark',
  },
  timeInput: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#ffffff',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    colorScheme: 'dark',
  },
  quickJumpRow: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  quickJumpButton: {
    padding: '6px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  timeStatus: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  timeStatusLive: {
    color: '#22c55e',
    fontSize: '12px',
    fontWeight: 500,
  },
  timeStatusCustom: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#f59e0b',
    fontSize: '12px',
    fontWeight: 500,
  },
  timeToggleButton: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  timeToggleButtonActive: {
    background: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    color: '#818cf8',
  },
  
  // Location Selector Panel
  locationSelectorPanel: {
    position: 'absolute',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 8, 20, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '12px',
    zIndex: 110,
    width: '340px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  locationSearchRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  gpsButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    background: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '8px',
    color: '#22c55e',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  locationSearchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '10px 12px',
    flex: 1,
  },
  locationSearchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  locationResults: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '150px',
    overflowY: 'auto',
  },
  locationResultItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#ffffff',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
  },
  locationResultText: {
    flex: 1,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  coordsInputRow: {
    display: 'flex',
    gap: '8px',
  },
  coordInput: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#ffffff',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: 0,
  },
  goButton: {
    background: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    borderRadius: '8px',
    padding: '10px 16px',
    color: '#818cf8',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  
  // Bottom Bar - Info
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    background: 'linear-gradient(0deg, rgba(0, 8, 20, 0.95) 0%, rgba(0, 8, 20, 0) 100%)',
    backdropFilter: 'blur(10px)',
    zIndex: 100,
    padding: '0 20px',
  },
  infoGroupButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '8px 14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  infoGroupButtonActive: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
  },
  infoGroupContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1px',
  },
  infoGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    minWidth: '100px',
    maxWidth: '180px',
  },
  infoLabel: {
    fontSize: '9px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  infoValue: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px',
  },
  infoSubValue: {
    fontSize: '10px',
    fontWeight: 400,
    color: 'rgba(255, 255, 255, 0.5)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px',
  },
  infoDivider: {
    width: '1px',
    height: '32px',
    background: 'rgba(255, 255, 255, 0.1)',
  },
  poweredBy: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.2s ease',
  },
  poweredByText: {
    fontSize: '10px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  poweredByLogo: {
    height: '24px',
    width: 'auto',
    objectFit: 'contain',
  },
  creditsButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  creditsButtonFixed: {
    position: 'absolute',
    bottom: '70px',
    left: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(0, 8, 20, 0.6)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    zIndex: 50,
  },
  
  // Credits Modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
  },
  creditsModal: {
    background: 'rgba(10, 15, 30, 0.98)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  creditsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  creditsTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    margin: 0,
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  creditsContent: {
    padding: '16px 20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  creditSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  creditSectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#818cf8',
    margin: 0,
  },
  creditText: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: 0,
    lineHeight: 1.5,
  },
  creditLink: {
    fontSize: '11px',
    color: 'rgba(99, 102, 241, 0.8)',
    textDecoration: 'none',
  },
  creditsFooter: {
    padding: '12px 20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
  },
  creditsFooterText: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    margin: 0,
  },
  
  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 8, 20, 0.8)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    zIndex: 200,
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTop: '3px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  
  // Fallback Notice
  fallbackNotice: {
    position: 'absolute',
    top: '70px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(255, 193, 7, 0.15)',
    border: '1px solid rgba(255, 193, 7, 0.3)',
    color: '#ffc107',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    backdropFilter: 'blur(10px)',
    zIndex: 90,
  },
  
  // Update Status Indicator
  updateIndicator: {
    position: 'absolute',
    top: '70px',
    right: '20px',
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#818cf8',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    backdropFilter: 'blur(10px)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  updateSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(129, 140, 248, 0.2)',
    borderTop: '2px solid #818cf8',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  
  // Non-blocking loading indicator
  loadingIndicator: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    background: 'rgba(0, 0, 0, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'rgba(255, 255, 255, 0.9)',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 500,
    backdropFilter: 'blur(10px)',
    zIndex: 100,
    minWidth: '160px',
  },
  loadingIndicatorContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  miniSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    borderTop: '2px solid #22d3ee',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  miniProgressBar: {
    width: '100%',
    height: '4px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #22d3ee, #6366f1)',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  
  // Time Slider Styles
  timeSliderContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '4px 0',
  },
  timeSlider: {
    width: '100%',
    height: '6px',
    WebkitAppearance: 'none',
    appearance: 'none',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    outline: 'none',
    cursor: 'pointer',
  },
  timeSliderMarks: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9px',
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: 500,
    padding: '0 2px',
  },
};
