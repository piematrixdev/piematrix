/**
 * HomeScreen — Immersive celestial home. Modern, minimal, astronomy-first.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  StatusBar, ScrollView, Animated, Easing, Modal, Pressable, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { supabase as authSupabase } from './auth/supabaseClient';
import {
  Star1, ShoppingBag, ArrowRight2, Discover,
  Moon as MoonIcon, Sun1, Eye, Global, MessageText1, Cloud, Calendar,
} from 'iconsax-react-native';
import type { GeographicCoordinates } from '@virtual-window/astronomy-engine';
import * as Location from 'expo-location';
import { computeTonightsSky, TonightsSkyData } from './tonightsSky';
import SkyIcon from './components/SkyIcon';
import { fetchSkyWeather, SkyWeather, stargazingScoreColor } from './skyEvents';
import { getEventsForRange, CalendarEvent, EVENT_COLORS, prefetchCalendarEvents } from './calendarEvents';
import { prefetchImages } from './celestialImages';
import { fetchFeaturedProducts, fetchCollectionProducts, Product } from './shopify';
import LazyImage from './components/LazyImage';
import { useAuth } from './auth/AuthContext';
import { useContent } from './content/ContentContext';

const { width: W, height: H } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';
const F_TITLE_SOFT = 'Poppins-SemiBold';

const SUPABASE_URL = 'https://gmsylfwpftqdlzoboqqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4R6Zi5c2SjkZA3YYan1-wg_842wVGyX';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Hero images are now loaded exclusively from the backend (hero_images table).
// No hardcoded fallback — the hero section shows a gradient placeholder while loading.

const APP_VERSION = Constants.nativeAppVersion ?? '1.0';

interface PromoBanner {
  id: string; image_url: string; title: string; subtitle?: string;
  link_type?: string; link_target?: string; priority: number; active: boolean;
}

const FALLBACK_BANNERS: PromoBanner[] = [
  { id: '1', priority: 1, active: true, image_url: 'https://images-assets.nasa.gov/image/PIA23646/PIA23646~orig.jpg', title: 'Explore the Cosmos', subtitle: 'AR stargazing at your fingertips', link_type: 'screen', link_target: 'skywatch' },
  { id: '2', priority: 2, active: true, image_url: 'https://images-assets.nasa.gov/image/PIA20061/PIA20061~orig.jpg', title: 'Premium Optics', subtitle: 'Telescopes for every level', link_type: 'screen', link_target: 'shop' },
  { id: '3', priority: 3, active: true, image_url: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001738/GSFC_20171208_Archive_e001738~orig.jpg', title: 'Tonight\'s Targets', subtitle: 'Nebulae, galaxies & more', link_type: 'screen', link_target: 'telescope' },
];

interface HomeScreenProps {
  onNavigate: (screen: 'skywatch' | 'shop' | 'support' | 'calendar' | 'telescope' | 'profile' | 'feedback' | 'game' | 'events' | 'aichat') => void;
  onProductSelect?: (handle: string) => void;
  onCategorySelect?: (handle: string, title: string) => void;
  onSearchObject?: (target: { name: string; azimuth: number; altitude: number }) => void;
  observer?: GeographicCoordinates;
}

function getMoonPhaseEmoji(day: number): string {
  const p = day % 30;
  if (p < 2) return '🌑'; if (p < 7) return '🌒'; if (p < 9) return '🌓';
  if (p < 14) return '🌔'; if (p < 16) return '🌕'; if (p < 21) return '🌖';
  if (p < 23) return '🌗'; if (p < 28) return '🌘'; return '🌑';
}

function getSkyGradient(hour: number): [string, string, string] {
  if (hour >= 5 && hour < 7) return ['#1a1040', '#3d2060', '#6b3a7a'];
  if (hour >= 7 && hour < 8) return ['#2d1b69', '#7b4397', '#dc8850'];
  if (hour >= 8 && hour < 17) return ['#1e2a4a', '#2a3558', '#3d4565'];
  if (hour >= 17 && hour < 19) return ['#1a1040', '#4a2060', '#c0392b'];
  if (hour >= 19 && hour < 21) return ['#0a0a1a', '#151530', '#1a1045'];
  return ['#030308', '#080814', '#0a0a1a'];
}

// Module-level cache — persists across navigations without re-fetching
const homeCache = {
  heroImages: null as string[] | null,
  banners: null as PromoBanner[] | null,
  profileAvatar: null as string | null,
  lastFetch: 0,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function HomeScreen({ onNavigate, onProductSelect, onCategorySelect, onSearchObject, observer }: HomeScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
  const [tonightData, setTonightData] = useState<TonightsSkyData | null>(null);
  const [weather, setWeather] = useState<SkyWeather | null>(null);
  const [dsoImages, setDsoImages] = useState<Map<string, string>>(new Map());
  const [banners, setBanners] = useState<PromoBanner[]>(FALLBACK_BANNERS);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const marqueeAnim = useRef(new Animated.Value(0)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [heroIndex] = useState(() => Math.floor(Math.random() * 6));
  const [detailObject, setDetailObject] = useState<any>(null);
  const [calendarEventMap, setCalendarEventMap] = useState<Map<string, CalendarEvent[]>>(new Map());

  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);

  useEffect(() => {
    // Use cached data if fresh enough
    const now = Date.now();
    if (homeCache.lastFetch && now - homeCache.lastFetch < CACHE_TTL) {
      if (homeCache.heroImages) setHeroImages(homeCache.heroImages);
      if (homeCache.banners) setBanners(homeCache.banners);
      if (homeCache.profileAvatar) setProfileAvatar(homeCache.profileAvatar);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase.from('promo_banners').select('*').eq('active', true).order('priority');
        if (data && data.length > 0) {
          setBanners(data as PromoBanner[]);
          homeCache.banners = data as PromoBanner[];
        }
      } catch {}
      // Fetch hero images from backend
      try {
        const { data } = await supabase.from('hero_images').select('image_url').eq('active', true).order('priority');
        if (data && data.length > 0) {
          const urls = data.map((r: any) => r.image_url);
          setHeroImages(urls);
          homeCache.heroImages = urls;
        }
      } catch {}
      // Fetch profile avatar + check completeness
      try {
        const { data: { user: currentUser } } = await authSupabase.auth.getUser();
        if (currentUser) {
          const { data } = await authSupabase.from('user_profiles').select('avatar_url, interests, experience_level').eq('id', currentUser.id).single();
          if (data?.avatar_url) {
            setProfileAvatar(data.avatar_url);
            homeCache.profileAvatar = data.avatar_url;
          }
          if (!data || !data.experience_level || !data.interests || data.interests.length === 0) {
            setProfileIncomplete(true);
          }
        }
      } catch {}
      homeCache.lastFetch = Date.now();
    })();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const iv = setInterval(() => {
      setBannerIndex(p => {
        const next = (p + 1) % banners.length;
        bannerRef.current?.scrollToOffset({ offset: next * (W - 32 + 12), animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(iv);
  }, [banners.length]);

  useEffect(() => {
    fetchFeaturedProducts(6).then(setProducts);
    // Fetch first product image per category for the category cards
    const catHandles = ['telescopes', 'binoculars', 'dobsonian-telescopes', 'refractor-telescopes',
      'reflector-telescopes', 'best-telescope-for-kids', 'telescopes-best-for-planets', 'spotting-scopes'];
    Promise.all(catHandles.map(h => fetchCollectionProducts(h, 1))).then(results => {
      const imgs: Record<string, string> = {};
      results.forEach((prods, i) => { if (prods[0]?.image) imgs[catHandles[i]] = prods[0].image; });
      setCategoryImages(imgs);
    }).catch(() => {});
    if (observer && (observer.latitude !== 0 || observer.longitude !== 0)) {
      try {
        const data = computeTonightsSky(observer);
        setTonightData(data);
        const objs: Array<{ id: string; name?: string }> = [];
        for (const d of data.deepSky.slice(0, 4)) objs.push({ id: d.id, name: d.name ?? undefined });
        for (const p of data.planets.slice(0, 3)) objs.push({ id: p.name.toLowerCase(), name: p.name });
        objs.push({ id: 'moon', name: 'Moon' });
        prefetchImages(objs, 6).then(setDsoImages);
      } catch {}
      fetchSkyWeather(observer.latitude, observer.longitude).then(setWeather).catch(() => {});
      // Reverse geocode to get city name
      Location.reverseGeocodeAsync({ latitude: observer.latitude, longitude: observer.longitude })
        .then(results => {
          if (results[0]) {
            const r = results[0];
            const city = r.city || r.subregion || r.region || '';
            const region = r.region || '';
            setLocationName(city === region ? city : city ? `${city}, ${region}` : region);
          }
        })
        .catch(() => {});
    }
    // Fetch calendar events for the next 7 days from backend + compute moon phases
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    prefetchCalendarEvents(today, 30).then(() => {
      setCalendarEventMap(getEventsForRange(today, 7));
    }).catch(() => {
      // Even if backend fetch fails, moon phases still work
      setCalendarEventMap(getEventsForRange(today, 7));
    });
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    // Marquee: scroll from right edge to left, loop forever
    Animated.loop(
      Animated.timing(marqueeAnim, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    // Orbit: small moon revolves around profile pic
    Animated.loop(
      Animated.timing(orbitAnim, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, [observer?.latitude, observer?.longitude]);

  const now = new Date();
  const hour = now.getHours();
  const dayOfMonth = now.getDate();
  const skyColors = getSkyGradient(hour);
  const isNight = hour >= 19 || hour < 6;
  const moonEmoji = getMoonPhaseEmoji(dayOfMonth);
  const { user } = useAuth();
  const { t } = useContent();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    ?? user?.user_metadata?.name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Stargazer';
  const greeting = hour < 5 ? t('home.greeting.night', 'Clear skies')
    : hour < 12 ? t('home.greeting.morning', 'Good morning')
    : hour < 17 ? t('home.greeting.afternoon', 'Good afternoon')
    : hour < 21 ? t('home.greeting.evening', 'Good evening')
    : t('home.greeting.night', 'Clear skies');
  const ctaGlow = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  // Use profile avatar from DB, or fall back to auth provider avatar
  const displayAvatar = profileAvatar ?? user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;

  // Dynamic hero title — driven entirely by live weather/time, no DB copy.
  const heroTitle = (() => {
    if (weather) {
      if (weather.isClearNow) {
        return weather.isDay ? 'Clear skies above' : 'The sky is clear';
      }
      // Not clear right now — lead with the actual condition.
      return weather.conditionLabel;
    }
    // No weather yet — fall back to a time-of-day greeting for the sky.
    return isNight ? 'Tonight\'s sky' : 'The sky above';
  })();

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#030308', '#030308', '#030308']}
        locations={[0, 0.5, 1]}
        style={s.skyBg} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero — full bleed to top edge */}
        <TouchableOpacity style={s.hero} activeOpacity={0.95} onPress={() => onNavigate('skywatch')}>
          {heroImages.length > 0 ? (
            <Image
              source={{ uri: heroImages[heroIndex % heroImages.length] }}
              style={s.heroImage}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <LinearGradient
              colors={['#0a0a1a', '#151530', '#1a1045']}
              style={s.heroImage}
            />
          )}
          <LinearGradient
            colors={['rgba(3,3,8,0)', 'rgba(3,3,8,0.4)', 'rgba(3,3,8,0.92)']}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Header overlaid on image */}
          <View style={s.header}>
            <View>
              <Text style={s.greeting}>{greeting}</Text>
              <Text style={s.brand}>{firstName}</Text>
            </View>
            <TouchableOpacity style={s.avatarOuter} onPress={() => onNavigate('profile')} activeOpacity={0.8}>
              <View style={s.avatarWrap}>
                {displayAvatar ? (
                  <Image source={{ uri: displayAvatar }} style={s.avatarThumb} cachePolicy="disk" />
                ) : (
                  <View style={s.avatarFallback}>
                    <Text style={s.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>
              {/* Orbiting moon dot — circular path, fades when behind */}
              <Animated.View style={[s.orbitDot, {
                opacity: orbitAnim.interpolate({
                  inputRange: [0, 0.15, 0.4, 0.6, 0.85, 1],
                  outputRange: [0, 0, 1, 1, 0, 0],
                }),
                transform: [
                  { translateX: orbitAnim.interpolate({
                    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
                    outputRange: [0, 21, 30, 21, 0, -21, -30, -21, 0],
                  })},
                  { translateY: orbitAnim.interpolate({
                    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
                    outputRange: [-12, -8, 0, 8, 12, 8, 0, -8, -12],
                  })},
                  { scale: orbitAnim.interpolate({
                    inputRange: [0, 0.25, 0.5, 0.75, 1],
                    outputRange: [0.5, 0.9, 1.2, 0.9, 0.5],
                  })},
                ],
              }]}>
                <View style={s.moonDot} />
              </Animated.View>
            </TouchableOpacity>
          </View>
          {/* Content at bottom */}
          <View style={s.heroContent}>
            <Text style={s.heroTitle}>{heroTitle}</Text>

            {/* Live sky conditions strip */}
            {weather ? (
              <View style={s.weatherStrip}>
                <View style={[s.weatherDot, { backgroundColor: stargazingScoreColor(weather.stargazingScore) }]} />
                <Cloud size={14} color="rgba(255,255,255,0.6)" variant="Bulk" />
                <Text style={s.weatherText}>{weather.cloudCover}% cloud</Text>
                <Text style={s.weatherDivider}>·</Text>
                <Text style={s.weatherTemp}>{weather.temperature}°C</Text>
                <Text style={s.weatherDivider}>·</Text>
                <Text style={s.weatherCondition}>{weather.conditionLabel}</Text>
              </View>
            ) : null}

            {/* Location */}
            {locationName ? (
              <View style={s.locationRow}>
                <Global size={13} color="rgba(255,255,255,0.5)" variant="Bulk" />
                <Text style={s.locationText}>{locationName}</Text>
              </View>
            ) : null}

            <Text style={s.heroSub}>
              {weather
                ? weather.nextClearText
                : tonightData
                  ? `${tonightData.planets.length} planets · ${tonightData.deepSky.length} deep sky objects`
                  : t('home.hero.subtitle', "Tap to explore what's above you")}
            </Text>

            <Animated.View style={[s.heroCta, { opacity: ctaGlow }]}>
              <Eye size={16} color="#030308" variant="Bold" />
              <Text style={s.heroCtaText}>{t('home.hero.cta', 'Open Sky View')}</Text>
            </Animated.View>
          </View>
        </TouchableOpacity>

        {/* Profile completion banner */}
        {profileIncomplete && (
          <TouchableOpacity style={s.profileBanner} activeOpacity={0.85} onPress={() => onNavigate('profile')}>
            <View style={s.profileBannerContent}>
              <Star1 size={18} color="#d4c5a0" variant="Bold" />
              <View style={{ flex: 1 }}>
                <Text style={s.profileBannerTitle}>Complete your profile</Text>
                <Text style={s.profileBannerSub}>Set your interests and experience for a personalized sky</Text>
              </View>
              <ArrowRight2 size={16} color="rgba(255,255,255,0.3)" variant="Linear" />
            </View>
          </TouchableOpacity>
        )}

        {/* Tonight's Sky — highlight cards */}
        {tonightData && (
          <View style={{ marginBottom: 28 }}>
            <View style={[s.sectionHead, { marginBottom: 14 }]}>
              <Text style={s.sectionTitle}>{t('home.section.tonight', 'Visible Tonight')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: F_LIGHT }}>
                {(tonightData.planets.length + tonightData.deepSky.length)} objects
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.highlightScroll}>
              {tonightData.planets.map(p => (
                <TouchableOpacity key={p.name} style={s.highlightCard} activeOpacity={0.8} onPress={() => setDetailObject({ type: 'Planet', ...p })}>
                  <View style={[s.highlightIcon, { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
                    <Global size={20} color="#4ade80" variant="Bulk" />
                  </View>
                  <Text style={s.highlightName}>{p.name}</Text>
                  <Text style={s.highlightInfo}>Planet · mag {p.magnitude.toFixed(1)}</Text>
                </TouchableOpacity>
              ))}
              {tonightData.deepSky.slice(0, 4).map(d => (
                <TouchableOpacity key={d.id} style={s.highlightCard} activeOpacity={0.8} onPress={() => setDetailObject({ ...d, type: 'Deep Sky' })}>
                  <View style={[s.highlightIcon, { backgroundColor: 'rgba(201,184,150,0.12)' }]}>
                    <SkyIcon name="orbit" size={20} color="#c9b896" />
                  </View>
                  <Text style={s.highlightName}>{d.name ?? d.id}</Text>
                  <Text style={s.highlightInfo}>{d.type} · mag {d.magnitude.toFixed(1)}</Text>
                </TouchableOpacity>
              ))}
              {tonightData.constellations.slice(0, 3).map(c => (
                <TouchableOpacity key={c.name} style={s.highlightCard} activeOpacity={0.8} onPress={() => setDetailObject({ type: 'Constellation', ...c })}>
                  <View style={[s.highlightIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
                    <Star1 size={20} color="#60a5fa" variant="Bulk" />
                  </View>
                  <Text style={s.highlightName}>{c.name}</Text>
                  <Text style={s.highlightInfo}>Constellation</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Sky Calendar date strip */}
        <View style={s.calSection}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>SKY CALENDAR</Text>
            <TouchableOpacity onPress={() => onNavigate('calendar')}>
              <Text style={s.sectionLink}>Full calendar →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.calStrip}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i);
              d.setHours(0, 0, 0, 0);
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const isFirst = i === 0;
              // Moon phase calc
              const known = new Date(2024, 0, 11);
              const diff = (d.getTime() - known.getTime()) / (1000 * 60 * 60 * 24);
              const phase = ((diff % 29.53) + 29.53) % 29.53;
              const moonEmoji = phase < 1.85 ? '🌑' : phase < 5.53 ? '🌒' : phase < 9.22 ? '🌓' : phase < 12.91 ? '🌔' : phase < 16.61 ? '🌕' : phase < 20.30 ? '🌖' : phase < 23.99 ? '🌗' : phase < 27.68 ? '🌘' : '🌑';
              // Get events for this date
              const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const dayEvents = calendarEventMap.get(dateKey) ?? [];
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.calPill, isFirst && s.calPillActive]}
                  activeOpacity={0.8}
                  onPress={() => onNavigate('calendar')}
                >
                  <Text style={[s.calPillDay, isFirst && s.calPillDayActive]}>{dayNames[d.getDay()]}</Text>
                  <Text style={[s.calPillNum, isFirst && s.calPillNumActive]}>{d.getDate()}</Text>
                  <Text style={s.calPillMoon}>{moonEmoji}</Text>
                  {/* Event indicator dots */}
                  {dayEvents.length > 0 ? (
                    <View style={s.calEventDots}>
                      {dayEvents.slice(0, 3).map((ev, idx) => (
                        <View key={idx} style={[s.calEventDot, { backgroundColor: ev.color }]} />
                      ))}
                    </View>
                  ) : isFirst ? (
                    <View style={s.calTodayDot} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Event legend — shows what's coming this week */}
          {calendarEventMap.size > 0 && (
            <View style={s.calLegend}>
              {Array.from(calendarEventMap.values()).flat()
                .filter((ev, i, arr) => arr.findIndex(e => e.type === ev.type) === i) // unique by type
                .slice(0, 4)
                .map((ev, i) => (
                  <View key={i} style={s.calLegendItem}>
                    <View style={[s.calLegendDot, { backgroundColor: ev.color }]} />
                    <Text style={s.calLegendText}>{ev.label}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* Promo Banners */}
        <View style={s.bannerWrap}>
          <FlatList
            ref={bannerRef}
            data={banners}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={W - 32 + 12}
            decelerationRate="fast"
            contentContainerStyle={{ gap: 12 }}
            keyExtractor={i => i.id}
            onMomentumScrollEnd={e => setBannerIndex(Math.round(e.nativeEvent.contentOffset.x / (W - 32 + 12)))}
            getItemLayout={(_, i) => ({ length: W - 32 + 12, offset: (W - 32 + 12) * i, index: i })}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.9} style={s.bannerCard}
                onPress={() => item.link_type === 'screen' && item.link_target && onNavigate(item.link_target as any)}>
                <LazyImage uri={item.image_url} width={W - 32} height={170} borderRadius={20} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={s.bannerGrad} />
                <View style={s.bannerContent}>
                  <Text style={s.bannerTitle}>{item.title}</Text>
                  {item.subtitle && <Text style={s.bannerSub}>{item.subtitle}</Text>}
                </View>
              </TouchableOpacity>
            )}
          />
          {banners.length > 1 && (
            <View style={s.dots}>
              {banners.map((_, i) => <View key={i} style={[s.dot, i === bannerIndex && s.dotActive]} />)}
            </View>
          )}
        </View>

        {/* Shop Categories — larger cards with product images */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>SHOP</Text>
            <TouchableOpacity onPress={() => onNavigate('shop')}>
              <Text style={s.sectionLink}>See all →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
            {[
              { handle: 'telescopes', title: 'Telescopes' },
              { handle: 'binoculars', title: 'Binoculars' },
              { handle: 'dobsonian-telescopes', title: 'Dobsonian' },
              { handle: 'refractor-telescopes', title: 'Refractors' },
              { handle: 'reflector-telescopes', title: 'Reflectors' },
              { handle: 'best-telescope-for-kids', title: 'For Kids' },
              { handle: 'telescopes-best-for-planets', title: 'Planets' },
              { handle: 'spotting-scopes', title: 'Spotting Scopes' },
            ].map(cat => (
              <TouchableOpacity
                key={cat.handle}
                style={s.catCard}
                activeOpacity={0.85}
                onPress={() => onCategorySelect?.(cat.handle, cat.title)}
              >
                {categoryImages[cat.handle] ? (
                  <LazyImage uri={categoryImages[cat.handle]} width={W * 0.4} height={W * 0.4} borderRadius={16} />
                ) : (
                  <View style={s.catImgPlaceholder}>
                    <ShoppingBag size={24} color="rgba(255,255,255,0.1)" variant="Bulk" />
                  </View>
                )}
                <View style={s.catOverlay}>
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={s.catGradient}
                  />
                  <Text style={s.catTitle}>{cat.title}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Action cards — organized by priority */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>QUICK ACCESS</Text>
          </View>

          {/* Primary — Astronomy tools */}
          <TouchableOpacity style={s.actionCard} activeOpacity={0.9} onPress={() => onNavigate('telescope')}>
            <View style={[s.actionIcon, { backgroundColor: 'rgba(201,184,150,0.12)' }]}>
              <Star1 size={20} color="#c9b896" variant="Bulk" />
            </View>
            <View style={s.actionInfo}>
              <Text style={s.actionTitle}>{t('home.action.telescope.title', 'Telescope Targets')}</Text>
              <Text style={s.actionDesc}>
                {tonightData && tonightData.deepSky.length > 0
                  ? `${tonightData.deepSky[0].name ?? tonightData.deepSky[0].id} + ${tonightData.deepSky.length - 1} more tonight`
                  : t('home.action.telescope.desc', 'Find objects for your scope')}
              </Text>
            </View>
            <ArrowRight2 size={16} color="rgba(255,255,255,0.3)" variant="Linear" />
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} activeOpacity={0.9} onPress={() => onNavigate('events')}>
            <View style={[s.actionIcon, { backgroundColor: 'rgba(74,222,128,0.12)' }]}>
              <Calendar size={20} color="#4ade80" variant="Bulk" />
            </View>
            <View style={s.actionInfo}>
              <Text style={s.actionTitle}>Events & Activities</Text>
              <Text style={s.actionDesc}>Stargazing nights, workshops & more</Text>
            </View>
            <ArrowRight2 size={16} color="rgba(255,255,255,0.3)" variant="Linear" />
          </TouchableOpacity>

          <TouchableOpacity style={s.actionCard} activeOpacity={0.9} onPress={() => onNavigate('aichat')}>
            <View style={[s.actionIcon, { backgroundColor: 'rgba(212,197,160,0.12)' }]}>
              <Star1 size={20} color="#d4c5a0" variant="Bold" />
            </View>
            <View style={s.actionInfo}>
              <Text style={s.actionTitle}>Ask Orion</Text>
              <Text style={s.actionDesc}>AI assistant — telescopes, sky tips & more</Text>
            </View>
            <ArrowRight2 size={16} color="rgba(255,255,255,0.3)" variant="Linear" />
          </TouchableOpacity>

          {/* Secondary — Commerce */}
          <TouchableOpacity style={s.actionCard} activeOpacity={0.9} onPress={() => onNavigate('shop')}>
            <View style={[s.actionIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <ShoppingBag size={20} color="#f59e0b" variant="Bulk" />
            </View>
            <View style={s.actionInfo}>
              <Text style={s.actionTitle}>{t('home.action.shop.title', 'Shop Equipment')}</Text>
              <Text style={s.actionDesc}>{t('home.action.shop.desc', 'Telescopes, binoculars & accessories')}</Text>
            </View>
            <ArrowRight2 size={16} color="rgba(255,255,255,0.3)" variant="Linear" />
          </TouchableOpacity>

          {/* Tertiary — Support */}
          <TouchableOpacity style={s.actionCard} activeOpacity={0.9} onPress={() => onNavigate('feedback')}>
            <View style={[s.actionIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
              <MessageText1 size={20} color="#60a5fa" variant="Bulk" />
            </View>
            <View style={s.actionInfo}>
              <Text style={s.actionTitle}>{t('home.action.feedback.title', 'Support & Feedback')}</Text>
              <Text style={s.actionDesc}>{t('home.action.feedback.desc', 'Get help or share your thoughts')}</Text>
            </View>
            <ArrowRight2 size={16} color="rgba(255,255,255,0.3)" variant="Linear" />
          </TouchableOpacity>
        </View>

        {/* Footer — seamless marquee */}
        <View style={s.footer}>
          <View style={s.marqueeWrap}>
            <Animated.View style={[s.marqueeTrack, {
              transform: [{
                translateX: marqueeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -(W * 2.2)],
                }),
              }],
            }]}>
              <Text style={s.marqueeText}>{t('home.footer.marquee', 'Sky is not the limit · Think Beyond · ')}</Text>
              <Text style={s.marqueeText}>{t('home.footer.marquee', 'Sky is not the limit · Think Beyond · ')}</Text>
              <Text style={s.marqueeText}>{t('home.footer.marquee', 'Sky is not the limit · Think Beyond · ')}</Text>
            </Animated.View>
          </View>
          <View style={{ marginTop: 24, alignItems: 'center', width: '100%' }}>
            <Text style={s.footerBrand} onLongPress={() => onNavigate('game')} suppressHighlighting>{t('home.footer.brand', 'Pie Matrix')}</Text>
            <Text style={s.footerVer}>v{APP_VERSION}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Detail popup modal */}
      <Modal visible={!!detailObject} transparent animationType="fade" onRequestClose={() => setDetailObject(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setDetailObject(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            {detailObject && (
              <>
                <Text style={s.modalTitle}>{detailObject.name ?? detailObject.id}</Text>
                <Text style={s.modalType}>{detailObject.type}</Text>
                {detailObject.description && (
                  <Text style={s.modalDesc}>{detailObject.description}</Text>
                )}
                <View style={s.modalDivider} />
                <View style={s.modalRows}>
                  {detailObject.magnitude !== undefined && (
                    <View style={s.modalRow}>
                      <Text style={s.modalLabel}>Magnitude</Text>
                      <Text style={s.modalValue}>{detailObject.magnitude.toFixed(2)}</Text>
                    </View>
                  )}
                  {detailObject.altitude !== undefined && (
                    <View style={s.modalRow}>
                      <Text style={s.modalLabel}>Altitude</Text>
                      <Text style={s.modalValue}>{detailObject.altitude.toFixed(1)}°</Text>
                    </View>
                  )}
                  {detailObject.azimuth !== undefined && (
                    <View style={s.modalRow}>
                      <Text style={s.modalLabel}>Azimuth</Text>
                      <Text style={s.modalValue}>{detailObject.azimuth.toFixed(1)}°</Text>
                    </View>
                  )}
                  {detailObject.ra !== undefined && (
                    <View style={s.modalRow}>
                      <Text style={s.modalLabel}>RA</Text>
                      <Text style={s.modalValue}>{detailObject.ra.toFixed(3)}h</Text>
                    </View>
                  )}
                  {detailObject.dec !== undefined && (
                    <View style={s.modalRow}>
                      <Text style={s.modalLabel}>Dec</Text>
                      <Text style={s.modalValue}>{detailObject.dec > 0 ? '+' : ''}{detailObject.dec.toFixed(2)}°</Text>
                    </View>
                  )}
                  {detailObject.constellation && (
                    <View style={s.modalRow}>
                      <Text style={s.modalLabel}>Constellation</Text>
                      <Text style={s.modalValue}>{detailObject.constellation}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity style={s.modalBtn} onPress={() => {
                  const obj = detailObject;
                  setDetailObject(null);
                  if (onSearchObject && obj && obj.azimuth !== undefined && obj.altitude !== undefined) {
                    onSearchObject({ name: obj.name ?? obj.id, azimuth: obj.azimuth, altitude: obj.altitude });
                  } else {
                    onNavigate('skywatch');
                  }
                }}>
                  <Text style={s.modalBtnText}>Find in Sky View</Text>
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
  skyBg: { position: 'absolute', top: 0, left: 0, right: 0, height: H },
  scroll: { paddingBottom: 140 },

  // Header (overlaid on hero image)
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 58, paddingHorizontal: 22,
  },
  greeting: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_MEDIUM, letterSpacing: 1 },
  brand: { color: '#fff', fontSize: 28, fontFamily: 'Poppins-Black', marginTop: 2, letterSpacing: -0.8 },
  avatarOuter: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  avatarWrap: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  avatarThumb: { width: '100%' as any, height: '100%' as any },
  avatarFallback: { width: '100%' as any, height: '100%' as any, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(212,197,160,0.2)' },
  avatarInitial: { color: '#d4c5a0', fontSize: 16, fontFamily: F_BOLD, textAlign: 'center', includeFontPadding: false } as any,
  orbitDot: { position: 'absolute' },
  moonDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#d4c5a0', shadowColor: '#d4c5a0', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 3 },

  // Hero — edge to edge, top of screen
  hero: {
    width: W, height: H * 0.48, marginBottom: 20,
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroContent: {
    flex: 1, justifyContent: 'flex-end', padding: 22, paddingBottom: 28,
  },
  heroTitle: { color: '#fff', fontSize: 28, fontFamily: F_TITLE, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: F_LIGHT, marginTop: 6 },

  // Live weather strip in hero
  weatherStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  weatherDot: { width: 7, height: 7, borderRadius: 3.5 },
  weatherText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: F_REG },
  weatherTemp: { color: '#fff', fontSize: 12, fontFamily: F_BOLD },
  weatherCondition: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: F_REG },
  weatherDivider: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

  // Location row
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  locationText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_REG },

  heroCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#e8dcc8', paddingVertical: 13, borderRadius: 14, marginTop: 16,
    alignSelf: 'flex-start', paddingHorizontal: 20,
  },
  heroCtaText: { color: '#030308', fontSize: 13, fontFamily: F_SEMIBOLD },

  // Profile completion banner
  profileBanner: {
    marginHorizontal: 20, marginBottom: 20, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: 'rgba(212,197,160,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(212,197,160,0.2)',
  },
  profileBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileBannerTitle: { color: '#d4c5a0', fontSize: 13, fontFamily: F_SEMIBOLD },
  profileBannerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_LIGHT, marginTop: 2 },

  // Sections
  section: { marginBottom: 28 },
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 24, marginBottom: 14,
  },
  sectionTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: F_MEDIUM, letterSpacing: 1.5, textTransform: 'uppercase' },
  sectionLink: { color: '#d4c5a0', fontSize: 12, fontFamily: F_MEDIUM },

  // Highlight cards (tonight's objects)
  highlightScroll: { paddingHorizontal: 24, gap: 12 },
  highlightCard: {
    width: 120, paddingVertical: 16, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  highlightIcon: {
    width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  highlightName: { color: '#fff', fontSize: 13, fontFamily: F_MEDIUM, marginBottom: 3 },
  highlightInfo: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_LIGHT },

  // Detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  modalCard: { backgroundColor: '#141418', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: '#fff', fontSize: 22, fontFamily: F_TITLE, marginBottom: 4 },
  modalType: { color: '#d4c5a0', fontSize: 12, fontFamily: F_SEMIBOLD, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  modalDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F_LIGHT, lineHeight: 19, marginBottom: 14 },
  modalDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 },
  modalRows: { gap: 0 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  modalLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: F_LIGHT },
  modalValue: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: F_REG, fontWeight: '600' },
  modalBtn: { backgroundColor: '#d4c5a0', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  modalBtnText: { color: '#030308', fontSize: 14, fontFamily: F_BOLD },

  // Banners
  bannerWrap: { marginBottom: 28, paddingHorizontal: 16 },
  bannerCard: { width: W - 32, height: 170, borderRadius: 20, overflow: 'hidden' },
  bannerGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  bannerContent: { position: 'absolute', bottom: 18, left: 18, right: 18 },
  bannerTitle: { color: '#fff', fontSize: 19, fontFamily: F_BOLD, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  bannerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  dotActive: { backgroundColor: '#d4c5a0', width: 18, borderRadius: 4 },

  // Products (removed — replaced by categories)
  prodScroll: { paddingHorizontal: 24, gap: 12 },
  prodCard: { width: W * 0.38 },
  prodImgEmpty: { backgroundColor: '#0a0a12', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  prodName: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: F_REG, marginTop: 10 },
  prodPrice: { color: '#d4c5a0', fontSize: 14, fontFamily: F_BOLD, marginTop: 3 },

  // Categories — large image cards
  catScroll: { paddingHorizontal: 24, gap: 14 },
  catCard: {
    width: W * 0.4, borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#0a0a12',
  },
  catImgPlaceholder: {
    width: W * 0.4, height: W * 0.4, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center', alignItems: 'center',
  },
  catOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 50, justifyContent: 'flex-end',
    paddingBottom: 10, paddingHorizontal: 10,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  catGradient: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
  },
  catTitle: { color: '#fff', fontSize: 12, fontFamily: F_MEDIUM, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  catLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: F_REG, paddingHorizontal: 8, paddingVertical: 8, textAlign: 'center' },

  // Action cards
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 24, marginBottom: 10, paddingVertical: 16, paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },

  // Sky Calendar strip
  calSection: { marginBottom: 28 },
  calStrip: { paddingHorizontal: 24, gap: 8 },
  calPill: {
    width: 52, height: 80, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  calPillActive: { backgroundColor: 'rgba(200,185,150,0.18)', borderColor: 'rgba(210,195,160,0.4)' },
  calPillDay: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: F_LIGHT },
  calPillDayActive: { color: '#e8dcc8' },
  calPillNum: { color: 'rgba(255,255,255,0.7)', fontSize: 17, fontFamily: F_BOLD, marginTop: 2 },
  calPillNumActive: { color: '#fff' },
  calPillMoon: { fontSize: 10, marginTop: 3 },
  calEventDots: { flexDirection: 'row', gap: 3, marginTop: 4 },
  calEventDot: { width: 5, height: 5, borderRadius: 2.5 },
  calTodayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4ade80', marginTop: 3 },
  calLegend: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, marginTop: 12, gap: 10 },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calLegendDot: { width: 6, height: 6, borderRadius: 3 },
  calLegendText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_LIGHT },
  actionInfo: { flex: 1 },
  actionTitle: { color: '#fff', fontSize: 14, fontFamily: F_MEDIUM },
  actionDesc: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 2 },

  // Footer
  footer: { marginTop: 32, overflow: 'hidden' } as any,
  marqueeWrap: { width: W, overflow: 'hidden', height: 56 } as any,
  marqueeTrack: { flexDirection: 'row', position: 'absolute', height: 56, alignItems: 'center' } as any,
  marqueeText: { color: 'rgba(255,255,255,0.55)', fontSize: 44, fontFamily: 'Poppins-Black', width: W * 2.2 } as any,
  footerBrand: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: F_SEMIBOLD, letterSpacing: 0.5 } as any,
  footerVer: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: F_LIGHT, marginTop: 4, letterSpacing: 1.5 } as any,
});
