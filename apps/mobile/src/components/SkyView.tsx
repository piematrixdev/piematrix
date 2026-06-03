/**
 * SkyView Component
 * Renders stars and planets as SVG circles using react-native-svg
 */

import React, { useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Dimensions, GestureResponderEvent } from 'react-native';
import Svg, { Circle, Text as SvgText, G, Polyline, Line, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Star, Planet, HorizontalCoordinates, SpectralType, HorizonPoint, MoonPosition, SunPosition, LunarPhaseName, ConstellationLineSegment, DeepSkyPosition, DeepSkyObjectType, SatellitePosition, SatelliteTrackerError, MeteorShowerPosition } from '@virtual-window/astronomy-engine';
import {
  magnitudeToRadius,
  spectralTypeToColor,
  horizontalToScreen,
  shouldShowLabel,
  getMagnitudeThreshold,
  constrainFov,
} from '../rendering/render-utils';

export interface RenderableStar {
  id: string;
  name: string | null;
  screenX: number;
  screenY: number;
  radius: number;
  color: string;
  magnitude: number;
  isVisible: boolean;
}

export interface RenderablePlanet {
  id: string;
  name: string;
  screenX: number;
  screenY: number;
  magnitude: number;
  isVisible: boolean;
  symbol: string;
}

export interface SkyViewConfig {
  fov: number;
  maxMagnitude: number;
  showLabels: boolean;
  labelMagnitudeThreshold: number;
}

export interface SkyViewProps {
  stars: Star[];
  planets: Planet[];
  starPositions: Map<string, HorizontalCoordinates>;
  planetPositions: Map<string, HorizontalCoordinates>;
  viewCenter: HorizontalCoordinates;
  config: SkyViewConfig;
  horizonPoints?: HorizonPoint[];
  horizonConfig?: {
    color?: string;
    opacity?: number;
    strokeWidth?: number;
  };
  moonPosition?: MoonPosition | null;
  sunPosition?: SunPosition | null;
  constellationLines?: ConstellationLineSegment[];
  constellationConfig?: {
    enabled?: boolean;
    lineColor?: string;
    lineOpacity?: number;
    lineWidth?: number;
    showNames?: boolean;
    nameColor?: string;
  };
  deepSkyPositions?: Map<string, DeepSkyPosition>;
  deepSkyConfig?: {
    enabled?: boolean;
    showLabels?: boolean;
  };
  satellitePositions?: Map<string, SatellitePosition | SatelliteTrackerError>;
  meteorShowerRadiants?: Map<string, MeteorShowerPosition>;
  satelliteConfig?: {
    enabled?: boolean;
    showLabels?: boolean;
  };
  meteorShowerConfig?: {
    enabled?: boolean;
    showLabels?: boolean;
    showInactive?: boolean;  // Whether to show inactive showers
  };
  onStarPress?: (star: Star) => void;
  onPlanetPress?: (planet: Planet) => void;
  onFovChange?: (fov: number) => void;
}

// Planet symbols for distinct rendering
const PLANET_SYMBOLS: Record<string, string> = {
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
};

// Moon phase emoji mapping
const MOON_PHASE_EMOJIS: Record<LunarPhaseName, string> = {
  'New Moon': '🌑',
  'Waxing Crescent': '🌒',
  'First Quarter': '🌓',
  'Waxing Gibbous': '🌔',
  'Full Moon': '🌕',
  'Waning Gibbous': '🌖',
  'Last Quarter': '🌗',
  'Waning Crescent': '🌘',
};

