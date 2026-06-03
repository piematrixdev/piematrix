/**
 * Isolated live-readout components.
 *
 * These exist so the frequently-updating text in the sky view (compass az/alt
 * and the clock) does NOT re-render the heavy AppContent tree. Each component
 * runs its own small interval, reads live values from refs, and updates only
 * its own local state — so React's reconciliation is confined to a few text
 * nodes instead of the whole screen (which holds the GL view, FABs, gestures).
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GlassCard from './GlassCard';

const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function cardinal(az: number): string {
  return CARD[Math.round(az / 45) % 8] ?? 'N';
}

interface CompassReadoutProps {
  /** Live pointing ref (AR mode). */
  pointingRef: React.MutableRefObject<{ azimuth: number; altitude: number }>;
  /** Live manual position ref (manual mode). */
  manualPosRef: React.MutableRefObject<{ azimuth: number; altitude: number }>;
  /** Whether AR mode is active (chooses which ref to read). */
  arMode: boolean;
  loadingStars: boolean;
  redMode?: boolean;
}

/**
 * Full top-bar center row: azimuth pill, loading/mode pills, altitude pill.
 * Reads az/alt from the live ref ~5×/sec and updates only when a rounded value
 * changes — so the continuous compass movement repaints just this small
 * component, never the heavy AppContent tree.
 */
export const CompassReadout = React.memo(function CompassReadout({
  pointingRef, manualPosRef, arMode, loadingStars, redMode,
}: CompassReadoutProps) {
  const [az, setAz] = useState(0);
  const [alt, setAlt] = useState(0);
  const lastAz = useRef(-999);
  const lastAlt = useRef(-999);

  useEffect(() => {
    const id = setInterval(() => {
      const src = arMode ? pointingRef.current : manualPosRef.current;
      const a = Math.round(src.azimuth);
      const e = Math.round(src.altitude);
      if (a !== lastAz.current) { lastAz.current = a; setAz(a); }
      if (e !== lastAlt.current) { lastAlt.current = e; setAlt(e); }
    }, 200);
    return () => clearInterval(id);
  }, [arMode, pointingRef, manualPosRef]);

  return (
    <View style={s.center}>
      <GlassCard intensity={20} borderRadius={20}>
        <View style={s.pill}>
          <Text style={[s.pillBold, redMode && { color: '#ff4444' }]}>{cardinal(az)}</Text>
          <Text style={[s.pillLight, redMode && { color: '#cc3333' }]}>{az}°</Text>
        </View>
      </GlassCard>
      {loadingStars && (
        <View style={s.loadingPill}>
          <Text style={[s.loadingText, redMode && { color: '#ff4444' }]}>Loading stars…</Text>
        </View>
      )}
      <View style={[s.modePill, !arMode && s.modePillManual, redMode && { borderColor: '#ff4444' }]}>
        <Text style={[s.modeText, redMode && { color: '#ff4444' }]}>{arMode ? 'AR' : 'Manual'}</Text>
      </View>
      <GlassCard intensity={20} borderRadius={20}>
        <View style={s.pill}>
          <Text style={[s.pillDim, redMode && { color: '#991111' }]}>Alt</Text>
          <Text style={[s.pillLight, redMode && { color: '#cc3333' }]}>{alt}°</Text>
        </View>
      </GlassCard>
    </View>
  );
});

interface LiveClockProps {
  /** Live time ref — engine writes the current display time here. */
  timeRef: React.MutableRefObject<Date>;
  isRealTime: boolean;
  redMode?: boolean;
}

/**
 * Clock readout (HH:MM:SS + date/Live). Ticks once per second from its own
 * interval, reading timeRef. Isolated so the per-second update doesn't
 * re-render AppContent.
 */
export const LiveClock = React.memo(function LiveClock({ timeRef, isRealTime, redMode }: LiveClockProps) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const t = timeRef.current;
  return (
    <View>
      <Text style={[s.infoVal, redMode && { color: '#ff4444' }]}>
        {t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      </Text>
      <Text style={[s.infoSub, redMode && { color: '#991111' }]}>
        {isRealTime ? 'Live' : t.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
      </Text>
    </View>
  );
});

const s = StyleSheet.create({
  center: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 5 },
  pillBold: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Poppins-Bold' },
  pillLight: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Poppins-Light' },
  pillDim: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'Poppins-Light' },
  loadingPill: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },
  modePill: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  modePillManual: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)' },
  modeText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700' },
  infoVal: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', fontFamily: 'Poppins-Regular' },
  infoSub: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: 'Poppins-Light' },
});
