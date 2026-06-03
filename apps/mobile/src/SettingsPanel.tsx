import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Image } from 'react-native';
import {
  Setting4, Star1, Global, Moon, Sun1, Discover, Radar, Magicpen,
  Text as TextIcon, CloseCircle, Building, InfoCircle, Gallery, TickCircle,
} from 'iconsax-react-native';
import { GROUNDS } from './grounds';

const BORTLE_NAME: Record<number, string> = {
  1: 'Excellent Dark', 2: 'Dark Site', 3: 'Rural', 4: 'Rural/Suburban',
  5: 'Suburban', 6: 'Bright Suburban', 7: 'Sub/Urban', 8: 'City', 9: 'Inner City',
};
const BORTLE_MAG: Record<number, number> = {
  1: 7.6, 2: 7.1, 3: 6.6, 4: 6.2, 5: 5.6, 6: 5.1, 7: 4.6, 8: 4.1, 9: 3.5,
};
const BORTLE_COLORS = ['#22c55e','#4ade80','#86efac','#fde047','#facc15','#f59e0b','#f97316','#ef4444','#dc2626'];

interface ShowState {
  planets: boolean; moon: boolean; sun: boolean; constellations: boolean;
  deepSky: boolean; satellites: boolean; meteors: boolean; labels: boolean;
  horizon: boolean; altGrid: boolean; azGrid: boolean; eqGrid: boolean; milkyWay: boolean;
  atmosphere: boolean; ground: boolean; redMode?: boolean;
}

interface Props {
  bortle: number;
  setBortle: (b: number) => void;
  show: ShowState;
  toggle: (k: keyof ShowState) => void;
  groundId: string;
  setGroundId: (id: string) => void;
  onClose: () => void;
}

type ToggleKey = keyof ShowState;

interface ToggleDef {
  key: ToggleKey;
  label: string;
  desc: string;   // one-liner in plain English
  info: string;   // longer explanation shown via the (i) button
  icon: React.ReactNode;
}

interface Section {
  title: string;
  items: ToggleDef[];
}

