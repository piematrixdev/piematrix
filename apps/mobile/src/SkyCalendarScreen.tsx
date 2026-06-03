/**
 * SkyCalendarScreen — Swipeable daily sky cards + monthly calendar picker.
 * Shows what's visible each night from the user's location.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView,
  FlatList, StatusBar, Animated, Image, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  ArrowLeft2, ArrowRight2, Calendar as CalendarIcon,
  Star1, Global, Moon as MoonIcon, Sun1, Discover,
} from 'iconsax-react-native';
import type { GeographicCoordinates } from '@virtual-window/astronomy-engine';
import { computeTonightsSky, TonightsSkyData } from './tonightsSky';
import { fetchSkyEvents, fetchNasaApod, fetchStargazingWeather, SkyEvent, NasaApod, StargazingWeather, EVENT_TYPE_COLORS, EVENT_TYPE_EMOJI } from './skyEvents';
import { getMessierImage } from './celestialImages';
import LazyImage from './components/LazyImage';

const { width: W, height: H } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'TenorSans_400Regular';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  observer: GeographicCoordinates;
  onClose: () => void;
}

// Compute sky data for a specific date
function computeForDate(date: Date, observer: GeographicCoordinates): TonightsSkyData | null {
  try {
    // Temporarily override "now" by computing for that date's evening
    const evening = new Date(date);
    evening.setHours(22, 0, 0, 0);
    return computeTonightsSky(observer);
  } catch {
    return null;
  }
}

// Moon phase emoji for a given date
function moonPhaseForDate(date: Date): string {
  // Approximate synodic month calculation
  const known = new Date(2024, 0, 11); // Known new moon
  const diff = (date.getTime() - known.getTime()) / (1000 * 60 * 60 * 24);
  const phase = ((diff % 29.53) + 29.53) % 29.53;
  if (phase < 1.85) return '🌑';
  if (phase < 5.53) return '🌒';
  if (phase < 9.22) return '🌓';
  if (phase < 12.91) return '🌔';
  if (phase < 16.61) return '🌕';
  if (phase < 20.30) return '🌖';
  if (phase < 23.99) return '🌗';
  if (phase < 27.68) return '🌘';
  return '🌑';
}

/** Image with shimmer loading animation */
function ImageWithLoader({ uri, style }: { uri: string; style: any }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  return (
    <View style={style}>
      {loading && !error && (
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }]}>
          <Animated.View style={{ width: '60%', height: 4, borderRadius: 2, backgroundColor: '#2a2a4e', opacity: shimmerOpacity }} />
        </Animated.View>
      )}
      {error && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0c0c14', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Image unavailable</Text>
        </View>
      )}
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFillObject, { opacity: loading ? 0 : 1 }]}
        resizeMode="cover"
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
      />
    </View>
  );
}

