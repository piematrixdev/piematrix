/**
 * TelescopeScreen — Your personal observing assistant.
 * Shows telescope capabilities and tonight's best targets in one flowing layout.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  StatusBar, Dimensions, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft2, Discover, Star1, Global, Moon as MoonIcon, Edit2,
  Eye, Setting4,
} from 'iconsax-react-native';
import type { GeographicCoordinates } from '@virtual-window/astronomy-engine';
import {
  TelescopeSpec, TelescopeCapabilities, ObservingTarget,
  TELESCOPE_PRESETS, computeCapabilities, getTelescopeTargets,
} from './TelescopeProfile';
import { computeTonightsSky } from './tonightsSky';
import { fetchFeaturedProducts, Product } from './shopify';
import LazyImage from './components/LazyImage';
import SkyIcon from './components/SkyIcon';

const { width: W } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';

interface Props {
  observer: GeographicCoordinates;
  onClose: () => void;
}

function parseSpecsFromProduct(product: Product): TelescopeSpec | null {
  const text = `${product.title} ${product.description} ${product.tags.join(' ')}`.toLowerCase();
  let aperture = 0;
  const apMatch = text.match(/(\d+)\s*mm\s*(aperture|mirror|lens|objective)/i)
    ?? text.match(/(aperture|mirror|lens|objective)\s*[:\-]?\s*(\d+)\s*mm/i)
    ?? text.match(/(\d{2,3})\s*mm\s*(reflector|refractor|newtonian|dobsonian|mak|sct)/i)
    ?? product.title.match(/(\d{2,3})\s*mm/i);
  if (apMatch) aperture = parseInt(apMatch[1] || apMatch[2], 10);
  for (const tag of product.tags) {
    const m = tag.match(/aperture[:\-](\d+)/i);
    if (m) aperture = parseInt(m[1], 10);
  }
  let focalLength = 0;
  const flMatch = text.match(/(\d{3,4})\s*mm\s*(focal|fl\b)/i)
    ?? text.match(/(focal\s*length|fl)\s*[:\-]?\s*(\d{3,4})\s*mm/i);
  if (flMatch) focalLength = parseInt(flMatch[1] || flMatch[2], 10);
  for (const tag of product.tags) {
    const m = tag.match(/focal[:\-](\d+)/i) ?? tag.match(/fl[:\-](\d+)/i);
    if (m) focalLength = parseInt(m[1], 10);
  }
  let type: TelescopeSpec['type'] = 'reflector';
  if (text.includes('refractor')) type = 'refractor';
  else if (text.includes('catadioptric') || text.includes('sct') || text.includes('mak')) type = 'catadioptric';
  else if (text.includes('binocular')) type = 'binoculars';
  if (!aperture) {
    const inchMatch = product.title.match(/(\d+)["\s]*(?:inch|")/i);
    if (inchMatch) aperture = Math.round(parseInt(inchMatch[1], 10) * 25.4);
  }
  if (!aperture) return null;
  if (!focalLength) {
    if (type === 'reflector') focalLength = aperture * 5;
    else if (type === 'refractor') focalLength = aperture * 6;
    else if (type === 'catadioptric') focalLength = aperture * 10;
    else focalLength = aperture * 5;
  }
  return { name: product.title, type, aperture, focalLength, eyepieceFl: 25, eyepieceAfov: 52, barlow: 1, mount: type === 'reflector' && aperture >= 200 ? 'dobsonian' : 'equatorial' };
}

export default function TelescopeScreen({ observer, onClose }: Props) {
  const [shopProducts, setShopProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [spec, setSpec] = useState<TelescopeSpec>(TELESCOPE_PRESETS['beginner-reflector']);
  const [caps, setCaps] = useState<TelescopeCapabilities>(computeCapabilities(spec));
  const [targets, setTargets] = useState<ObservingTarget[]>([]);
  const [showSpecEditor, setShowSpecEditor] = useState(false);
  const [detailTarget, setDetailTarget] = useState<ObservingTarget | null>(null);

  useEffect(() => {
    fetchFeaturedProducts(50).then(products => {
      setShopProducts(products);
      for (const p of products) {
        const parsed = parseSpecsFromProduct(p);
        if (parsed) { setSelectedProduct(p); setSpec(parsed); break; }
      }
    });
  }, []);

  useEffect(() => {
    const newCaps = computeCapabilities(spec);
    setCaps(newCaps);
    if (observer.latitude !== 0 || observer.longitude !== 0) {
      const skyData = computeTonightsSky(observer);
      const dsos = skyData.deepSky.map(d => ({ id: d.id, name: d.name, type: d.type, magnitude: d.magnitude, altitude: d.altitude, azimuth: d.azimuth, ra: d.ra, dec: d.dec }));
      const planets = skyData.planets.map(p => ({ name: p.name, magnitude: p.magnitude, altitude: p.altitude, azimuth: p.azimuth, ra: p.ra, dec: p.dec }));
      setTargets(getTelescopeTargets(spec, dsos, planets));
    }
  }, [spec, observer.latitude]);

  const selectProduct = (product: Product) => {
    const parsed = parseSpecsFromProduct(product);
    if (parsed) { setSpec(parsed); setSelectedProduct(product); }
  };

  const updateSpec = (key: keyof TelescopeSpec, value: any) => setSpec(prev => ({ ...prev, [key]: value }));
  const diffColor = (d: string) => d === 'easy' ? '#4ade80' : d === 'moderate' ? '#fbbf24' : '#ef4444';
  const typeIcon = (type: string) => {
    if (type === 'Planet') return <Global size={15} color="#f59e0b" variant="Bulk" />;
    if (type === 'Moon') return <MoonIcon size={15} color="#e2e8f0" variant="Bulk" />;
    return <SkyIcon name="orbit" size={15} color="#c9b896" />;
  };

  const easyTargets = targets.filter(t => t.difficulty === 'easy');
  const moderateTargets = targets.filter(t => t.difficulty === 'moderate');
  const challengingTargets = targets.filter(t => t.difficulty === 'challenging');

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0a0a1a', '#050510', '#030308']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <ArrowLeft2 size={22} color="#fff" variant="Linear" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>My Telescope</Text>
          <Text style={s.headerSub}>
            {selectedProduct ? selectedProduct.title : `${spec.aperture}mm ${spec.type} · f/${(spec.focalLength / spec.aperture).toFixed(1)}`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowSpecEditor(true)} style={s.settingsBtn}>
          <Setting4 size={20} color="rgba(255,255,255,0.6)" variant="Bulk" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Select your device */}
        <Text style={s.sectionLabel}>SELECT YOUR TELESCOPE</Text>
        <Text style={s.sectionHint}>Pick the device you own to get personalized observing targets</Text>

        {shopProducts.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.deviceScroll} style={{ marginBottom: 16 }}>
            {shopProducts.map(p => {
              const parsed = parseSpecsFromProduct(p);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.deviceCard, selectedProduct?.id === p.id && s.deviceCardActive, !parsed && s.deviceCardNoSpec]}
                  onPress={() => parsed ? selectProduct(p) : null}
                  activeOpacity={parsed ? 0.85 : 0.6}
                >
                  {p.image && <LazyImage uri={p.image} width={'100%'} height={100} borderRadius={12} resizeMode="cover" />}
                  <View style={s.deviceInfo}>
                    <Text style={[s.deviceTitle, selectedProduct?.id === p.id && { color: '#fff' }]} numberOfLines={2}>{p.title}</Text>
                    {parsed ? (
                      <Text style={s.deviceSpec}>{parsed.aperture}mm · {parsed.type}</Text>
                    ) : (
                      <Text style={s.deviceNoSpec}>Specs not detected</Text>
                    )}
                  </View>
                  {selectedProduct?.id === p.id && <View style={s.deviceCheck}><Text style={s.deviceCheckText}>✓</Text></View>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <Text style={s.orLabel}>Don't have one? Choose a preset:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetScroll}>
          {Object.entries(TELESCOPE_PRESETS).map(([key, preset]) => (
            <TouchableOpacity
              key={key}
              style={[s.presetCard, spec.name === preset.name && !selectedProduct && s.presetCardActive]}
              onPress={() => { setSpec(preset); setSelectedProduct(null); }}
            >
              <Text style={[s.presetName, spec.name === preset.name && !selectedProduct && { color: '#e8dcc8' }]}>{preset.name}</Text>
              <Text style={s.presetSpec}>{preset.aperture}mm · f/{(preset.focalLength / preset.aperture).toFixed(0)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* What your telescope can see */}
        <Text style={[s.sectionLabel, { marginTop: 28 }]}>WHAT IT CAN SEE</Text>
        <View style={s.capsGrid}>
          <View style={s.capCard}>
            <Text style={s.capValue}>{caps.magnification}×</Text>
            <Text style={s.capLabel}>Magnification</Text>
            <Text style={s.capHint}>How much it zooms in</Text>
          </View>
          <View style={s.capCard}>
            <Text style={s.capValue}>{caps.trueFov}°</Text>
            <Text style={s.capLabel}>Field of View</Text>
            <Text style={s.capHint}>How much sky you see</Text>
          </View>
          <View style={s.capCard}>
            <Text style={s.capValue}>{caps.limitingMagnitude}</Text>
            <Text style={s.capLabel}>Faintest Star</Text>
            <Text style={s.capHint}>Higher = fainter objects</Text>
          </View>
          <View style={s.capCard}>
            <Text style={s.capValue}>{caps.lightGathering}×</Text>
            <Text style={s.capLabel}>Light Gathering</Text>
            <Text style={s.capHint}>vs naked eye</Text>
          </View>
          <View style={s.capCard}>
            <Text style={s.capValue}>{caps.maxMagnification}×</Text>
            <Text style={s.capLabel}>Max Useful Power</Text>
            <Text style={s.capHint}>Beyond this gets blurry</Text>
          </View>
          <View style={s.capCard}>
            <Text style={s.capValue}>{caps.exitPupil}mm</Text>
            <Text style={s.capLabel}>Exit Pupil</Text>
            <Text style={s.capHint}>Light beam to your eye</Text>
          </View>
        </View>

        {/* Tonight's targets */}
        <Text style={[s.sectionLabel, { marginTop: 28 }]}>TONIGHT'S TARGETS</Text>
        <Text style={s.sectionHint}>{targets.length} objects your telescope can see tonight</Text>

          {targets.length === 0 && (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No targets available. Check your location settings.</Text>
            </View>
          )}

          {/* Easy targets */}
          {easyTargets.length > 0 && (
            <View style={s.diffSection}>
              <View style={s.diffHeader}>
                <View style={[s.diffDot, { backgroundColor: '#4ade80' }]} />
                <Text style={s.diffLabel}>Easy — Great for beginners</Text>
              </View>
              {easyTargets.map(t => (
                <TouchableOpacity key={t.id} style={s.targetCard} activeOpacity={0.85} onPress={() => setDetailTarget(t)}>
                  <View style={s.targetRow}>
                    {typeIcon(t.type)}
                    <View style={s.targetInfo}>
                      <Text style={s.targetName}>{t.name}</Text>
                      <Text style={s.targetMeta}>{t.type} · mag {t.magnitude.toFixed(1)} · Alt {Math.round(t.altitude)}°</Text>
                    </View>
                    <Text style={s.targetArrow}>›</Text>
                  </View>
                  <Text style={s.targetTip}>{t.tip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Moderate targets */}
          {moderateTargets.length > 0 && (
            <View style={s.diffSection}>
              <View style={s.diffHeader}>
                <View style={[s.diffDot, { backgroundColor: '#fbbf24' }]} />
                <Text style={s.diffLabel}>Moderate — Some experience helpful</Text>
              </View>
              {moderateTargets.map(t => (
                <TouchableOpacity key={t.id} style={s.targetCard} activeOpacity={0.85} onPress={() => setDetailTarget(t)}>
                  <View style={s.targetRow}>
                    {typeIcon(t.type)}
                    <View style={s.targetInfo}>
                      <Text style={s.targetName}>{t.name}</Text>
                      <Text style={s.targetMeta}>{t.type} · mag {t.magnitude.toFixed(1)} · Alt {Math.round(t.altitude)}°</Text>
                    </View>
                    <Text style={s.targetArrow}>›</Text>
                  </View>
                  <Text style={s.targetTip}>{t.tip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Challenging targets */}
          {challengingTargets.length > 0 && (
            <View style={s.diffSection}>
              <View style={s.diffHeader}>
                <View style={[s.diffDot, { backgroundColor: '#ef4444' }]} />
                <Text style={s.diffLabel}>Challenging — For experienced observers</Text>
              </View>
              {challengingTargets.map(t => (
                <TouchableOpacity key={t.id} style={s.targetCard} activeOpacity={0.85} onPress={() => setDetailTarget(t)}>
                  <View style={s.targetRow}>
                    {typeIcon(t.type)}
                    <View style={s.targetInfo}>
                      <Text style={s.targetName}>{t.name}</Text>
                      <Text style={s.targetMeta}>{t.type} · mag {t.magnitude.toFixed(1)} · Alt {Math.round(t.altitude)}°</Text>
                    </View>
                    <Text style={s.targetArrow}>›</Text>
                  </View>
                  <Text style={s.targetTip}>{t.tip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
      </ScrollView>

      {/* Spec Editor Modal */}
      {showSpecEditor && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowSpecEditor(false)}>
          <Pressable style={s.modalOverlay} onPress={() => setShowSpecEditor(false)}>
            <Pressable style={s.modalContent} onPress={() => {}}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Telescope Setup</Text>
                <TouchableOpacity onPress={() => setShowSpecEditor(false)}>
                  <Text style={s.modalClose}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={s.specGrid}>
                <View style={s.specItem}>
                  <Text style={s.specLabel}>Aperture (mm)</Text>
                  <TextInput style={s.specInput} value={String(spec.aperture)} onChangeText={v => updateSpec('aperture', parseFloat(v) || 0)} keyboardType="numeric" placeholderTextColor="rgba(255,255,255,0.2)" />
                </View>
                <View style={s.specItem}>
                  <Text style={s.specLabel}>Focal Length (mm)</Text>
                  <TextInput style={s.specInput} value={String(spec.focalLength)} onChangeText={v => updateSpec('focalLength', parseFloat(v) || 0)} keyboardType="numeric" placeholderTextColor="rgba(255,255,255,0.2)" />
                </View>
                <View style={s.specItem}>
                  <Text style={s.specLabel}>Eyepiece (mm)</Text>
                  <TextInput style={s.specInput} value={String(spec.eyepieceFl)} onChangeText={v => updateSpec('eyepieceFl', parseFloat(v) || 0)} keyboardType="numeric" placeholderTextColor="rgba(255,255,255,0.2)" />
                </View>
                <View style={s.specItem}>
                  <Text style={s.specLabel}>Eyepiece AFOV (°)</Text>
                  <TextInput style={s.specInput} value={String(spec.eyepieceAfov)} onChangeText={v => updateSpec('eyepieceAfov', parseFloat(v) || 0)} keyboardType="numeric" placeholderTextColor="rgba(255,255,255,0.2)" />
                </View>
                <View style={s.specItem}>
                  <Text style={s.specLabel}>Barlow</Text>
                  <TextInput style={s.specInput} value={String(spec.barlow)} onChangeText={v => updateSpec('barlow', parseFloat(v) || 1)} keyboardType="numeric" placeholderTextColor="rgba(255,255,255,0.2)" />
                </View>
              </View>
              <View style={s.capsCard}>
                <View style={s.capsRow}>
                  <View style={s.capItem}><Text style={s.capValue}>{caps.magnification}×</Text><Text style={s.capLabel}>Magnification</Text></View>
                  <View style={s.capItem}><Text style={s.capValue}>{caps.trueFov}°</Text><Text style={s.capLabel}>True FOV</Text></View>
                  <View style={s.capItem}><Text style={s.capValue}>{caps.maxMagnification}×</Text><Text style={s.capLabel}>Max Useful</Text></View>
                </View>
                <View style={s.capsRow}>
                  <View style={s.capItem}><Text style={s.capValue}>{caps.exitPupil}mm</Text><Text style={s.capLabel}>Exit Pupil</Text></View>
                  <View style={s.capItem}><Text style={s.capValue}>{caps.lightGathering}×</Text><Text style={s.capLabel}>Light Power</Text></View>
                  <View style={s.capItem}><Text style={s.capValue}>{caps.limitingMagnitude}</Text><Text style={s.capLabel}>Faintest Mag</Text></View>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Target Detail Modal */}
      {detailTarget && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setDetailTarget(null)}>
          <Pressable style={s.modalOverlay} onPress={() => setDetailTarget(null)}>
            <Pressable style={s.modalContent} onPress={() => {}}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{detailTarget.name}</Text>
                <TouchableOpacity onPress={() => setDetailTarget(null)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={s.detailBadges}>
                <View style={[s.badge, { backgroundColor: 'rgba(200,185,150,0.1)' }]}>
                  <Text style={s.badgeText}>{detailTarget.type}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: diffColor(detailTarget.difficulty) + '15' }]}>
                  <Text style={[s.badgeText, { color: diffColor(detailTarget.difficulty) }]}>{detailTarget.difficulty}</Text>
                </View>
                {!detailTarget.fitsInFov && (
                  <View style={[s.badge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Text style={[s.badgeText, { color: '#ef4444' }]}>Larger than FOV</Text>
                  </View>
                )}
              </View>

              <View style={s.tipBox}>
                <Text style={s.tipText}>💡 {detailTarget.tip}</Text>
              </View>

              <View style={s.detailGrid}>
                <View style={s.detailCell}>
                  <Text style={s.detailLabel}>Magnitude</Text>
                  <Text style={s.detailValue}>{detailTarget.magnitude.toFixed(1)}</Text>
                </View>
                <View style={s.detailCell}>
                  <Text style={s.detailLabel}>Altitude</Text>
                  <Text style={s.detailValue}>{detailTarget.altitude.toFixed(0)}°</Text>
                </View>
                <View style={s.detailCell}>
                  <Text style={s.detailLabel}>Direction</Text>
                  <Text style={s.detailValue}>{detailTarget.azimuth > 0 ? `${detailTarget.azimuth.toFixed(0)}° ${cardinal(detailTarget.azimuth)}` : '—'}</Text>
                </View>
                <View style={s.detailCell}>
                  <Text style={s.detailLabel}>RA</Text>
                  <Text style={s.detailValue}>{detailTarget.ra > 0 ? `${Math.floor(detailTarget.ra)}h ${Math.round((detailTarget.ra % 1) * 60)}m` : '—'}</Text>
                </View>
                <View style={s.detailCell}>
                  <Text style={s.detailLabel}>Dec</Text>
                  <Text style={s.detailValue}>{detailTarget.dec !== 0 ? `${detailTarget.dec > 0 ? '+' : ''}${detailTarget.dec.toFixed(1)}°` : '—'}</Text>
                </View>
                <View style={s.detailCell}>
                  <Text style={s.detailLabel}>Score</Text>
                  <Text style={s.detailValue}>{Math.round(detailTarget.score)}/100</Text>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function cardinal(az: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(az / 45) % 8];
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 58, paddingHorizontal: 20, paddingBottom: 12, gap: 14 },
  backBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 22, fontFamily: F_TITLE },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 2 },
  settingsBtn: { padding: 8 },
  scroll: { paddingBottom: 140, paddingHorizontal: 20 },

  // Section labels
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_BOLD, letterSpacing: 1.5, marginTop: 8, marginBottom: 4 },
  sectionHint: { color: 'rgba(255,255,255,0.25)', fontSize: 13, fontFamily: F_LIGHT, marginBottom: 16 },

  // Device selection
  deviceScroll: { gap: 12, paddingBottom: 4 },
  deviceCard: { width: 160, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)' },
  deviceCardActive: { borderColor: '#d4c5a0', backgroundColor: 'rgba(200,185,150,0.06)' },
  deviceCardNoSpec: { opacity: 0.6 },
  deviceInfo: { padding: 10 },
  deviceTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: F_MEDIUM, lineHeight: 16 },
  deviceSpec: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: F_LIGHT, marginTop: 3 },
  deviceNoSpec: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: F_LIGHT, marginTop: 3, fontStyle: 'italic' },
  deviceCheck: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#d4c5a0', justifyContent: 'center', alignItems: 'center' },
  deviceCheckText: { color: '#030308', fontSize: 14, fontWeight: '800' },
  orLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 18, marginBottom: 10 },

  // Presets
  presetScroll: { gap: 10, paddingBottom: 4 },
  presetCard: { backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', minWidth: 120 },
  presetCardActive: { backgroundColor: 'rgba(200,185,150,0.12)', borderColor: 'rgba(210,195,160,0.4)' },
  presetName: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: F_REG },
  presetSpec: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: F_LIGHT, marginTop: 3 },

  // Capabilities grid
  capsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  capCard: { width: (W - 50) / 2 - 5, backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)' },
  capValue: { color: '#fff', fontSize: 20, fontFamily: F_BOLD },
  capLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: F_REG, marginTop: 4 },
  capHint: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: F_LIGHT, marginTop: 2 },

  // Difficulty sections
  diffSection: { marginBottom: 16, marginTop: 12 },
  diffHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  diffDot: { width: 8, height: 8, borderRadius: 4 },
  diffLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontFamily: F_LIGHT },

  // Target cards
  targetCard: { backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.04)' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  targetInfo: { flex: 1 },
  targetName: { color: '#fff', fontSize: 14, fontFamily: F_MEDIUM },
  targetMeta: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: F_LIGHT, marginTop: 2 },
  targetArrow: { color: 'rgba(255,255,255,0.2)', fontSize: 22, fontFamily: F_LIGHT },
  targetTip: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_LIGHT, marginTop: 8, lineHeight: 15 },

  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: F_LIGHT, textAlign: 'center' },

  // Spec editor modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0c0c18', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 20, fontFamily: F_TITLE },
  modalClose: { color: '#d4c5a0', fontSize: 14, fontFamily: F_BOLD },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  specItem: { width: (W - 58) / 2 - 5 },
  specLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_LIGHT, marginBottom: 4 },
  specInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 15, fontFamily: F_REG, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  capsCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, gap: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  capsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  capItem: { alignItems: 'center', flex: 1 },
  capValue: { color: '#fff', fontSize: 15, fontFamily: F_BOLD },
  capLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: F_LIGHT, marginTop: 2 },

  // Detail modal
  detailBadges: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#d4c5a0', fontSize: 11, fontFamily: F_BOLD, textTransform: 'uppercase', letterSpacing: 0.5 },
  tipBox: { backgroundColor: 'rgba(200,185,150,0.06)', borderRadius: 12, padding: 14, marginBottom: 18, borderWidth: 0.5, borderColor: 'rgba(200,185,150,0.15)' },
  tipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F_LIGHT, lineHeight: 19 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  detailCell: { width: '33%', marginBottom: 18 },
  detailLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: F_LIGHT },
  detailValue: { color: '#fff', fontSize: 15, fontFamily: F_BOLD, marginTop: 3 },
});
