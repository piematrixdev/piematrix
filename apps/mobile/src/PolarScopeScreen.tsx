import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ImageBackground, Switch, ScrollView } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { ArrowLeft2 } from 'iconsax-react-native';
import * as Astronomy from 'astronomy-engine';
import * as Location from 'expo-location';

const { width: W } = Dimensions.get('window');

// Polaris J2000 (ICRS) — precessed to date via astronomy-engine.
const POLARIS_J2000 = { raHours: 2.530301, decDeg: 89.264109, distLy: 447 };

try { Astronomy.DefineStar(Astronomy.Body.Star1, POLARIS_J2000.raHours, POLARIS_J2000.decDeg, POLARIS_J2000.distLy); } catch {}

const norm24 = (h: number) => ((h % 24) + 24) % 24;

/** Apparent (of-date) RA/Dec of Polaris for the given date. */
function polarisApparent(date: Date): { ra: number; dec: number } {
  try {
    const obs = new Astronomy.Observer(0, 0, 0);
    const eq = Astronomy.Equator(Astronomy.Body.Star1, date, obs, true, true);
    return { ra: eq.ra, dec: eq.dec };
  } catch {
    // Fallback ≈ 2025 apparent position.
    return { ra: 2.96, dec: 89.35 };
  }
}

/** Format an angle expressed in hours as "HHh MMm SS.Ss". */
function fmtHMS(hours: number): { h: string; m: string; s: string } {
  const t = norm24(hours);
  const h = Math.floor(t);
  const mFull = (t - h) * 60;
  const m = Math.floor(mFull);
  const s = (mFull - m) * 60;
  return { h: String(h).padStart(2, '0'), m: String(m).padStart(2, '0'), s: s.toFixed(1).padStart(4, '0') };
}

interface Props {
  onClose: () => void;
  observerLongitude?: number;
}

