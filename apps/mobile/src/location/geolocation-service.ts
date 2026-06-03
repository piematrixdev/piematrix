/**
 * Geolocation Service using expo-location
 * Handles GPS location retrieval with manual entry fallback
 */

import * as Location from 'expo-location';
import { GeographicCoordinates } from '@virtual-window/astronomy-engine';

export type LocationStatus = 'pending' | 'granted' | 'denied' | 'manual' | 'default';

export interface LocationError {
  type: 'permission_denied' | 'timeout' | 'unavailable';
  message: string;
}

export interface GeolocationServiceConfig {
  timeout?: number;
  maxRetries?: number;
  onError?: (error: LocationError) => void;
  onStatusChange?: (status: LocationStatus) => void;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export class GeolocationService {
  private coordinates: GeographicCoordinates | null = null;
  private status: LocationStatus = 'pending';
  private config: Required<GeolocationServiceConfig>;

  constructor(config: GeolocationServiceConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 10000,
      maxRetries: config.maxRetries ?? 3,
      onError: config.onError ?? (() => {}),
      onStatusChange: config.onStatusChange ?? (() => {}),
    };
  }

  async requestLocation(): Promise<GeographicCoordinates> {
    this.setStatus('pending');

    // Request permission via expo-location
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      this.setStatus('denied');
      this.config.onError({
        type: 'permission_denied',
        message: 'Location permission denied. Please enable in device settings.',
      });
      return this.getDefaultCoordinates();
    }

    // Try to get location with retries
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: this.config.timeout,
        });

        this.coordinates = {
          latitude: roundCoordinate(location.coords.latitude),
          longitude: roundCoordinate(location.coords.longitude),
        };
        this.setStatus('granted');
        return this.coordinates;
      } catch {
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(1000 * (attempt + 1));
        } else {
          this.config.onError({
            type: 'timeout',
            message: 'Could not get GPS location after multiple attempts.',
          });
        }
      }
    }

    return this.getDefaultCoordinates();
  }

  setManualLocation(latitude: number, longitude: number): GeographicCoordinates | null {
    if (!isValidLatitude(latitude)) {
      this.config.onError({
        type: 'unavailable',
        message: 'Latitude must be between -90 and +90 degrees',
      });
      return null;
    }
    if (!isValidLongitude(longitude)) {
      this.config.onError({
        type: 'unavailable',
        message: 'Longitude must be between -180 and +180 degrees',
      });
      return null;
    }

    this.coordinates = {
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
    };
    this.setStatus('manual');
    return this.coordinates;
  }

  private getDefaultCoordinates(): GeographicCoordinates {
    this.coordinates = { latitude: 0, longitude: 0 };
    this.setStatus('default');
    this.config.onError({
      type: 'unavailable',
      message: 'Location unknown - showing equatorial sky',
    });
    return this.coordinates;
  }

  getCoordinates(): GeographicCoordinates | null {
    return this.coordinates ? { ...this.coordinates } : null;
  }

  getStatus(): LocationStatus {
    return this.status;
  }

  isUsingDefault(): boolean {
    return this.status === 'default';
  }

  isManualEntry(): boolean {
    return this.status === 'manual';
  }

  private setStatus(status: LocationStatus): void {
    this.status = status;
    this.config.onStatusChange(status);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default GeolocationService;
