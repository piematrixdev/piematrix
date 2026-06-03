/**
 * Astronomy Engine - Core Types and Interfaces
 *
 * This package contains all celestial coordinate calculations and transformations
 * for the Virtual Window stargazing application. It has zero platform-specific
 * dependencies and can be imported by both Next.js and React Native apps.
 */

/**
 * Geographic coordinates representing a position on Earth.
 */
export interface GeographicCoordinates {
  /** Latitude in degrees (-90 to +90) */
  latitude: number;
  /** Longitude in degrees (-180 to +180) */
  longitude: number;
}

/**
 * Celestial coordinates using the equatorial coordinate system.
 */
export interface CelestialCoordinates {
  /** Right Ascension: 0-24 hours or 0-360 degrees */
  ra: number;
  /** Declination: -90 to +90 degrees */
  dec: number;
}

/**
 * Horizontal coordinates relative to the observer's local horizon.
 */
export interface HorizontalCoordinates {
  /** Azimuth: 0-360 degrees, clockwise from north */
  azimuth: number;
  /** Altitude: -90 to +90 degrees (negative = below horizon) */
  altitude: number;
}

/**
 * Spectral classification of stars based on their temperature.
 * O (hottest/blue) → M (coolest/red)
 */
export type SpectralType = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

/**
 * Represents a star in the star catalog.
 */
export interface Star {
  /** Unique identifier (e.g., HIP number) */
  id: string;
  /** Common name (e.g., "Sirius", "Vega") or null if unnamed */
  name: string | null;
  /** Right Ascension in decimal hours (0-24) */
  ra: number;
  /** Declination in degrees (-90 to +90) */
  dec: number;
  /** Apparent magnitude (lower = brighter) */
  magnitude: number;
  /** Spectral classification */
  spectralType: SpectralType;
}

/**
 * Represents a planet in the solar system.
 */
export interface Planet {
  /** Planet identifier */
  id: string;
  /** Planet name */
  name: string;
  /** Current Right Ascension in decimal hours (computed dynamically) */
  ra: number;
  /** Current Declination in degrees (computed dynamically) */
  dec: number;
  /** Current apparent magnitude */
  magnitude: number;
}


// LST Calculator exports
export {
  calculateLST,
  lstToUTC,
  lstCalculator,
  type LSTCalculator,
} from './lst-calculator';

// Coordinate Converter exports
export {
  celestialToHorizontal,
  horizontalToCelestial,
  raHoursToDegrees,
  raDegreesToHours,
  coordinateConverter,
  type CoordinateConverter,
} from './coordinate-converter';

// Geographic Validation exports
export {
  isValidLatitude,
  isValidLongitude,
  isValidGeographicCoordinates,
  validateAndNormalizeCoordinates,
  roundToDecimalPlaces,
  geoValidator,
  type GeoValidator,
} from './geo-validation';

// Star Catalog exports
export {
  createStarCatalog,
  createDefaultStarCatalog,
  defaultStarCatalogConfig,
  type StarCatalog,
  type StarCatalogConfig,
} from './star-catalog';

// Planet Calculator exports
export {
  createPlanetCalculator,
  planetCalculator,
  type PlanetCalculator,
} from './planet-calculator';

// Time Controller exports
export {
  createTimeController,
  timeController,
  type TimeController,
} from './time-controller';

// Time Slider Logic exports
export {
  createTimeSliderState,
  dateToSliderValue,
  sliderValueToDate,
  formatDateTime,
  formatDateShort,
  formatTime,
  constrainDate,
  isDateInRange,
  timeSliderReducer,
  type TimeSliderState,
  type TimeSliderConfig,
  type TimeSliderAction,
} from './time-slider-logic';

// Sky Calculator exports
export {
  createSkyCalculator,
  SkyCalculator,
  type SkyCalculatorConfig,
  type SkyPositions,
} from './sky-calculator';

// Horizon Line exports
export {
  createHorizonLine,
  type HorizonLine,
  type HorizonLineConfig,
  type HorizonPoint,
} from './horizon-line';

// Moon Calculator exports
export {
  createMoonCalculator,
  moonCalculator,
  type MoonCalculator,
  type MoonPosition,
  type LunarPhaseName,
} from './moon-calculator';

// Sun Calculator exports
export {
  createSunCalculator,
  sunCalculator,
  type SunCalculator,
  type SunPosition,
  type SkyStatus,
} from './sun-calculator';


// Constellation Renderer exports
export {
  createConstellationRenderer,
  constellationRenderer,
  type ConstellationRenderer,
  type ConstellationRendererConfig,
  type Constellation,
  type ConstellationLine,
  type ConstellationStar,
  type ConstellationLineSegment,
} from './constellation-renderer';

// Deep Sky Catalog exports
export {
  createDeepSkyCatalog,
  deepSkyCatalog,
  type DeepSkyCatalog,
  type DeepSkyCatalogConfig,
  type DeepSkyObject,
  type DeepSkyObjectType,
  type DeepSkyPosition,
} from './deep-sky-catalog';

// Satellite Tracker exports
export {
  createSatelliteTracker,
  satelliteTracker,
  type SatelliteTracker,
  type SatelliteTrackerConfig,
  type SatellitePosition,
  type SatelliteTrackerError,
  type TLEData,
} from './satellite-tracker';

// Meteor Shower Catalog exports
export {
  createMeteorShowerCatalog,
  meteorShowerCatalog,
  type MeteorShowerCatalog,
  type MeteorShower,
  type MeteorShowerPosition,
} from './meteor-shower-catalog';

// Star Catalog API exports
export {
  StarCatalogAPI,
  SimbadStarService,
  HipparcosStaticService,
  starCatalogAPI,
  type StarData,
  type StarQueryOptions,
} from './star-api';

// Atmospheric Refraction exports
export {
  refractionCorrection,
  applyRefraction,
  removeRefraction,
} from './refraction';

// Saturn Ring Tilt exports
export {
  getSaturnRingTilt,
  getSaturnRingTiltRad,
  type SaturnRingInfo,
} from './saturn-rings';