export default function PolarScopeScreen({ onClose, observerLongitude = 0 }: Props) {
  const [now, setNow] = useState(new Date());
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoom, setZoom] = useState(1);
  const lastPinchDist = React.useRef<number | null>(null);
  // Coordinates actually used for the hour-angle calc. Start from the passed
  // longitude, but fetch a fresh device fix so the hour angle is correct even
  // if the caller's location wasn't loaded (longitude error → up to 12h off;
  // 15° of longitude = a full hour, so even a 10° error is ~40 min).
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat: 0, lon: observerLongitude });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (!cancelled && last) setCoords({ lat: last.coords.latitude, lon: last.coords.longitude });
        const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
        if (!cancelled && fresh) setCoords({ lat: fresh.coords.latitude, lon: fresh.coords.longitude });
      } catch { /* keep the passed longitude */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const clampZoom = (z: number) => Math.max(0.6, Math.min(5, z));

  const onTouchMove = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches?.length === 2) {
      const dx = touches[1].pageX - touches[0].pageX;
      const dy = touches[1].pageY - touches[0].pageY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current !== null) {
        const scale = dist / lastPinchDist.current;
        setZoom((z) => clampZoom(z * scale));
      }
      lastPinchDist.current = dist;
    }
  };
  const onTouchEnd = () => { lastPinchDist.current = null; };

  // Tick the clock — sidereal time drifts slowly, 1s updates are plenty.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { hourAngle, visualAngle, raPolaris, decPolaris } = useMemo(() => {
    const pol = polarisApparent(now);
    // Authoritative hour angle of Polaris from astronomy-engine — it uses the
    // observer's longitude, apparent sidereal time and apparent RA internally,
    // so there's no chance of a manual sidereal/RA/sign mistake.
    let ha: number;
    try {
      const obs = new Astronomy.Observer(coords.lat, coords.lon, 0);
      ha = norm24(Astronomy.HourAngle(Astronomy.Body.Star1, now, obs));
    } catch {
      const gast = Astronomy.SiderealTime(now);
      ha = norm24(gast + coords.lon / 15 - pol.ra);
    }
    // The "Visual Angle" is where Polaris sits on the 12-hour clock face of the
    // reticle — i.e. the clock position you rotate the mount to. Polaris is
    // drawn at clock angle (24 − HA)/2 (its hour angle mapped onto the 12-hour
    // dial), so the readout must use the same mapping. (Verified against the
    // reference app: HA 16h01m58.8s → Visual 3h59m00.6s = (24−16.033)/2.)
    const visual = norm24((24 - ha) / 2);
    return { hourAngle: ha, visualAngle: visual, raPolaris: pol.ra, decPolaris: pol.dec };
  }, [now, coords]);

  // --- Reticle geometry ---
  const cx = W / 2;
  const cy = W / 2;            // square reticle area
  const RD = W * 0.36;        // dial radius
  const rPolaris = RD * 0.62; // radius of the Polaris circle on the reticle

  // Map a clock hour + radius to an (x,y) point. 0h at top, increasing
  // clockwise->… actually hours increase counter-clockwise on the dial so that
  // 12h sits at the bottom and 6h on the left (standard polar-scope layout).
  // Flips mirror the coordinate so the reticle matches the eyepiece view.
  const pt = (hours: number, r: number) => {
    const phi = (norm24(24 - hours)) * 15 * Math.PI / 180; // radians, clockwise from top
    let x = Math.sin(phi) * r;
    let y = -Math.cos(phi) * r;
    if (flipH) x = -x;
    if (flipV) y = -y;
    return { x: cx + x, y: cy + y };
  };

  const polarisPt = pt(hourAngle, rPolaris);
  const ha = fmtHMS(hourAngle);
  const va = fmtHMS(visualAngle);
  const raStr = fmtHMS(raPolaris);
  const lst = fmtHMS(norm24(Astronomy.SiderealTime(now) + coords.lon / 15));
  // Polaris dec → degrees/arcmin, and angular separation from the pole.
  const decDeg = Math.floor(decPolaris);
  const decMin = Math.round((decPolaris - decDeg) * 60);
  const sepArcmin = (90 - decPolaris) * 60; // distance from the NCP

  // Inner angle (degree) scale radius and point mapper. Degrees increase
  // clockwise from the top — a position-angle scale inside the hour dial.
  const RI = RD * 0.82;
  const ptDeg = (deg: number, r: number) => {
    const phi = (deg * Math.PI) / 180; // clockwise from top
    let x = Math.sin(phi) * r;
    let y = -Math.cos(phi) * r;
    if (flipH) x = -x;
    if (flipV) y = -y;
    return { x: cx + x, y: cy + y };
  };
  const degMarks = Array.from({ length: 36 }, (_, i) => i * 10);   // ticks every 10°
  const degLabels = Array.from({ length: 12 }, (_, i) => i * 30);  // numbers every 30°
  // Innermost 12-hour clock scale (1..12), 12 at top, increasing clockwise.
  const RC = RD * 0.46;
  const clockHours = Array.from({ length: 12 }, (_, i) => i + 1);

  const RED = '#e0524d';
  const RED_DIM = 'rgba(224,82,77,0.55)';

  // Hour numbers + ticks
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // The dial/scales are static (they only change on flip), so build them once
  // and reuse — otherwise every 1s tick rebuilds ~80 SVG nodes and the screen
  // lags. Only Polaris + the readout text update each second.
  const staticReticle = useMemo(() => (
    <G>
      {/* Outer dial */}
      <Circle cx={cx} cy={cy} r={RD} stroke={RED} strokeWidth={1.5} fill="none" />
      {/* Polaris circle (path Polaris travels around the pole) */}
      <Circle cx={cx} cy={cy} r={rPolaris} stroke={RED_DIM} strokeWidth={1} fill="none" />

      {/* Hour ticks + numbers (24h scale) */}
      {hours.map((h) => {
        const outer = pt(h, RD);
        const inner = pt(h, RD - 10);
        const label = pt(h, RD + 16);
        return (
          <G key={h}>
            <Line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={RED} strokeWidth={1.2} />
            <SvgText x={label.x} y={label.y + 4} fill={RED} fontSize={12} fontWeight="600" textAnchor="middle">{h}</SvgText>
          </G>
        );
      })}

      {/* Inner degree (angle) scale */}
      <Circle cx={cx} cy={cy} r={RI} stroke={RED_DIM} strokeWidth={1} fill="none" />
      {degMarks.map((d) => {
        const isMajor = d % 30 === 0;
        const outer = ptDeg(d, RI);
        const inner = ptDeg(d, RI - (isMajor ? 9 : 5));
        return <Line key={`deg-${d}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={RED_DIM} strokeWidth={isMajor ? 1.1 : 0.7} />;
      })}
      {degLabels.map((d) => {
        const label = ptDeg(d, RI - 20);
        return <SvgText key={`degl-${d}`} x={label.x} y={label.y + 3} fill={RED_DIM} fontSize={9} fontWeight="600" textAnchor="middle">{d}</SvgText>;
      })}

      {/* Inner 12-hour clock scale (1..12) */}
      <Circle cx={cx} cy={cy} r={RC} stroke={RED_DIM} strokeWidth={1} fill="none" />
      {clockHours.map((h) => {
        const deg = h * 30;
        const outer = ptDeg(deg, RC);
        const inner = ptDeg(deg, RC - 7);
        const label = ptDeg(deg, RC - 17);
        return (
          <G key={`clk-${h}`}>
            <Line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={RED} strokeWidth={1} />
            <SvgText x={label.x} y={label.y + 4} fill={RED} fontSize={11} fontWeight="700" textAnchor="middle">{h}</SvgText>
          </G>
        );
      })}

      {/* Cross-hairs through the pole */}
      <Line x1={cx} y1={cy - RD} x2={cx} y2={cy + RD} stroke={RED_DIM} strokeWidth={0.8} strokeDasharray="3,5" />
      <Line x1={cx - RD} y1={cy} x2={cx + RD} y2={cy} stroke={RED_DIM} strokeWidth={0.8} strokeDasharray="3,5" />
      {/* Pole marker */}
      <Circle cx={cx} cy={cy} r={3} fill={RED} />
    </G>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [flipH, flipV]);

  return (
    <View style={s.root}>
      <ImageBackground
        source={require('../assets/dark-night-sky-with-stars-galaxy-background.jpg')}
        style={s.bg}
        resizeMode="cover"
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ArrowLeft2 size={26} color="#fff" variant="Linear" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Polar Scope</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Reticle */}
        <View style={s.reticleArea} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <View style={{ transform: [{ scale: zoom }] }}>
          <Svg width={W} height={W}>
            {staticReticle}

            {/* Line from pole to Polaris */}
            <Line x1={cx} y1={cy} x2={polarisPt.x} y2={polarisPt.y} stroke={RED} strokeWidth={1.5} />

            {/* Polaris */}
            <Circle cx={polarisPt.x} cy={polarisPt.y} r={9} fill="rgba(255,255,255,0.18)" />
            <Circle cx={polarisPt.x} cy={polarisPt.y} r={4} fill="#fff" />
            <SvgText
              x={polarisPt.x + 14}
              y={polarisPt.y - 10}
              fill="#fff"
              fontSize={13}
              fontWeight="600"
              textAnchor="start"
            >
              Polaris
            </SvgText>
          </Svg>
          </View>

          {/* Zoom controls */}
          <View style={s.zoomControls}>
            <TouchableOpacity style={s.zoomBtn} onPress={() => setZoom((z) => clampZoom(z + 0.25))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.zoomBtnText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.zoomBtn} onPress={() => setZoom((z) => clampZoom(z - 0.25))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.zoomBtnText}>−</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom info panel */}
        <View style={s.panel}>
          <View style={s.grip} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          <Text style={s.panelTitle}>Position of Polaris with respect to the North Pole</Text>
          <Text style={s.hint}>Rotate your mount until Polaris sits at the clock position shown on the reticle.</Text>
          <Text style={s.locLine}>{now.toLocaleTimeString()}  ·  Lat {coords.lat.toFixed(3)}°  ·  Lon {coords.lon.toFixed(3)}°</Text>

          <View style={[s.row, s.rowPrimary]}>
            <Text style={s.rowLabelPrimary}>Clock position</Text>
            <Text style={s.rowValue}>
              <Text style={s.numPrimary}>{va.h}</Text><Text style={s.unit}>h </Text>
              <Text style={s.numPrimary}>{va.m}</Text><Text style={s.unit}>m </Text>
              <Text style={s.numPrimary}>{va.s}</Text><Text style={s.unit}>s</Text>
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Hour Angle</Text>
            <Text style={s.rowValue}>
              <Text style={s.num}>{ha.h}</Text><Text style={s.unit}>h </Text>
              <Text style={s.num}>{ha.m}</Text><Text style={s.unit}>m </Text>
              <Text style={s.num}>{ha.s}</Text><Text style={s.unit}>s</Text>
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Right Ascension</Text>
            <Text style={s.rowValue}>
              <Text style={s.num}>{raStr.h}</Text><Text style={s.unit}>h </Text>
              <Text style={s.num}>{raStr.m}</Text><Text style={s.unit}>m </Text>
              <Text style={s.num}>{raStr.s}</Text><Text style={s.unit}>s</Text>
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Declination</Text>
            <Text style={s.rowValue}>
              <Text style={s.num}>+{decDeg}</Text><Text style={s.unit}>°  </Text>
              <Text style={s.num}>{decMin}</Text><Text style={s.unit}>′</Text>
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Separation from pole</Text>
            <Text style={s.rowValue}>
              <Text style={s.num}>{sepArcmin.toFixed(1)}</Text><Text style={s.unit}>′</Text>
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Local Sidereal Time</Text>
            <Text style={s.rowValue}>
              <Text style={s.num}>{lst.h}</Text><Text style={s.unit}>h </Text>
              <Text style={s.num}>{lst.m}</Text><Text style={s.unit}>m </Text>
              <Text style={s.num}>{lst.s}</Text><Text style={s.unit}>s</Text>
            </Text>
          </View>

          <Text style={s.flipHeading}>Flip View</Text>
          <View style={s.flipRow}>
            <View style={s.flipItem}>
              <Switch
                value={flipH}
                onValueChange={setFlipH}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#d4c5a0' }}
                thumbColor="#fff"
              />
              <Text style={s.flipLabel}>Horizontally</Text>
            </View>
            <View style={s.flipItem}>
              <Switch
                value={flipV}
                onValueChange={setFlipV}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#d4c5a0' }}
                thumbColor="#fff"
              />
              <Text style={s.flipLabel}>Vertically</Text>
            </View>
          </View>
          </ScrollView>
        </View>
      </ImageBackground>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05060a' },
  bg: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 10 },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: 'Poppins-SemiBold' },
  reticleArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoomControls: { position: 'absolute', right: 18, bottom: 18, gap: 10 },
  zoomBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  zoomBtnText: { color: '#fff', fontSize: 24, fontWeight: '600', lineHeight: 28 },
  panel: { backgroundColor: 'rgba(5,6,10,0.94)', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '44%' },
  grip: { alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 8 },
  panelTitle: { color: '#fff', fontSize: 14, fontFamily: 'Poppins-SemiBold', marginBottom: 2, lineHeight: 19 },
  hint: { color: 'rgba(212,197,160,0.85)', fontSize: 11, fontFamily: 'Poppins-Regular', marginBottom: 6, lineHeight: 15 },
  locLine: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'Poppins-Regular', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowPrimary: { backgroundColor: 'rgba(212,197,160,0.08)', borderRadius: 8, paddingHorizontal: 10, marginHorizontal: -10, borderBottomWidth: 0, marginBottom: 2 },
  rowLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: 'Poppins-Regular' },
  rowLabelPrimary: { color: '#d4c5a0', fontSize: 14, fontFamily: 'Poppins-SemiBold' },
  rowValue: { color: '#fff', fontSize: 15 },
  num: { color: '#fff', fontSize: 15, fontFamily: 'Poppins-Bold' },
  numPrimary: { color: '#d4c5a0', fontSize: 17, fontFamily: 'Poppins-Bold' },
  unit: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Poppins-Regular' },
  flipHeading: { color: '#fff', fontSize: 13, fontFamily: 'Poppins-SemiBold', marginTop: 10, marginBottom: 8 },
  flipRow: { flexDirection: 'row', gap: 28 },
  flipItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flipLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Poppins-Regular' },
});