// All toggle metadata — single source of truth for labels, one-liners,
// and the detailed help text shown behind the (i) button.
const SECTIONS: Section[] = [
  {
    title: 'Celestial Objects',
    items: [
      {
        key: 'planets',
        label: 'Planets',
        desc: 'Show planets like Mars, Jupiter and Venus',
        info: 'Marks the planets that are currently above your horizon. Tap a planet in the sky to see its name, brightness, and exact position. Planets move slightly night to night.',
        icon: <Global size={18} color="#f59e0b" variant="Bulk" />,
      },
      {
        key: 'moon',
        label: 'Moon',
        desc: 'Show the Moon and its current phase',
        info: 'Displays the Moon at its real position, lit to match tonight\'s phase. The Moon is bright enough to wash out faint stars near it, so hide it if you\'re hunting deep-sky objects.',
        icon: <Moon size={18} color="#d4c5a0" variant="Bulk" />,
      },
      {
        key: 'sun',
        label: 'Sun',
        desc: 'Show the Sun\'s position, even below the horizon',
        info: 'Shows where the Sun is right now. Useful for planning golden hour or seeing how long until astronomical darkness. The app never points your camera at the Sun — this is a simulated position only.',
        icon: <Sun1 size={18} color="#fbbf24" variant="Bulk" />,
      },
      {
        key: 'constellations',
        label: 'Constellations',
        desc: 'Connect stars into their constellation patterns',
        info: 'Draws the familiar connect-the-dots lines and names for the 88 constellations. A great way to learn the sky and orient yourself. Turn off for a cleaner, natural star field.',
        icon: <Star1 size={18} color="#d4c5a0" variant="Bulk" />,
      },
    ],
  },
  {
    title: 'Sky Features',
    items: [
      {
        key: 'deepSky',
        label: 'Deep Sky Objects',
        desc: 'Show galaxies, nebulae and star clusters',
        info: 'Plots Messier and well-known deep-sky objects — galaxies, glowing nebulae, and star clusters. Most need a telescope or binoculars to see for real, but they\'re great targets to find and learn.',
        icon: <Discover size={18} color="#c9b896" variant="Bulk" />,
      },
      {
        key: 'milkyWay',
        label: 'Milky Way',
        desc: 'Show the glowing band of our galaxy',
        info: 'Overlays the soft glowing band of the Milky Way across the sky. Visible to the naked eye only from dark sites (low Bortle), but always shown here so you can see where it arcs overhead.',
        icon: <Discover size={18} color="#d4c5a0" variant="Bulk" />,
      },
    ],
  },
  {
    title: 'Tracking',
    items: [
      {
        key: 'satellites',
        label: 'Satellites',
        desc: 'Track the ISS and other satellites in real time',
        info: 'Shows satellites currently passing overhead, including the International Space Station, updated live. Bright passes can be seen with the naked eye as steady moving "stars".',
        icon: <Radar size={18} color="#22c55e" variant="Bulk" />,
      },
      {
        key: 'meteors',
        label: 'Meteor Showers',
        desc: 'Mark where active meteor showers come from',
        info: 'Marks the radiant — the point meteors appear to stream from — for any meteor shower active tonight. Look slightly away from the radiant for the longest, most dramatic meteor trails.',
        icon: <Magicpen size={18} color="#f472b6" variant="Bulk" />,
      },
    ],
  },
  {
    title: 'Display',
    items: [
      {
        key: 'labels',
        label: 'Star Labels',
        desc: 'Show names next to the brighter stars',
        info: 'Labels named stars like Sirius, Vega, and Betelgeuse. Only the brightest are labelled to avoid clutter; zoom in to reveal more. Turn off for an unlabelled, photographic look.',
        icon: <TextIcon size={18} color="#60a5fa" variant="Bulk" />,
      },
      {
        key: 'horizon',
        label: 'Horizon',
        desc: 'Draw the horizon line and compass directions',
        info: 'Shows the horizon line with N, E, S, W markers so you know which way you\'re facing. Helpful for figuring out where an object will rise or set.',
        icon: <Sun1 size={18} color="#64748b" variant="Bulk" />,
      },
      {
        key: 'altGrid',
        label: 'Altitude Grid',
        desc: 'Show height-above-horizon circles',
        info: 'Draws rings marking altitude — how high something is above the horizon, from 0° (horizon) to 90° (straight up). Handy for judging whether an object is high enough to view clearly.',
        icon: <Discover size={18} color="#06b6d4" variant="Bulk" />,
      },
      {
        key: 'azGrid',
        label: 'Azimuth Grid',
        desc: 'Show compass-direction lines',
        info: 'Draws vertical lines for azimuth — the compass bearing around the horizon (0° = North, 90° = East, and so on). Combine with the altitude grid to pin down an exact spot in the sky.',
        icon: <Discover size={18} color="#f59e0b" variant="Bulk" />,
      },
      {
        key: 'eqGrid',
        label: 'Equatorial Grid',
        desc: 'Show the sky\'s map coordinate grid',
        info: 'Overlays right ascension and declination — the "latitude and longitude" of the sky that astronomers use. Most useful if you\'re matching star charts or telescope coordinates.',
        icon: <Global size={18} color="#22d3ee" variant="Bulk" />,
      },
    ],
  },
  {
    title: 'Environment',
    items: [
      {
        key: 'atmosphere',
        label: 'Atmosphere',
        desc: 'Simulate sky glow, twilight and daylight',
        info: 'Adds realistic sky colour — blue daylight, twilight gradients, and a darkening night sky. Turn it off to see all stars on a pure black background regardless of the time of day.',
        icon: <Sun1 size={18} color="#7ca8d4" variant="Bulk" />,
      },
      {
        key: 'ground',
        label: 'Ground',
        desc: 'Show the ground and landscape below you',
        info: 'Renders a ground plane and horizon scenery so the view feels grounded. Turn it off to see through the Earth and view objects that are currently below your horizon.',
        icon: <Discover size={18} color="#3a5a30" variant="Bulk" />,
      },
      {
        key: 'redMode',
        label: 'Night Red Mode',
        desc: 'Dim everything red to protect night vision',
        info: 'Tints the whole app deep red and dims it. Red light lets your eyes stay adapted to the dark, so you can keep looking up without losing your night vision. Ideal once you\'re out observing.',
        icon: <Moon size={18} color="#ef4444" variant="Bulk" />,
      },
    ],
  },
];