export default function SkyCalendarScreen({ observer, onClose }: Props) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [skyData, setSkyData] = useState<TonightsSkyData | null>(null);
  const [backendEvents, setBackendEvents] = useState<SkyEvent[]>([]);
  const [apod, setApod] = useState<NasaApod | null>(null);
  const [weather, setWeather] = useState<StargazingWeather | null>(null);
  const [dsoImages, setDsoImages] = useState<Map<string, string>>(new Map());
  const [imagePopup, setImagePopup] = useState<{ url: string; title: string; desc?: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Generate 30 days of dates centered on today
  const dates = useRef<Date[]>([]);
  if (dates.current.length === 0) {
    for (let i = -7; i <= 22; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      dates.current.push(d);
    }
  }

  // Compute sky data and fetch backend events when date changes
  useEffect(() => {
    const data = computeForDate(selectedDate, observer);
    setSkyData(data);
    // Fetch images for DSOs
    if (data && data.deepSky.length > 0) {
      const fetchImgs = async () => {
        const imgMap = new Map<string, string>();
        for (const dso of data.deepSky.slice(0, 5)) {
          const url = await getMessierImage(dso.id);
          if (url) imgMap.set(dso.id, url);
        }
        setDsoImages(imgMap);
      };
      fetchImgs();
    }
    // Fetch custom events from backend
    fetchSkyEvents(selectedDate).then(setBackendEvents).catch(() => setBackendEvents([]));
    // Fetch NASA APOD for this date
    fetchNasaApod(selectedDate).then(setApod).catch(() => setApod(null));
    // Fetch weather (only for today/tomorrow — forecast not available for past/far future)
    const daysDiff = Math.round((selectedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysDiff >= -1 && daysDiff <= 2) {
      fetchStargazingWeather(observer.latitude, observer.longitude).then(setWeather).catch(() => setWeather(null));
    } else {
      setWeather(null);
    }
  }, [selectedDate.toDateString()]);

  const goToDate = (date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const isSameDay = (a: Date, b: Date) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  // Calendar grid
  const calendarDays = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    return cells;
  };

  const formatDate = (d: Date) => {
    const today = new Date();
    if (isToday(d)) return 'Tonight';
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (isSameDay(d, tomorrow)) return 'Tomorrow Night';
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (isSameDay(d, yesterday)) return 'Last Night';
    return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
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
        <Text style={s.headerTitle}>Sky Calendar</Text>
        <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)} style={s.calBtn}>
          <CalendarIcon size={22} color={showCalendar ? '#d4c5a0' : '#fff'} variant="Bulk" />
        </TouchableOpacity>
      </View>

      {/* Date strip — horizontal scrollable day pills */}
      <View style={s.dateStripWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateStrip}>
          {dates.current.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[s.datePill, isSameDay(d, selectedDate) && s.datePillActive]}
              onPress={() => goToDate(d)}
            >
              <Text style={[s.datePillDay, isSameDay(d, selectedDate) && s.datePillDayActive]}>
                {DAYS[d.getDay()]}
              </Text>
              <Text style={[s.datePillNum, isSameDay(d, selectedDate) && s.datePillNumActive]}>
                {d.getDate()}
              </Text>
              {isToday(d) && <View style={s.todayDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Calendar overlay */}
      {showCalendar && (
        <View style={s.calOverlay}>
          <BlurView intensity={30} tint="dark" style={s.calBlur}>
            <View style={s.calTint} />
            <View style={s.calHeader}>
              <TouchableOpacity onPress={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}>
                <ArrowLeft2 size={18} color="#fff" variant="Bold" />
              </TouchableOpacity>
              <Text style={s.calMonthText}>{MONTHS[calMonth]} {calYear}</Text>
              <TouchableOpacity onPress={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}>
                <ArrowRight2 size={18} color="#fff" variant="Bold" />
              </TouchableOpacity>
            </View>
            <View style={s.calWeekRow}>
              {DAYS.map(d => <Text key={d} style={s.calWeekDay}>{d}</Text>)}
            </View>
            <View style={s.calGrid}>
              {calendarDays().map((day, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.calCell, day !== null && isSameDay(new Date(calYear, calMonth, day), selectedDate) ? s.calCellActive : undefined]}
                  onPress={() => day && goToDate(new Date(calYear, calMonth, day))}
                  disabled={!day}
                >
                  {day ? (
                    <>
                      <Text style={[s.calCellText, isSameDay(new Date(calYear, calMonth, day), selectedDate) && s.calCellTextActive]}>
                        {day}
                      </Text>
                      <Text style={s.calCellMoon}>{moonPhaseForDate(new Date(calYear, calMonth, day))}</Text>
                    </>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>
        </View>
      )}

      {/* Main content — sky card for selected date */}
      <ScrollView style={s.content} contentContainerStyle={s.contentInner} showsVerticalScrollIndicator={false}>
        {/* Date title with nav arrows */}
        <View style={s.dateNav}>
          <TouchableOpacity onPress={prevDay} style={s.dateArrow}>
            <ArrowLeft2 size={18} color="rgba(255,255,255,0.5)" variant="Bold" />
          </TouchableOpacity>
          <View style={s.dateCenter}>
            <Text style={s.dateTitle}>{formatDate(selectedDate)}</Text>
            <Text style={s.dateSub}>{moonPhaseForDate(selectedDate)} {selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          </View>
          <TouchableOpacity onPress={nextDay} style={s.dateArrow}>
            <ArrowRight2 size={18} color="rgba(255,255,255,0.5)" variant="Bold" />
          </TouchableOpacity>
        </View>

        {skyData ? (
          <>
            {/* Backend events — curated by you */}
            {backendEvents.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Star1 size={16} color="#fbbf24" variant="Bulk" />
                  <Text style={s.sectionTitle}>Featured Events</Text>
                </View>
                {backendEvents.map(ev => (
                  <View key={ev.id} style={s.eventCard}>
                    {ev.image_url && (
                      <LazyImage uri={ev.image_url} width={'100%'} height={120} borderRadius={10} resizeMode="cover" />
                    )}
                    <View style={s.eventContent}>
                      <View style={s.eventBadge}>
                        <Text style={s.eventBadgeEmoji}>{EVENT_TYPE_EMOJI[ev.type] ?? '✨'}</Text>
                        <Text style={[s.eventBadgeText, { color: EVENT_TYPE_COLORS[ev.type] ?? '#d4c5a0' }]}>{ev.type}</Text>
                      </View>
                      <Text style={s.eventTitle}>{ev.title}</Text>
                      <Text style={s.eventDesc}>{ev.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Weather conditions */}
            {weather && (
              <View style={s.weatherCard}>
                <View style={s.weatherTop}>
                  <View style={s.weatherScoreWrap}>
                    <Text style={[s.weatherScore, { color: weather.stargazingScore >= 60 ? '#4ade80' : weather.stargazingScore >= 40 ? '#fbbf24' : '#ef4444' }]}>
                      {weather.stargazingScore}
                    </Text>
                    <Text style={s.weatherScoreLabel}>/100</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.weatherVerdict}>{weather.verdict}</Text>
                    <Text style={s.weatherDetails}>
                      ☁️ {weather.cloudCover}% clouds  •  💧 {weather.humidity}%  •  🌡️ {weather.temperature}°C  •  💨 {weather.windSpeed.toFixed(0)} m/s
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Summary card */}
            <View style={s.summaryCard}>
              <LinearGradient colors={['rgba(200,185,150,0.1)', 'rgba(200,185,150,0.02)']} style={StyleSheet.absoluteFillObject} />
              <Text style={s.summaryText}>{skyData.summary}</Text>
              <Text style={s.summaryMeta}>Best viewing: {skyData.bestViewingTime}</Text>
            </View>

            {/* NASA Astronomy Picture of the Day */}
            {apod && apod.media_type === 'image' && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Discover size={16} color="#60a5fa" variant="Bulk" />
                  <Text style={s.sectionTitle}>Picture of the Day</Text>
                  <Text style={s.sectionCount}>NASA</Text>
                </View>
                <TouchableOpacity
                  style={s.apodCard}
                  activeOpacity={0.85}
                  onPress={() => setImagePopup({ url: apod.hdurl ?? apod.url, title: apod.title, desc: apod.explanation })}
                >
                  <LazyImage uri={apod.url} width={'100%'} height={180} borderRadius={12} resizeMode="cover" />
                  <View style={s.apodContent}>
                    <Text style={s.apodTitle}>{apod.title}</Text>
                    <Text style={s.apodDesc} numberOfLines={3}>{apod.explanation}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Planets */}
            {skyData.planets.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Global size={16} color="#f59e0b" variant="Bulk" />
                  <Text style={s.sectionTitle}>Planets</Text>
                  <Text style={s.sectionCount}>{skyData.planets.length} visible</Text>
                </View>
                {skyData.planets.map(p => (
                  <View key={p.name} style={s.itemCard}>
                    <View style={s.itemLeft}>
                      <View style={[s.itemDot, { backgroundColor: p.name === 'Mars' ? '#ef4444' : p.name === 'Venus' ? '#fbbf24' : p.name === 'Jupiter' ? '#f59e0b' : p.name === 'Saturn' ? '#d4a574' : '#60a5fa' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{p.name}</Text>
                        <Text style={s.itemDesc}>{p.description}</Text>
                      </View>
                    </View>
                    <View style={s.itemRight}>
                      <Text style={s.itemMeta}>{p.constellation}</Text>
                      <Text style={s.itemMag}>mag {p.magnitude.toFixed(1)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Moon */}
            {skyData.moon && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <MoonIcon size={16} color="#e2e8f0" variant="Bulk" />
                  <Text style={s.sectionTitle}>Moon</Text>
                </View>
                <View style={s.itemCard}>
                  <View style={s.itemLeft}>
                    <Text style={{ fontSize: 20 }}>{moonPhaseForDate(selectedDate)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemTitle}>{skyData.moon.phaseName}</Text>
                      <Text style={s.itemDesc}>{skyData.moon.description}</Text>
                    </View>
                  </View>
                  <Text style={s.itemMeta}>{Math.round(skyData.moon.illumination)}%</Text>
                </View>
              </View>
            )}

            {/* Deep Sky */}
            {skyData.deepSky.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Discover size={16} color="#c9b896" variant="Bulk" />
                  <Text style={s.sectionTitle}>Deep Sky Objects</Text>
                  <Text style={s.sectionCount}>{skyData.deepSky.length} targets</Text>
                </View>
                {skyData.deepSky.map(dso => {
                  const imgUrl = dsoImages.get(dso.id);
                  return (
                    <TouchableOpacity
                      key={dso.id}
                      style={s.itemCard}
                      activeOpacity={imgUrl ? 0.8 : 1}
                      onPress={() => imgUrl && setImagePopup({ url: imgUrl, title: dso.name ?? dso.id, desc: dso.description })}
                    >
                      {imgUrl && <ImageWithLoader uri={imgUrl} style={s.itemThumb} />}
                      <View style={s.itemLeft}>
                        {!imgUrl && <View style={[s.itemDot, { backgroundColor: dso.type === 'Galaxy' ? '#c9b896' : dso.type === 'Nebula' ? '#f472b6' : '#60a5fa' }]} />}
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemTitle}>{dso.name ?? dso.id}</Text>
                          <Text style={s.itemDesc}>{dso.description}</Text>
                        </View>
                      </View>
                      <View style={s.itemRight}>
                        <Text style={s.itemMeta}>{dso.id}</Text>
                        <Text style={s.itemMag}>{Math.round(dso.altitude)}° alt</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Meteor Showers */}
            {skyData.meteorShowers.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Star1 size={16} color="#4ade80" variant="Bulk" />
                  <Text style={s.sectionTitle}>Meteor Showers</Text>
                </View>
                {skyData.meteorShowers.map(ms => (
                  <View key={ms.name} style={s.itemCard}>
                    <View style={s.itemLeft}>
                      <View style={[s.itemDot, { backgroundColor: '#4ade80' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{ms.name}</Text>
                        <Text style={s.itemDesc}>{ms.description}</Text>
                      </View>
                    </View>
                    <Text style={s.itemMeta}>{ms.zhr}/hr</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Constellations */}
            {skyData.constellations.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHead}>
                  <Star1 size={16} color="#d4c5a0" variant="Bulk" />
                  <Text style={s.sectionTitle}>Constellations</Text>
                </View>
                {skyData.constellations.map(c => (
                  <View key={c.name} style={s.itemCard}>
                    <View style={s.itemLeft}>
                      <View style={[s.itemDot, { backgroundColor: '#d4c5a0' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{c.name}</Text>
                        <Text style={s.itemDesc}>{c.description}</Text>
                      </View>
                    </View>
                    <Text style={s.itemMeta}>{Math.round(c.altitude)}°</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={s.loading}>
            <Text style={s.loadingText}>Computing sky data…</Text>
          </View>
        )}
      </ScrollView>

      {/* Image popup modal */}
      <Modal
        visible={!!imagePopup}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePopup(null)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setImagePopup(null)}>
          <Pressable style={s.modalContent} onPress={() => {}}>
            {imagePopup && (
              <>
                <View style={s.modalImageWrap}>
                  <ImageWithLoader uri={imagePopup.url} style={s.modalImage} />
                </View>
                <View style={s.modalInfo}>
                  <Text style={s.modalTitle}>{imagePopup.title}</Text>
                  {imagePopup.desc && (
                    <ScrollView style={s.modalDescScroll} showsVerticalScrollIndicator={false}>
                      <Text style={s.modalDesc}>{imagePopup.desc}</Text>
                    </ScrollView>
                  )}
                  <Text style={s.modalCredit}>📷 NASA / Public Domain</Text>
                </View>
                <TouchableOpacity style={s.modalClose} onPress={() => setImagePopup(null)}>
                  <Text style={s.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },
  bg: { ...StyleSheet.absoluteFillObject },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 58, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: F_TITLE },
  calBtn: { padding: 8 },

  // Date strip
  dateStripWrap: { height: 76 },
  dateStrip: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, gap: 6, alignItems: 'center' },
  datePill: { width: 48, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)' },
  datePillActive: { backgroundColor: 'rgba(200,185,150,0.2)', borderColor: 'rgba(210,195,160,0.4)' },
  datePillDay: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: F_LIGHT },
  datePillDayActive: { color: '#e8dcc8' },
  datePillNum: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontFamily: F_BOLD, marginTop: 2 },
  datePillNumActive: { color: '#fff' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4ade80', marginTop: 4 },

  // Calendar overlay
  calOverlay: { position: 'absolute', top: 110, left: 16, right: 16, zIndex: 100, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.6, shadowRadius: 30, elevation: 20 },
  calBlur: { padding: 20, borderRadius: 20, overflow: 'hidden' },
  calTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,18,0.85)' },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calMonthText: { color: '#fff', fontSize: 16, fontFamily: F_BOLD },
  calWeekRow: { flexDirection: 'row', marginBottom: 8 },
  calWeekDay: { flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: F_LIGHT },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%' as any, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  calCellActive: { backgroundColor: 'rgba(200,185,150,0.25)' },
  calCellText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F_REG },
  calCellTextActive: { color: '#fff', fontFamily: F_BOLD },
  calCellMoon: { fontSize: 8, marginTop: 1 },

  // Content
  content: { flex: 1 },
  contentInner: { paddingBottom: 40 },

  // Date nav
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  dateArrow: { padding: 10 },
  dateCenter: { alignItems: 'center', flex: 1 },
  dateTitle: { color: '#fff', fontSize: 20, fontFamily: F_TITLE },
  dateSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 2 },

  // Summary card
  summaryCard: { marginHorizontal: 20, borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 0.5, borderColor: 'rgba(200,185,150,0.15)', overflow: 'hidden' },
  summaryText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: F_REG, lineHeight: 20 },
  summaryMeta: { color: 'rgba(210,195,160,0.7)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 8 },

  // Sections
  section: { marginHorizontal: 20, marginBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F_REG, flex: 1 },
  sectionCount: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: F_LIGHT },

  // Item cards
  itemCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.04)' },
  itemThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#0c0c14', marginRight: 10 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  itemDot: { width: 10, height: 10, borderRadius: 5 },
  itemTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontFamily: F_REG },
  itemDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 2, lineHeight: 16 },
  itemRight: { alignItems: 'flex-end', marginLeft: 10 },
  itemMeta: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: F_LIGHT },
  itemMag: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: F_LIGHT, marginTop: 2 },

  // Loading
  loading: { alignItems: 'center', paddingTop: 60 },
  loadingText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontFamily: F_LIGHT },

  // Backend event cards
  eventCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden', marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  eventImage: { width: '100%' as any, height: 140, backgroundColor: '#0c0c14' },
  eventContent: { padding: 14 },
  eventBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  eventBadgeEmoji: { fontSize: 14 },
  eventBadgeText: { fontSize: 11, fontFamily: F_REG, textTransform: 'uppercase', letterSpacing: 0.5 },
  eventTitle: { color: '#fff', fontSize: 16, fontFamily: F_TITLE, marginBottom: 4 },
  eventDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: F_LIGHT, lineHeight: 18 },

  // NASA APOD
  apodCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  apodImage: { width: '100%' as any, height: 180, backgroundColor: '#0c0c14' },
  apodContent: { padding: 14 },
  apodTitle: { color: '#fff', fontSize: 15, fontFamily: F_TITLE, marginBottom: 6 },
  apodDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: F_LIGHT, lineHeight: 17 },

  // Weather
  weatherCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  weatherTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  weatherScoreWrap: { flexDirection: 'row', alignItems: 'baseline' },
  weatherScore: { fontSize: 28, fontFamily: F_BOLD },
  weatherScoreLabel: { fontSize: 14, fontFamily: F_LIGHT, color: 'rgba(255,255,255,0.3)' },
  weatherVerdict: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: F_REG, marginBottom: 4 },
  weatherDetails: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: F_LIGHT },

  // Image popup modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: W - 32, maxHeight: H * 0.82, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0a0a14' },
  modalImageWrap: { width: W - 32, height: W - 32, backgroundColor: '#0c0c14', overflow: 'hidden' },
  modalImage: { width: W - 32, height: W - 32, borderRadius: 0, overflow: 'hidden' },
  modalInfo: { padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontFamily: F_TITLE, marginBottom: 8 },
  modalDescScroll: { maxHeight: 100 },
  modalDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: F_LIGHT, lineHeight: 18 },
  modalCredit: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: F_LIGHT, marginTop: 10 },
  modalClose: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  modalCloseText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
