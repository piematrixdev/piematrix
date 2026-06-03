/**
 * TelescopeScreen — Pick your telescope from the shop and get personalized targets.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  StatusBar, Dimensions, Image, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft2, Discover, Star1, Global, Moon as MoonIcon, Edit2,
} from 'iconsax-react-native';
import type { GeographicCoordinates } from '@virtual-window/astronomy-engine';
import {
  TelescopeSpec, TelescopeCapabilities, ObservingTarget,
  TELESCOPE_PRESETS, computeCapabilities, getTelescopeTargets,
} from './TelescopeProfile';
import { computeTonightsSky } from './tonightsSky';
import { fetchFeaturedProducts, Product } from './shopify';
import LazyImage from './components/LazyImage';

const { width: W } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'TenorSans_400Regular';

interface Props {
  observer: GeographicCoordinates;
  onClose: () => void;
}

/**
 * Parse telescope specs from a Shopify product.
 * Looks in title, description, and tags for aperture/focal length info.
 */
function parseSpecsFromProduct(product: Product): TelescopeSpec | null {
  const text = `${product.title} ${product.description} ${product.tags.join(' ')}`.toLowerCase();

  // Try to extract aperture (mm)
  let aperture = 0;
  const apMatch = text.match(/(\d+)\s*mm\s*(aperture|mirror|lens|objective)/i)
    ?? text.match(/(aperture|mirror|lens|objective)\s*[:\-]?\s*(\d+)\s*mm/i)
    ?? text.match(/(\d{2,3})\s*mm\s*(reflector|refractor|newtonian|dobsonian|mak|sct)/i)
    ?? product.title.match(/(\d{2,3})\s*mm/i);
  if (apMatch) {
    aperture = parseInt(apMatch[1] || apMatch[2], 10);
  }
  // Try from tags like "aperture:130" or "aperture-130"
  for (const tag of product.tags) {
    const tagMatch = tag.match(/aperture[:\-](\d+)/i);
    if (tagMatch) aperture = parseInt(tagMatch[1], 10);
  }

  // Try to extract focal length
  let focalLength = 0;
  const flMatch = text.match(/(\d{3,4})\s*mm\s*(focal|fl\b)/i)
    ?? text.match(/(focal\s*length|fl)\s*[:\-]?\s*(\d{3,4})\s*mm/i);
  if (flMatch) {
    focalLength = parseInt(flMatch[1] || flMatch[2], 10);
  }
  for (const tag of product.tags) {
    const tagMatch = tag.match(/focal[:\-](\d+)/i) ?? tag.match(/fl[:\-](\d+)/i);
    if (tagMatch) focalLength = parseInt(tagMatch[1], 10);
  }

  // Determine type
  let type: TelescopeSpec['type'] = 'reflector';
  if (text.includes('refractor')) type = 'refractor';
  else if (text.includes('catadioptric') || text.includes('sct') || text.includes('mak')) type = 'catadioptric';
  else if (text.includes('binocular')) type = 'binoculars';

  // If we couldn't parse aperture, try from title patterns like "8 inch" or "8""
  if (!aperture) {
    const inchMatch = product.title.match(/(\d+)["\s]*(?:inch|")/i);
    if (inchMatch) aperture = Math.round(parseInt(inchMatch[1], 10) * 25.4);
  }

  // If still no aperture, can't build a spec
  if (!aperture) return null;

  // Estimate focal length if not found (use typical f-ratios)
  if (!focalLength) {
    if (type === 'reflector') focalLength = aperture * 5; // f/5 typical
    else if (type === 'refractor') focalLength = aperture * 6;
    else if (type === 'catadioptric') focalLength = aperture * 10;
    else focalLength = aperture * 5;
  }

  return {
    name: product.title,
    type,
    aperture,
    focalLength,
    eyepieceFl: 25,
    eyepieceAfov: 52,
    barlow: 1,
    mount: type === 'reflector' && aperture >= 200 ? 'dobsonian' : 'equatorial',
  };
}