// Deep sky object type icons
const DEEP_SKY_ICONS: Record<DeepSkyObjectType, string> = {
  'Galaxy': '🌀',
  'Nebula': '☁️',
  'Open Cluster': '✨',
  'Globular Cluster': '⭐',
  'Planetary Nebula': '💫',
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SkyView: React.FC<SkyViewProps> = ({
  stars,
  planets,
  starPositions,
  planetPositions,
  viewCenter,
  config,
  horizonPoints,
  horizonConfig,
  moonPosition,
  sunPosition,
  constellationLines,
  constellationConfig,
  deepSkyPositions,
  deepSkyConfig,
  satellitePositions,
  meteorShowerRadiants,
  satelliteConfig,
  meteorShowerConfig,
  onStarPress,
  onPlanetPress,
  onFovChange,
}) => {
  const lastPinchDistance = useRef<number | null>(null);
  const currentFov = useRef(config.fov);
  
  // Constrain FOV to valid range
  const fov = constrainFov(config.fov);
  const magnitudeThreshold = getMagnitudeThreshold(fov);
  
  // Compute renderable stars
  const renderableStars = useMemo((): RenderableStar[] => {
    const result: RenderableStar[] = [];
    
    for (const star of stars) {
      // Skip stars fainter than threshold
      if (star.magnitude > magnitudeThreshold) continue;
      
      const position = starPositions.get(star.id);
      if (!position) continue;
      
      const screenPos = horizontalToScreen(
        position,
        viewCenter,
        fov,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );
      
      if (!screenPos) continue;
      
      result.push({
        id: star.id,
        name: star.name,
        screenX: screenPos.x,
        screenY: screenPos.y,
        radius: magnitudeToRadius(star.magnitude, fov),
        color: spectralTypeToColor(star.spectralType as SpectralType),
        magnitude: star.magnitude,
        isVisible: true,
      });
    }
    
    return result;
  }, [stars, starPositions, viewCenter, fov, magnitudeThreshold]);
  
  // Compute renderable planets
  const renderablePlanets = useMemo((): RenderablePlanet[] => {
    const result: RenderablePlanet[] = [];
    
    for (const planet of planets) {
      const position = planetPositions.get(planet.id);
      if (!position) continue;
      
      const screenPos = horizontalToScreen(
        position,
        viewCenter,
        fov,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );
      
      if (!screenPos) continue;
      
      result.push({
        id: planet.id,
        name: planet.name,
        screenX: screenPos.x,
        screenY: screenPos.y,
        magnitude: planet.magnitude,
        isVisible: true,
        symbol: PLANET_SYMBOLS[planet.id] || '●',
      });
    }
    
    return result;
  }, [planets, planetPositions, viewCenter, fov]);

  // Compute renderable horizon points - convert horizon points to screen coordinates
  const renderableHorizonPoints = useMemo((): string => {
    if (!horizonPoints || horizonPoints.length === 0) {
      return '';
    }

    const screenPoints: { x: number; y: number }[] = [];

    for (const point of horizonPoints) {
      const screenPos = horizontalToScreen(
        { azimuth: point.azimuth, altitude: point.altitude },
        viewCenter,
        fov,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );

      if (screenPos) {
        screenPoints.push(screenPos);
      }
    }

    // Convert to SVG polyline points string format: "x1,y1 x2,y2 x3,y3..."
    if (screenPoints.length < 2) {
      return '';
    }

    return screenPoints.map(p => `${p.x},${p.y}`).join(' ');
  }, [horizonPoints, viewCenter, fov]);

  // Compute renderable Moon position
  const renderableMoon = useMemo(() => {
    if (!moonPosition || moonPosition.isBelowHorizon) {
      return null;
    }

    const screenPos = horizontalToScreen(
      { azimuth: moonPosition.azimuth, altitude: moonPosition.altitude },
      viewCenter,
      fov,
      SCREEN_WIDTH,
      SCREEN_HEIGHT
    );

    if (!screenPos) {
      return null;
    }

    return {
      screenX: screenPos.x,
      screenY: screenPos.y,
      phaseEmoji: MOON_PHASE_EMOJIS[moonPosition.phaseName],
      illumination: Math.round(moonPosition.illumination),
      phaseName: moonPosition.phaseName,
    };
  }, [moonPosition, viewCenter, fov]);

  // Compute renderable Sun position
  const renderableSun = useMemo(() => {
    if (!sunPosition || sunPosition.isBelowHorizon) {
      return null;
    }

    const screenPos = horizontalToScreen(
      { azimuth: sunPosition.azimuth, altitude: sunPosition.altitude },
      viewCenter,
      fov,
      SCREEN_WIDTH,
      SCREEN_HEIGHT
    );

    if (!screenPos) {
      return null;
    }

    return {
      screenX: screenPos.x,
      screenY: screenPos.y,
      safetyWarning: sunPosition.safetyWarning,
    };
  }, [sunPosition, viewCenter, fov]);

  // Compute renderable constellation lines
  interface RenderableConstellationLine {
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    opacity: number;
    constellationId: string;
    constellationName: string;
  }

  interface ConstellationLabel {
    constellationId: string;
    name: string;
    screenX: number;
    screenY: number;
  }

  const { renderableConstellationLines, constellationLabels } = useMemo(() => {
    // Return empty if disabled or no data
    if (constellationConfig?.enabled === false || !constellationLines || constellationLines.length === 0) {
      return { renderableConstellationLines: [] as RenderableConstellationLine[], constellationLabels: [] as ConstellationLabel[] };
    }

    const lines: RenderableConstellationLine[] = [];
    // Track constellation centers for label placement
    const constellationPoints: Map<string, { name: string; points: { x: number; y: number }[] }> = new Map();

    constellationLines.forEach((segment, i) => {
      // Convert start and end points to screen coordinates
      const startScreen = horizontalToScreen(
        segment.start,
        viewCenter,
        fov,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );
      
      const endScreen = horizontalToScreen(
        segment.end,
        viewCenter,
        fov,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );

      // Only render if both points are visible on screen
      if (startScreen && endScreen) {
        // Dimmer opacity for partially visible lines
        const opacity = segment.isPartiallyVisible 
          ? (constellationConfig?.lineOpacity ?? 0.5) * 0.5 
          : (constellationConfig?.lineOpacity ?? 0.5);

        lines.push({
          key: `${segment.constellationId}-${i}`,
          x1: startScreen.x,
          y1: startScreen.y,
          x2: endScreen.x,
          y2: endScreen.y,
          opacity,
          constellationId: segment.constellationId,
          constellationName: segment.constellationName,
        });

        // Collect points for center calculation
        if (!constellationPoints.has(segment.constellationId)) {
          constellationPoints.set(segment.constellationId, { 
            name: segment.constellationName, 
            points: [] 
          });
        }
        const data = constellationPoints.get(segment.constellationId)!;
        data.points.push(startScreen, endScreen);
      }
    });

    // Calculate constellation label positions (center of visible points)
    const labels: ConstellationLabel[] = [];
    if (constellationConfig?.showNames !== false) {
      for (const [constellationId, data] of constellationPoints) {
        if (data.points.length > 0) {
          const avgX = data.points.reduce((sum, p) => sum + p.x, 0) / data.points.length;
          const avgY = data.points.reduce((sum, p) => sum + p.y, 0) / data.points.length;
          labels.push({
            constellationId,
            name: data.name,
            screenX: avgX,
            screenY: avgY,
          });
        }
      }
    }

    return { renderableConstellationLines: lines, constellationLabels: labels };
  }, [constellationLines, constellationConfig, viewCenter, fov]);

  // Constellation line styling with defaults
  const constellationLineColor = constellationConfig?.lineColor ?? '#3366cc';
  const constellationLineWidth = constellationConfig?.lineWidth ?? 1;
  const constellationNameColor = constellationConfig?.nameColor ?? '#6699ff';

  // Compute renderable deep sky objects
  interface RenderableDeepSkyObject {
    id: string;
    name: string | null;
    screenX: number;
    screenY: number;
    icon: string;
    type: DeepSkyObjectType;
  }

  const renderableDeepSkyObjects = useMemo((): RenderableDeepSkyObject[] => {
    // Return empty if disabled or no data
    if (deepSkyConfig?.enabled === false || !deepSkyPositions || deepSkyPositions.size === 0) {
      return [];
    }

    const result: RenderableDeepSkyObject[] = [];

    for (const [, dsoPosition] of deepSkyPositions) {
      // Only render objects where isVisible is true (above horizon and within magnitude limit)
      if (!dsoPosition.isVisible) continue;

      const screenPos = horizontalToScreen(
        { azimuth: dsoPosition.azimuth, altitude: dsoPosition.altitude },
        viewCenter,
        fov,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );

      if (!screenPos) continue;

      result.push({
        id: dsoPosition.object.id,
        name: dsoPosition.object.name,
        screenX: screenPos.x,
        screenY: screenPos.y,
        icon: DEEP_SKY_ICONS[dsoPosition.object.type],
        type: dsoPosition.object.type,
      });
    }

    return result;
  }, [deepSkyPositions, deepSkyConfig, viewCenter, fov]);

  // Deep sky object styling
  const deepSkyLabelColor = '#00cccc'; // Cyan/teal to differentiate from stars

  // Compute renderable satellites - filter out errors and convert to screen coordinates
  interface RenderableSatellite {
    id: string;
    name: string;
    screenX: number;
    screenY: number;
    isVisible: boolean;  // Illuminated and observer in darkness
    isStale: boolean;
  }

  const renderableSatellites = useMemo((): RenderableSatellite[] => {
    // Return empty if disabled or no data
    if (satelliteConfig?.enabled === false || !satellitePositions || satellitePositions.size === 0) {
      return [];
    }

    const result: RenderableSatellite[] = [];

    for (const [, satData] of satellitePositions) {
      // Skip errors - only render SatellitePosition objects
      if ('type' in satData) {
        // This is a SatelliteTrackerError, skip it
        continue;
      }

      // satData is SatellitePosition
      const screenPos = horizontalToScreen(
        { azimuth: satData.azimuth, altitude: satData.altitude },
        viewCenter,
        fov,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );

      if (!screenPos) continue;

      result.push({
        id: satData.id,
        name: satData.name,
        screenX: screenPos.x,
        screenY: screenPos.y,
        isVisible: satData.isVisible,
        isStale: satData.isStale,
      });
    }

    return result;
  }, [satellitePositions, satelliteConfig, viewCenter, fov]);

  // Satellite styling
  const satelliteVisibleColor = '#00ff00';  // Green when visible
  const satelliteNotVisibleColor = '#808080';  // Gray when not visible

  // Compute renderable meteor shower radiants
  interface RenderableMeteorShower {
    id: string;
    name: string;
    screenX: number;
    screenY: number;
    isActive: boolean;
    zhr: number;
    daysFromPeak: number;
  }

  const renderableMeteorShowers = useMemo((): RenderableMeteorShower[] => {
    // Return empty if disabled or no data
    if (meteorShowerConfig?.enabled === false || !meteorShowerRadiants || meteorShowerRadiants.size === 0) {
      return [];
    }

    const result: RenderableMeteorShower[] = [];

    for (const [, showerPosition] of meteorShowerRadiants) {
      // Skip inactive showers if showInactive is false (default: show inactive)
      if (!showerPosition.isActive && meteorShowerConfig?.showInactive === false) {
        continue;
      }

      const screenPos = horizontalToScreen(
        { azimuth: showerPosition.azimuth, altitude: showerPosition.altitude },
        viewCenter,
        fov,
        SCREEN_WIDTH,
        SCREEN_HEIGHT
      );

      if (!screenPos) continue;

      result.push({
        id: showerPosition.shower.id,
        name: showerPosition.shower.name,
        screenX: screenPos.x,
        screenY: screenPos.y,
        isActive: showerPosition.isActive,
        zhr: showerPosition.shower.zhr,
        daysFromPeak: showerPosition.daysFromPeak,
      });
    }

    return result;
  }, [meteorShowerRadiants, meteorShowerConfig, viewCenter, fov]);

  // Meteor shower styling
  const meteorShowerActiveColor = '#ff6600';  // Bright orange when active
  const meteorShowerInactiveColor = '#664422';  // Dimmer when inactive

  // Horizon line styling with defaults
  const horizonColor = horizonConfig?.color ?? '#4a5568';
  const horizonOpacity = horizonConfig?.opacity ?? 0.6;
  const horizonStrokeWidth = horizonConfig?.strokeWidth ?? 2;

  // Handle pinch-to-zoom gesture
  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    if (touches.length !== 2) {
      lastPinchDistance.current = null;
      return;
    }
    
    const touch1 = touches[0];
    const touch2 = touches[1];
    if (!touch1 || !touch2) return;
    
    const dx = touch2.pageX - touch1.pageX;
    const dy = touch2.pageY - touch1.pageY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (lastPinchDistance.current !== null) {
      const scale = lastPinchDistance.current / distance;
      const newFov = constrainFov(currentFov.current * scale);
      
      if (newFov !== currentFov.current) {
        currentFov.current = newFov;
        onFovChange?.(newFov);
      }
    }
    
    lastPinchDistance.current = distance;
  }, [onFovChange]);
  
  const handleTouchEnd = useCallback(() => {
    lastPinchDistance.current = null;
  }, []);
  
  // Handle star press
  const handleStarPress = useCallback((star: Star) => {
    onStarPress?.(star);
  }, [onStarPress]);
  
  // Handle planet press
  const handlePlanetPress = useCallback((planet: Planet) => {
    onPlanetPress?.(planet);
  }, [onPlanetPress]);
  
  // Compute sky atmosphere colors based on sun altitude
  const skyColors = useMemo(() => {
    const alt = sunPosition?.altitude ?? -20;
    if (alt > 10) {
      // Full daylight — blue sky
      return { zenith: '#1a3a6a', mid: '#3a6aaa', horizon: '#8ab4e8' };
    } else if (alt > 0) {
      // Low sun — golden hour
      return { zenith: '#1a2a50', mid: '#4a5a80', horizon: '#d09060' };
    } else if (alt > -6) {
      // Civil twilight — orange/purple
      return { zenith: '#0f1a30', mid: '#2a3550', horizon: '#c08060' };
    } else if (alt > -12) {
      // Nautical twilight — deep blue
      return { zenith: '#080e1a', mid: '#151e30', horizon: '#403050' };
    } else if (alt > -18) {
      // Astronomical twilight — very dark blue
      return { zenith: '#040810', mid: '#0a0f1a', horizon: '#1a1525' };
    }
    // Night — near black
    return { zenith: '#000011', mid: '#000011', horizon: '#0a0a15' };
  }, [sunPosition?.altitude]);

  return (
    <View
      style={styles.container}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={styles.svg} viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}>
        {/* Sky atmosphere gradient */}
        <Defs>
          <LinearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={skyColors.zenith} stopOpacity="1" />
            <Stop offset="0.5" stopColor={skyColors.mid} stopOpacity="1" />
            <Stop offset="1" stopColor={skyColors.horizon} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#skyGradient)" />
        
        {/* Render horizon line (behind stars and planets) */}
        {renderableHorizonPoints.length > 0 && (
          <Polyline
            points={renderableHorizonPoints}
            stroke={horizonColor}
            strokeWidth={horizonStrokeWidth}
            opacity={horizonOpacity}
            fill="none"
          />
        )}
        
        {/* Render constellation lines (behind stars) */}
        {constellationConfig?.enabled !== false && renderableConstellationLines.length > 0 && (
          <G>
            {renderableConstellationLines.map((line) => (
              <Line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={constellationLineColor}
                strokeWidth={constellationLineWidth}
                opacity={line.opacity}
              />
            ))}
            {/* Render constellation names near center points */}
            {constellationConfig?.showNames !== false && constellationLabels.map((label) => (
              <SvgText
                key={`label-${label.constellationId}`}
                x={label.screenX}
                y={label.screenY}
                fill={constellationNameColor}
                fontSize={12}
                textAnchor="middle"
                alignmentBaseline="middle"
                opacity={0.8}
              >
                {label.name}
              </SvgText>
            ))}
          </G>
        )}
        
        {/* Render stars */}
        <G>
          {renderableStars.map((star) => (
            <G key={star.id}>
              <Circle
                cx={star.screenX}
                cy={star.screenY}
                r={star.radius}
                fill={star.color}
                opacity={0.9}
                onPress={() => {
                  const originalStar = stars.find(s => s.id === star.id);
                  if (originalStar) handleStarPress(originalStar);
                }}
              />
              {/* Show label for bright stars */}
              {config.showLabels && star.name && shouldShowLabel(star.magnitude) && (
                <SvgText
                  x={star.screenX + star.radius + 4}
                  y={star.screenY + 4}
                  fill="#ffffff"
                  fontSize={10}
                  opacity={0.8}
                >
                  {star.name}
                </SvgText>
              )}
            </G>
          ))}
        </G>
        
        {/* Render planets with distinct icons */}
        <G>
          {renderablePlanets.map((planet) => (
            <G key={planet.id}>
              {/* Planet symbol (distinct from star circles) */}
              <SvgText
                x={planet.screenX}
                y={planet.screenY}
                fill="#ffdd44"
                fontSize={20}
                textAnchor="middle"
                alignmentBaseline="middle"
                onPress={() => {
                  const originalPlanet = planets.find(p => p.id === planet.id);
                  if (originalPlanet) handlePlanetPress(originalPlanet);
                }}
              >
                {planet.symbol}
              </SvgText>
              {/* Always show planet labels */}
              <SvgText
                x={planet.screenX + 14}
                y={planet.screenY + 4}
                fill="#ffdd44"
                fontSize={11}
                fontWeight="bold"
              >
                {planet.name}
              </SvgText>
            </G>
          ))}
        </G>
        
        {/* Render Moon with phase icon and illumination */}
        {renderableMoon && (
          <G>
            {/* Moon phase emoji */}
            <SvgText
              x={renderableMoon.screenX}
              y={renderableMoon.screenY}
              fill="#ffffff"
              fontSize={28}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {renderableMoon.phaseEmoji}
            </SvgText>
            {/* Moon label with illumination percentage */}
            <SvgText
              x={renderableMoon.screenX + 20}
              y={renderableMoon.screenY - 8}
              fill="#c0c0c0"
              fontSize={11}
              fontWeight="bold"
            >
              Moon
            </SvgText>
            <SvgText
              x={renderableMoon.screenX + 20}
              y={renderableMoon.screenY + 6}
              fill="#a0a0a0"
              fontSize={10}
            >
              {renderableMoon.illumination}% illuminated
            </SvgText>
          </G>
        )}
        
        {/* Render Sun with safety warning */}
        {renderableSun && (
          <G>
            {/* Sun emoji */}
            <SvgText
              x={renderableSun.screenX}
              y={renderableSun.screenY}
              fill="#ffcc00"
              fontSize={32}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              ☀️
            </SvgText>
            {/* Sun label */}
            <SvgText
              x={renderableSun.screenX + 22}
              y={renderableSun.screenY - 8}
              fill="#ffcc00"
              fontSize={11}
              fontWeight="bold"
            >
              Sun
            </SvgText>
            {/* Prominent safety warning when Sun is above horizon */}
            {renderableSun.safetyWarning && (
              <G>
                <SvgText
                  x={renderableSun.screenX}
                  y={renderableSun.screenY + 30}
                  fill="#ff3300"
                  fontSize={14}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ⚠️ DO NOT LOOK AT SUN
                </SvgText>
                <SvgText
                  x={renderableSun.screenX}
                  y={renderableSun.screenY + 46}
                  fill="#ff6600"
                  fontSize={11}
                  textAnchor="middle"
                >
                  Risk of eye damage
                </SvgText>
              </G>
            )}
          </G>
        )}
        
        {/* Render deep sky objects with type-specific icons */}
        {deepSkyConfig?.enabled !== false && renderableDeepSkyObjects.length > 0 && (
          <G>
            {renderableDeepSkyObjects.map((dso) => (
              <G key={dso.id}>
                {/* Deep sky object icon based on type */}
                <SvgText
                  x={dso.screenX}
                  y={dso.screenY}
                  fill={deepSkyLabelColor}
                  fontSize={18}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {dso.icon}
                </SvgText>
                {/* Show object ID (e.g., "M31") and name if available */}
                {deepSkyConfig?.showLabels !== false && (
                  <G>
                    <SvgText
                      x={dso.screenX + 14}
                      y={dso.screenY - 6}
                      fill={deepSkyLabelColor}
                      fontSize={10}
                      fontWeight="bold"
                    >
                      {dso.id}
                    </SvgText>
                    {dso.name && (
                      <SvgText
                        x={dso.screenX + 14}
                        y={dso.screenY + 6}
                        fill={deepSkyLabelColor}
                        fontSize={9}
                        opacity={0.8}
                      >
                        {dso.name}
                      </SvgText>
                    )}
                  </G>
                )}
              </G>
            ))}
          </G>
        )}
        
        {/* Render satellites with visibility indicator */}
        {satelliteConfig?.enabled !== false && renderableSatellites.length > 0 && (
          <G>
            {renderableSatellites.map((satellite) => (
              <G key={satellite.id}>
                {/* Satellite icon - green when visible, gray when not */}
                <SvgText
                  x={satellite.screenX}
                  y={satellite.screenY}
                  fill={satellite.isVisible ? satelliteVisibleColor : satelliteNotVisibleColor}
                  fontSize={16}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  🛰️
                </SvgText>
                {/* Show satellite name if labels enabled */}
                {satelliteConfig?.showLabels !== false && (
                  <SvgText
                    x={satellite.screenX + 14}
                    y={satellite.screenY + 4}
                    fill={satellite.isVisible ? satelliteVisibleColor : satelliteNotVisibleColor}
                    fontSize={10}
                    fontWeight="bold"
                  >
                    {satellite.name}
                  </SvgText>
                )}
              </G>
            ))}
          </G>
        )}
        
        {/* Render meteor shower radiants with active status highlighting */}
        {meteorShowerConfig?.enabled !== false && renderableMeteorShowers.length > 0 && (
          <G>
            {renderableMeteorShowers.map((shower) => (
              <G key={shower.id}>
                {/* Meteor shower radiant icon - bright when active, dimmer when inactive */}
                <SvgText
                  x={shower.screenX}
                  y={shower.screenY}
                  fill={shower.isActive ? meteorShowerActiveColor : meteorShowerInactiveColor}
                  fontSize={shower.isActive ? 20 : 16}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  opacity={shower.isActive ? 1 : 0.6}
                >
                  ☄️
                </SvgText>
                {/* Show shower name and ZHR for active showers */}
                {meteorShowerConfig?.showLabels !== false && (
                  <G>
                    <SvgText
                      x={shower.screenX + 14}
                      y={shower.screenY - 6}
                      fill={shower.isActive ? meteorShowerActiveColor : meteorShowerInactiveColor}
                      fontSize={10}
                      fontWeight="bold"
                      opacity={shower.isActive ? 1 : 0.6}
                    >
                      {shower.name}
                    </SvgText>
                    {/* Show ZHR for active showers */}
                    {shower.isActive && (
                      <SvgText
                        x={shower.screenX + 14}
                        y={shower.screenY + 6}
                        fill={meteorShowerActiveColor}
                        fontSize={9}
                        opacity={0.8}
                      >
                        ZHR: {shower.zhr}
                      </SvgText>
                    )}
                  </G>
                )}
              </G>
            ))}
          </G>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000011',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default SkyView;