export default function SettingsPanel({ bortle, setBortle, show, toggle, groundId, setGroundId, onClose }: Props) {
  const [info, setInfo] = useState<ToggleDef | null>(null);
  const bColor = BORTLE_COLORS[bortle - 1] ?? '#f59e0b';
  const limMag = BORTLE_MAG[bortle] ?? 5.6;

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <Setting4 size={22} color="#d4c5a0" variant="Bulk" />
          <Text style={st.headerTitle}>Settings</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <CloseCircle size={26} color="#555" variant="Bulk" />
        </TouchableOpacity>
      </View>

      <ScrollView style={st.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Bortle Scale Card */}
        <View style={st.card}>
          <View style={st.cardHead}>
            <Building size={16} color={bColor} variant="Bulk" />
            <Text style={st.cardTitle}>Light Pollution</Text>
          </View>
          <Text style={st.cardDesc}>How dark your sky is. Lower means more stars are visible.</Text>
          <View style={st.bortleDisplay}>
            <Text style={[st.bortleNum, { color: bColor }]}>{bortle}</Text>
            <View style={st.bortleInfo}>
              <Text style={st.bortleName}>{BORTLE_NAME[bortle]}</Text>
              <Text style={st.bortleSub}>Limiting magnitude {limMag.toFixed(1)}</Text>
            </View>
          </View>
          <View style={st.scaleBar}>
            {[1,2,3,4,5,6,7,8,9].map(b => (
              <TouchableOpacity
                key={b}
                style={[st.scaleSegment, { backgroundColor: b <= bortle ? BORTLE_COLORS[b-1] : 'rgba(255,255,255,0.06)' }]}
                onPress={() => setBortle(b)}
              />
            ))}
          </View>
          <View style={st.scaleLabels}>
            <Text style={st.scaleLabel}>Dark</Text>
            <Text style={st.scaleLabel}>Urban</Text>
          </View>
        </View>

        {/* Ground picker — choose the landscape scenery */}
        <Text style={st.section}>Ground Scenery</Text>
        <View style={st.card}>
          <View style={st.cardHead}>
            <Gallery size={16} color="#86a96b" variant="Bulk" />
            <Text style={st.cardTitle}>Landscape</Text>
          </View>
          <Text style={st.cardDesc}>Pick the horizon scenery shown beneath the sky.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.groundRow}
          >
            {GROUNDS.map((g) => {
              const active = g.id === groundId;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[st.groundCard, active && st.groundCardActive]}
                  onPress={() => setGroundId(g.id)}
                  activeOpacity={0.8}
                >
                  <Image source={g.asset} style={st.groundThumb} resizeMode="cover" />
                  {active && (
                    <View style={st.groundCheck}>
                      <TickCircle size={18} color="#d4c5a0" variant="Bold" />
                    </View>
                  )}
                  <Text style={[st.groundName, active && st.groundNameActive]} numberOfLines={1}>{g.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* All toggle sections — shown at once, no advanced gate */}
        {SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={st.section}>{section.title}</Text>
            <View style={st.card}>
              {section.items.map((item, i) => (
                <Toggle
                  key={item.key}
                  def={item}
                  on={item.key === 'redMode' ? (show.redMode ?? false) : (show[item.key] as boolean)}
                  onPress={() => toggle(item.key)}
                  onInfo={() => setInfo(item)}
                  last={i === section.items.length - 1}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Info popup */}
      <Modal visible={!!info} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
        <TouchableOpacity style={st.infoOverlay} activeOpacity={1} onPress={() => setInfo(null)}>
          <TouchableOpacity activeOpacity={1} style={st.infoCard} onPress={() => {}}>
            <View style={st.infoHead}>
              <View style={st.infoIconWrap}>{info?.icon}</View>
              <Text style={st.infoTitle}>{info?.label}</Text>
              <TouchableOpacity onPress={() => setInfo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <CloseCircle size={24} color="#555" variant="Bulk" />
              </TouchableOpacity>
            </View>
            <Text style={st.infoBody}>{info?.info}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function Toggle({ def, on, onPress, onInfo, last }: {
  def: ToggleDef; on: boolean; onPress: () => void; onInfo: () => void; last?: boolean;
}) {
  return (
    <View style={[st.toggleRow, !last && st.toggleBorder]}>
      <View style={st.iconWrap}>{def.icon}</View>
      <TouchableOpacity style={st.toggleTextWrap} onPress={onPress} activeOpacity={0.6}>
        <Text style={[st.toggleLabel, on && st.toggleLabelOn]}>{def.label}</Text>
        <Text style={st.toggleDesc} numberOfLines={2}>{def.desc}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={st.infoBtn} onPress={onInfo} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
        <InfoCircle size={18} color="rgba(255,255,255,0.3)" variant="Linear" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        <View style={[st.track, on && st.trackOn]}>
          <View style={[st.thumb, on && st.thumbOn]} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080816' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#fff', fontSize: 22, fontFamily: 'TenorSans_400Regular' },
  body: { flex: 1, paddingHorizontal: 16 },

  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  cardTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, paddingHorizontal: 16, paddingBottom: 6, lineHeight: 16 },

  bortleDisplay: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 14 },
  bortleNum: { fontSize: 44, fontWeight: '900', lineHeight: 50 },
  bortleInfo: { flex: 1 },
  bortleName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bortleSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  scaleBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 4, marginBottom: 4 },
  scaleSegment: { flex: 1, height: 28, borderRadius: 6 },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  scaleLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10 },

  section: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 6, marginLeft: 4 },

  // Ground picker
  groundRow: { paddingHorizontal: 12, paddingBottom: 14, paddingTop: 4, gap: 10 },
  groundCard: { width: 96, borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  groundCardActive: { borderColor: '#d4c5a0' },
  groundThumb: { width: '100%', height: 60, backgroundColor: '#0c1208' },
  groundCheck: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(8,8,22,0.7)', borderRadius: 10 },
  groundName: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center' },
  groundNameActive: { color: '#d4c5a0' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  toggleBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  iconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  toggleTextWrap: { flex: 1 },
  toggleLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '600' },
  toggleLabelOn: { color: 'rgba(255,255,255,0.95)' },
  toggleDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2, lineHeight: 16 },
  infoBtn: { padding: 2 },
  track: { width: 44, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', padding: 2 },
  trackOn: { backgroundColor: '#d4c5a0' },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.3)' },
  thumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },

  // Info popup
  infoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  infoCard: { backgroundColor: '#141422', borderRadius: 18, padding: 22, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  infoIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  infoTitle: { flex: 1, color: '#fff', fontSize: 18, fontFamily: 'TenorSans_400Regular' },
  infoBody: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 21 },
});