export default function TelescopeScreen({ observer, onClose }: Props) {
  const [shopProducts, setShopProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [spec, setSpec] = useState<TelescopeSpec>(TELESCOPE_PRESETS['beginner-reflector']);
  const [caps, setCaps] = useState<TelescopeCapabilities>(computeCapabilities(spec));
  const [targets, setTargets] = useState<ObservingTarget[]>([]);
  const [showSetup, setShowSetup] = useState(true);
  const [customMode, setCustomMode] = useState(false);
  const [detailTarget, setDetailTarget] = useState<ObservingTarget | null>(null);

  // Fetch telescopes from shop
  useEffect(() => {
    fetchFeaturedProducts(10).then(products => {
      setShopProducts(products);
      // Auto-select first product that has parseable specs
      for (const p of products) {
        const parsed = parseSpecsFromProduct(p);
        if (parsed) {
          setSelectedProduct(p);
          setSpec(parsed);
          break;
        }
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
      const t = getTelescopeTargets(spec, dsos, planets);
      setTargets(t);
    }
  }, [spec, observer.latitude]);

  const selectProduct = (product: Product) => {
    const parsed = parseSpecsFromProduct(product);
    if (parsed) {
      setSpec(parsed);
      setSelectedProduct(product);
      setCustomMode(false);
    }
  };

  const updateSpec = (key: keyof TelescopeSpec, value: any) => {
    setSpec(prev => ({ ...prev, [key]: value }));
  };

  const difficultyColor = (d: string) => d === 'easy' ? '#4ade80' : d === 'moderate' ? '#fbbf24' : '#ef4444';
  const typeIcon = (type: string) => {
    if (type === 'Planet') return <Global size={16} color="#f59e0b" variant="Bulk" />;
    if (type === 'Moon') return <MoonIcon size={16} color="#e2e8f0" variant="Bulk" />;
    return <Discover size={16} color="#c9b896" variant="Bulk" />;
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#080818', '#050510', '#030308']} style={s.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <ArrowLeft2 size={22} color="#fff" variant="Linear" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Telescope</Text>
        <TouchableOpacity onPress={() => setShowSetup(!showSetup)} style={s.toggleBtn}>
          <Text style={s.toggleText}>{showSetup ? 'Targets' : 'Setup'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {showSetup ? (
          <>
            {/* Your telescopes from shop */}
            <Text style={s.sectionLabel}>Your Telescopes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shopRow}>
              {shopProducts.map(p => {
                const parseable = !!parseSpecsFromProduct(p);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.shopCard, selectedProduct?.id === p.id && s.shopCardActive]}
                    onPress={() => parseable && selectProduct(p)}
                    activeOpacity={parseable ? 0.9 : 0.5}
                  >
                    {p.image && <LazyImage uri={p.image} width={'100%'} height={100} borderRadius={10} resizeMode="cover" />}
                    <Text style={s.shopCardTitle} numberOfLines={2}>{p.title}</Text>
                    {!parseable && <Text style={s.shopCardWarn}>Specs not found</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Or use a preset */}
            <Text style={s.sectionLabel}>Or Choose a Preset</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetRow}>
              {Object.entries(TELESCOPE_PRESETS).map(([key, preset]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.presetPill, spec.name === preset.name && !selectedProduct && s.presetPillActive]}
                  onPress={() => { setSpec(preset); setSelectedProduct(null); setCustomMode(false); }}
                >
                  <Text style={[s.presetText, spec.name === preset.name && !selectedProduct && s.presetTextActive]}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Current spec display / edit */}
            <View style={s.specHeader}>
              <Text style={s.sectionLabel}>Specifications</Text>
              <TouchableOpacity onPress={() => setCustomMode(!customMode)}>
                <Edit2 size={16} color={customMode ? '#d4c5a0' : 'rgba(255,255,255,0.3)'} variant="Linear" />
              </TouchableOpacity>
            </View>

            {customMode ? (
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
            ) : (
              <View style={s.specSummary}>
                <Text style={s.specSummaryText}>
                  {spec.aperture}mm {spec.type} • f/{(spec.focalLength / spec.aperture).toFixed(1)} • {spec.focalLength}mm FL
                </Text>
              </View>
            )}

            {/* Computed capabilities */}
            <Text style={s.sectionLabel}>Capabilities</Text>
            <View style={s.capsCard}>
              <View style={s.capsRow}>
                <View style={s.capItem}><Text style={s.capValue}>{caps.magnification}x</Text><Text style={s.capLabel}>Magnification</Text></View>
                <View style={s.capItem}><Text style={s.capValue}>{caps.trueFov}°</Text><Text style={s.capLabel}>True FOV</Text></View>
                <View style={s.capItem}><Text style={s.capValue}>{caps.limitingMagnitude}</Text><Text style={s.capLabel}>Limit Mag</Text></View>
              </View>
              <View style={s.capsRow}>
                <View style={s.capItem}><Text style={s.capValue}>{caps.exitPupil}mm</Text><Text style={s.capLabel}>Exit Pupil</Text></View>
                <View style={s.capItem}><Text style={s.capValue}>{caps.lightGathering}x</Text><Text style={s.capLabel}>Light Power</Text></View>
                <View style={s.capItem}><Text style={s.capValue}>{caps.maxMagnification}x</Text><Text style={s.capLabel}>Max Useful</Text></View>
              </View>
            </View>

            <TouchableOpacity style={s.viewTargetsBtn} onPress={() => setShowSetup(false)}>
              <Text style={s.viewTargetsBtnText}>View Tonight's Targets →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Targets list */}
            <View style={s.targetHeader}>
              <Text style={s.targetHeaderTitle}>Tonight's Targets</Text>
              <Text style={s.targetHeaderSub}>
                {targets.length} objects for your {spec.aperture}mm {spec.type}
              </Text>
            </View>

            {targets.map((t) => (
              <TouchableOpacity key={t.id} style={s.targetCard} activeOpacity={0.85} onPress={() => setDetailTarget(t)}>
                <View style={s.targetTop}>
                  <View style={s.targetLeft}>
                    {typeIcon(t.type)}
                    <View style={{ flex: 1 }}>
                      <Text style={s.targetName}>{t.name}</Text>
                      <Text style={s.targetType}>{t.type} • mag {t.magnitude.toFixed(1)} • {Math.round(t.altitude)}° alt</Text>
                    </View>
                  </View>
                  <View style={[s.diffBadge, { backgroundColor: difficultyColor(t.difficulty) + '20', borderColor: difficultyColor(t.difficulty) + '40' }]}>
                    <Text style={[s.diffText, { color: difficultyColor(t.difficulty) }]}>{t.difficulty}</Text>
                  </View>
                </View>
                <Text style={s.targetTip}>💡 {t.tip}</Text>
                {!t.fitsInFov && (
                  <Text style={s.targetWarn}>⚠️ Larger than your FOV — use lower magnification</Text>
                )}
              </TouchableOpacity>
            ))}

            {targets.length === 0 && (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>No targets computed yet. Make sure location is available.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Target detail modal */}
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
              <View style={s.modalBadgeRow}>
                <View style={[s.modalBadge, { backgroundColor: 'rgba(200,185,150,0.1)' }]}>
                  <Text style={s.modalBadgeText}>{detailTarget.type}</Text>
                </View>
                <View style={[s.modalBadge, { backgroundColor: difficultyColor(detailTarget.difficulty) + '15' }]}>
                  <Text style={[s.modalBadgeText, { color: difficultyColor(detailTarget.difficulty) }]}>{detailTarget.difficulty}</Text>
                </View>
              </View>
              <Text style={s.modalTip}>💡 {detailTarget.tip}</Text>
              <View style={s.modalDivider} />
              <Text style={s.modalSectionLabel}>COORDINATES</Text>
              <View style={s.modalDataGrid}>
                <View style={s.modalDataCell}>
                  <Text style={s.modalDataLabel}>RA</Text>
                  <Text style={s.modalDataValue}>{detailTarget.ra > 0 ? `${Math.floor(detailTarget.ra)}h ${Math.round((detailTarget.ra % 1) * 60)}m` : '—'}</Text>
                </View>
                <View style={s.modalDataCell}>
                  <Text style={s.modalDataLabel}>Dec</Text>
                  <Text style={s.modalDataValue}>{detailTarget.dec !== 0 ? `${detailTarget.dec > 0 ? '+' : ''}${detailTarget.dec.toFixed(1)}°` : '—'}</Text>
                </View>
                <View style={s.modalDataCell}>
                  <Text style={s.modalDataLabel}>Altitude</Text>
                  <Text style={s.modalDataValue}>{detailTarget.altitude.toFixed(1)}°</Text>
                </View>
                <View style={s.modalDataCell}>
                  <Text style={s.modalDataLabel}>Azimuth</Text>
                  <Text style={s.modalDataValue}>{detailTarget.azimuth > 0 ? `${detailTarget.azimuth.toFixed(1)}°` : '—'}</Text>
                </View>
              </View>
              <View style={s.modalDivider} />
              <Text style={s.modalSectionLabel}>OBSERVING DATA</Text>
              <View style={s.modalDataGrid}>
                <View style={s.modalDataCell}>
                  <Text style={s.modalDataLabel}>Magnitude</Text>
                  <Text style={s.modalDataValue}>{detailTarget.magnitude.toFixed(1)}</Text>
                </View>
                <View style={s.modalDataCell}>
                  <Text style={s.modalDataLabel}>Fits FOV</Text>
                  <Text style={s.modalDataValue}>{detailTarget.fitsInFov ? 'Yes' : 'No'}</Text>
                </View>
                <View style={s.modalDataCell}>
                  <Text style={s.modalDataLabel}>Direction</Text>
                  <Text style={s.modalDataValue}>{detailTarget.azimuth > 0 ? (detailTarget.azimuth < 90 ? 'NE' : detailTarget.azimuth < 180 ? 'SE' : detailTarget.azimuth < 270 ? 'SW' : 'NW') : '—'}</Text>
                </View>
                <View style={s.modalDataCell}>
                  <Text style={s.modalDataLabel}>Score</Text>
                  <Text style={s.modalDataValue}>{Math.round(detailTarget.score)}</Text>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },
  bg: { ...StyleSheet.absoluteFillObject },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 58, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: F_TITLE },
  toggleBtn: { backgroundColor: 'rgba(200,185,150,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  toggleText: { color: '#e8dcc8', fontSize: 12, fontFamily: F_REG },
  scroll: { paddingBottom: 50, paddingHorizontal: 20 },

  sectionLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_REG, marginTop: 24, marginBottom: 12, letterSpacing: 0.5 },

  // Shop telescope cards
  shopRow: { gap: 10, paddingBottom: 4 },
  shopCard: { width: 120, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)' },
  shopCardActive: { borderColor: 'rgba(210,195,160,0.5)', backgroundColor: 'rgba(200,185,150,0.08)' },
  shopCardImg: { width: 120, height: 90, backgroundColor: '#0c0c14' },
  shopCardTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: F_REG, padding: 8, lineHeight: 14 },
  shopCardWarn: { color: 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: F_LIGHT, paddingHorizontal: 8, paddingBottom: 8 },

  // Spec header with edit button
  specHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  specSummary: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  specSummaryText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F_REG },

  // Presets
  presetRow: { gap: 8, paddingBottom: 4 },
  presetPill: { backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  presetPillActive: { backgroundColor: 'rgba(200,185,150,0.2)', borderColor: 'rgba(210,195,160,0.4)' },
  presetText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F_REG },
  presetTextActive: { color: '#e8dcc8' },

  // Spec inputs
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  specItem: { width: (W - 50) / 2 - 5 },
  specLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_LIGHT, marginBottom: 4 },
  specInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 15, fontFamily: F_REG, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },

  // Capabilities
  capsCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', gap: 16 },
  capsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  capItem: { alignItems: 'center', flex: 1 },
  capValue: { color: '#fff', fontSize: 16, fontFamily: F_BOLD },
  capLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: F_LIGHT, marginTop: 2 },

  viewTargetsBtn: { backgroundColor: 'rgba(200,185,150,0.15)', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28, borderWidth: 0.5, borderColor: 'rgba(200,185,150,0.3)' },
  viewTargetsBtnText: { color: '#e8dcc8', fontSize: 14, fontFamily: F_BOLD },

  // Targets
  targetHeader: { marginBottom: 16, marginTop: 8 },
  targetHeaderTitle: { color: '#fff', fontSize: 20, fontFamily: F_TITLE },
  targetHeaderSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: F_LIGHT, marginTop: 2 },

  targetCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)' },
  targetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  targetName: { color: '#fff', fontSize: 14, fontFamily: F_REG },
  targetType: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: F_LIGHT, marginTop: 1 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 0.5 },
  diffText: { fontSize: 10, fontFamily: F_REG },
  targetTip: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 10, lineHeight: 16 },
  targetWarn: { color: 'rgba(239,68,68,0.7)', fontSize: 11, fontFamily: F_LIGHT, marginTop: 6 },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontFamily: F_LIGHT, textAlign: 'center' },

  // Detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0c0c14', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: '#fff', fontSize: 22, fontFamily: F_TITLE, letterSpacing: -0.3 },
  modalClose: { color: 'rgba(255,255,255,0.5)', fontSize: 22, padding: 4 },
  modalBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  modalBadgeText: { color: '#d4c5a0', fontSize: 11, fontFamily: F_BOLD, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalTip: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: F_LIGHT, lineHeight: 19, marginBottom: 16 },
  modalDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 16 },
  modalSectionLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: F_BOLD, letterSpacing: 1.5, marginBottom: 12 },
  modalDataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  modalDataCell: { width: '50%', marginBottom: 14 },
  modalDataLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: F_LIGHT },
  modalDataValue: { color: '#fff', fontSize: 15, fontFamily: F_BOLD, marginTop: 3 },
});
