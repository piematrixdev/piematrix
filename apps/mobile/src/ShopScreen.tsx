/**
 * ShopScreen — Pie Matrix shop with a homescreen-style layout.
 *
 * Visual hierarchy:
 *   1. Hero header (title + tagline)
 *   2. Promo banner card (first collection's first product as a feature)
 *   3. Category tile grid (4-column quick navigation)
 *   4. Featured products row (large cards)
 *   5. Per-collection horizontal carousels
 *   6. "Visit full store" CTA
 *
 * Data layer is unchanged — same fetchCollections call as before.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Linking, Dimensions, FlatList, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShoppingBag, ArrowRight2, Star1, Eye, Discover,
  SearchNormal1, Magicpen, User,
} from 'iconsax-react-native';
import { fetchCollections, Collection, Product, SHOP_URL } from './shopify';
import LazyImage from './components/LazyImage';
import { useAuth } from './auth/AuthContext';

const { width: W } = Dimensions.get('window');

// iPad / large display layout flag — used throughout to widen tiles, give
// product cards more breathing room, and keep content centered in a max
// width so the homescreen layout doesn't sprawl.
const IS_TABLET = W >= 700;
const MAX_CONTENT_W = 820;

const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';

const COLLECTION_HANDLES = [
  'telescopes',
  'binoculars',
  'dobsonian-telescopes',
  'refractor-telescopes',
  'reflector-telescopes',
  'best-telescope-for-kids',
  'telescopes-best-for-planets',
  'spotting-scopes',
];

// Display copy + icon per collection — keeps the category tiles visually
// distinct without depending on a CMS.
const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  'telescopes':                  { label: 'Telescopes',  icon: Star1,         color: '#d4c5a0' },
  'binoculars':                  { label: 'Binoculars',  icon: Eye,           color: '#60a5fa' },
  'dobsonian-telescopes':        { label: 'Dobsonian',   icon: Discover,      color: '#a78bfa' },
  'refractor-telescopes':        { label: 'Refractor',   icon: Star1,         color: '#22d3ee' },
  'reflector-telescopes':        { label: 'Reflector',   icon: Star1,         color: '#f472b6' },
  'best-telescope-for-kids':     { label: 'For Kids',    icon: Magicpen,      color: '#f59e0b' },
  'telescopes-best-for-planets': { label: 'Planets',     icon: Star1,         color: '#fbbf24' },
  'spotting-scopes':             { label: 'Spotting',    icon: SearchNormal1, color: '#4ade80' },
};

interface ShopScreenProps {
  onClose: () => void;
  onProductSelect?: (handle: string) => void;
  onCategorySelect?: (handle: string, title: string) => void;
  /**
   * Tapping the profile avatar in the header. Parent decides what this does:
   * GuestApp opens the sign-in modal; AppContent navigates to the Profile
   * screen.
   */
  onProfilePress?: () => void;
}

export default function ShopScreen({ onClose, onProductSelect, onCategorySelect, onProfilePress }: ShopScreenProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const avatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const initial = (user?.user_metadata?.full_name ?? user?.email ?? '').toString().trim().charAt(0).toUpperCase();

  useEffect(() => {
    fetchCollections(COLLECTION_HANDLES).then(c => { setCollections(c); setLoading(false); });
  }, []);

  const openProduct = (handle: string) => {
    if (onProductSelect) {
      onProductSelect(handle);
    } else {
      Linking.openURL(`${SHOP_URL}/products/${handle}`);
    }
  };

  // Hero promo: pull a striking product from the first collection. Falls
  // back gracefully if the API is slow.
  const heroProduct = useMemo(() => {
    return collections[0]?.products?.[0] ?? null;
  }, [collections]);

  // Featured row = "Telescopes" collection (or first available), capped to 6.
  const featured = useMemo(() => {
    return (collections[0]?.products ?? []).slice(0, 6);
  }, [collections]);

  // Remaining collections (everything except the one used for "Featured").
  const otherCollections = useMemo(() => collections.slice(1), [collections]);

  const renderProduct = ({ item, large }: { item: Product; large?: boolean }) => {
    const sale = item.compareAtPrice && parseFloat(item.compareAtPrice) > parseFloat(item.price);
    const cardStyle = large ? s.cardLarge : s.card;
    const imgH = large ? FEATURED_IMG_H : STD_IMG_H;
    return (
      <TouchableOpacity style={cardStyle} onPress={() => openProduct(item.handle)} activeOpacity={0.92}>
        <View style={s.cardImgWrap}>
          {item.image ? (
            <LazyImage uri={item.image} width={'100%'} height={imgH} borderRadius={14} resizeMode="cover" />
          ) : (
            <View style={[s.cardImagePlaceholder, { height: imgH }]}>
              <ShoppingBag size={28} color="rgba(255,255,255,0.18)" variant="Bulk" />
            </View>
          )}
          {sale && (
            <View style={s.saleBadge}>
              <Text style={s.saleBadgeText}>Sale</Text>
            </View>
          )}
        </View>
        <View style={s.cardBody}>
          {!!item.vendor && <Text style={s.cardVendor} numberOfLines={1}>{item.vendor}</Text>}
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={s.priceRow}>
            <Text style={s.cardPrice}>₹{parseFloat(item.price).toLocaleString('en-IN')}</Text>
            {sale && (
              <Text style={s.cardCompare}>
                ₹{parseFloat(item.compareAtPrice as string).toLocaleString('en-IN')}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHero = () => {
    if (!heroProduct) return null;
    return (
      <TouchableOpacity
        style={s.heroCard}
        activeOpacity={0.92}
        onPress={() => openProduct(heroProduct.handle)}
      >
        {heroProduct.image && (
          <LazyImage uri={heroProduct.image} width={'100%'} height={HERO_HEIGHT} borderRadius={20} resizeMode="cover" />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(3,3,8,0)', 'rgba(3,3,8,0.85)']}
          locations={[0, 0.4, 1]}
          style={s.heroOverlay}
        />
        <View style={s.heroContent}>
          <View style={s.heroPill}>
            <Star1 size={11} color="#d4c5a0" variant="Bold" />
            <Text style={s.heroPillText}>Featured</Text>
          </View>
          <Text style={s.heroTitle} numberOfLines={2}>{heroProduct.title}</Text>
          <View style={s.heroFooter}>
            <Text style={s.heroPrice}>
              ₹{parseFloat(heroProduct.price).toLocaleString('en-IN')}
            </Text>
            <View style={s.heroCta}>
              <Text style={s.heroCtaText}>Shop now</Text>
              <ArrowRight2 size={14} color="#030308" variant="Bold" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategoryTile = (col: Collection) => {
    const meta = CATEGORY_META[col.handle] ?? {
      label: col.title,
      icon: ShoppingBag,
      color: '#d4c5a0',
    };
    const Icon = meta.icon;
    const cover = col.products?.[0]?.image ?? null;
    return (
      <TouchableOpacity
        key={col.handle}
        style={s.tile}
        activeOpacity={0.85}
        onPress={() => onCategorySelect?.(col.handle, col.title)}
      >
        <View style={[s.tileIconWrap, { backgroundColor: hexAlpha(meta.color, 0.14), borderColor: hexAlpha(meta.color, 0.3) }]}>
          {cover ? (
            <LazyImage uri={cover} width={IS_TABLET ? 52 : 44} height={IS_TABLET ? 52 : 44} borderRadius={12} resizeMode="cover" />
          ) : (
            <Icon size={IS_TABLET ? 26 : 22} color={meta.color} variant="Bulk" />
          )}
        </View>
        <Text style={s.tileLabel} numberOfLines={1}>{meta.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {/* Header — branded, no back button. Logo + wordmark on the left,
          profile/sign-in avatar button on the right. */}
      <View style={s.header}>
        <View style={s.brandRow}>
          <View style={s.brandLogoWrap}>
            <Image source={require('../assets/pie-logo.png')} style={s.brandLogo} resizeMode="contain" />
          </View>
          <View>
            <Text style={s.brandEyebrow}>PIE MATRIX</Text>
            <Text style={s.brandWordmark}>Shop</Text>
          </View>
        </View>
        {onProfilePress && (
          <TouchableOpacity style={s.avatarBtn} activeOpacity={0.85} onPress={onProfilePress}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
            ) : user ? (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitial}>{initial || 'P'}</Text>
              </View>
            ) : (
              <View style={s.avatarGuest}>
                <User size={18} color="#d4c5a0" variant="Bulk" />
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#d4c5a0" />
          <Text style={s.loadingText}>Loading the storefront…</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scrollInner, { paddingBottom: 160 }]}
        >
          {/* Title block */}
          <View style={s.titleBlock}>
            <Text style={s.titleEyebrow}>PIE MATRIX</Text>
            <Text style={s.titleH1}>Premium gear,{'\n'}observatory-grade.</Text>
            <Text style={s.titleSub}>Hand-picked telescopes, binoculars, and accessories — the same kit our team observes with.</Text>
          </View>

          {/* Hero promo */}
          {renderHero()}

          {/* Quick categories */}
          {collections.length > 0 && (
            <View style={s.categoriesSection}>
              <Text style={s.sectionLabel}>BROWSE BY CATEGORY</Text>
              <View style={s.categoryGrid}>
                {collections.map(renderCategoryTile)}
              </View>
            </View>
          )}

          {/* Featured */}
          {featured.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Featured</Text>
                {collections[0] && (
                  <TouchableOpacity
                    style={s.seeAllBtn}
                    onPress={() => onCategorySelect?.(collections[0].handle, collections[0].title)}
                  >
                    <Text style={s.seeAllText}>See all</Text>
                    <ArrowRight2 size={14} color="rgba(255,255,255,0.4)" variant="Linear" />
                  </TouchableOpacity>
                )}
              </View>
              <FlatList
                data={featured}
                renderItem={({ item }) => renderProduct({ item, large: true })}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.productListLarge}
              />
            </View>
          )}

          {/* Other collections — horizontal carousels */}
          {otherCollections.map(col => (
            <View key={col.handle} style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{col.title}</Text>
                <TouchableOpacity
                  style={s.seeAllBtn}
                  onPress={() => onCategorySelect?.(col.handle, col.title)}
                >
                  <Text style={s.seeAllText}>See all</Text>
                  <ArrowRight2 size={14} color="rgba(255,255,255,0.4)" variant="Linear" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={col.products}
                renderItem={({ item }) => renderProduct({ item })}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.productList}
              />
            </View>
          ))}

          {/* Visit store */}
          <TouchableOpacity style={s.visitStore} onPress={() => Linking.openURL(SHOP_URL)} activeOpacity={0.9}>
            <ShoppingBag size={18} color="#d4c5a0" variant="Bulk" />
            <View style={{ flex: 1 }}>
              <Text style={s.visitStoreTitle}>Visit the full store</Text>
              <Text style={s.visitStoreSub}>thepiematrix.com</Text>
            </View>
            <ArrowRight2 size={16} color="rgba(212,197,160,0.6)" variant="Linear" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

// --- Helpers ---

/** Convert a #rrggbb hex to an `rgba(r,g,b,alpha)` string. */
function hexAlpha(hex: string, a: number) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// --- Styles ---

const CONTENT_W = Math.min(W, MAX_CONTENT_W);
const TILE_COLS = IS_TABLET ? 6 : 4;
const TILE_W = (CONTENT_W - 40 - (TILE_COLS - 1) * 8) / TILE_COLS;
const CARD_W = IS_TABLET ? 200 : Math.min(170, W * 0.44);
const CARD_LARGE_W = IS_TABLET ? 280 : Math.min(220, W * 0.62);
const HERO_HEIGHT = IS_TABLET ? 280 : 220;
const FEATURED_IMG_H = IS_TABLET ? 240 : 200;
const STD_IMG_H = IS_TABLET ? 200 : 170;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },

  // Header — branded row, no back button. Profile avatar on the right.
  // Centered to MAX_CONTENT_W on iPad so it sits in the same column as the
  // body content.
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 58, paddingHorizontal: 20, paddingBottom: 14,
    width: '100%', maxWidth: MAX_CONTENT_W, alignSelf: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandLogoWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    padding: 6,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  brandLogo: { width: '100%', height: '100%' },
  brandEyebrow: { color: 'rgba(212,197,160,0.85)', fontSize: 9, fontFamily: F_BOLD, letterSpacing: 1.8 },
  brandWordmark: { color: '#fff', fontSize: 22, fontFamily: F_TITLE, letterSpacing: -0.4, lineHeight: 26 },
  avatarBtn: {
    width: 42, height: 42, borderRadius: 21, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(212,197,160,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%', height: '100%',
    backgroundColor: 'rgba(212,197,160,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { color: '#d4c5a0', fontSize: 16, fontFamily: F_BOLD },
  avatarGuest: {
    width: '100%', height: '100%',
    backgroundColor: 'rgba(212,197,160,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: F_LIGHT },

  scroll: { flex: 1 },
  // Centered, capped column for iPad. On phones this is a no-op since
  // MAX_CONTENT_W > screen width.
  scrollInner: { width: '100%', maxWidth: MAX_CONTENT_W, alignSelf: 'center' },

  // Title block
  titleBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  titleEyebrow: { color: '#d4c5a0', fontSize: 11, fontFamily: F_BOLD, letterSpacing: 2, marginBottom: 6 },
  titleH1: { color: '#fff', fontSize: IS_TABLET ? 32 : 26, fontFamily: F_TITLE, lineHeight: IS_TABLET ? 38 : 32, letterSpacing: -0.4 },
  titleSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: F_REG, marginTop: 8, lineHeight: 19, maxWidth: 520 },

  // Hero promo card
  heroCard: {
    marginHorizontal: 20, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#141416',
    borderWidth: 1, borderColor: 'rgba(212,197,160,0.18)',
    marginTop: 6,
    height: HERO_HEIGHT,
  },
  heroImg: { width: '100%', height: HERO_HEIGHT },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(212,197,160,0.18)',
    borderWidth: 1, borderColor: 'rgba(212,197,160,0.4)',
    marginBottom: 8,
  },
  heroPillText: { color: '#d4c5a0', fontSize: 10, fontFamily: F_BOLD, letterSpacing: 0.6 },
  heroTitle: { color: '#fff', fontSize: IS_TABLET ? 22 : 18, fontFamily: F_BOLD, lineHeight: IS_TABLET ? 26 : 22, letterSpacing: -0.2 },
  heroFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10,
  },
  heroPrice: { color: '#fff', fontSize: IS_TABLET ? 19 : 17, fontFamily: F_TITLE },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#e8dcc8', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
  },
  heroCtaText: { color: '#030308', fontSize: 12, fontFamily: F_SEMIBOLD },

  // Categories
  categoriesSection: { marginTop: 26, paddingHorizontal: 20 },
  sectionLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_BOLD, letterSpacing: 1.5, marginBottom: 14 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: TILE_W, alignItems: 'center', paddingVertical: 12, gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tileIconWrap: {
    width: IS_TABLET ? 56 : 48, height: IS_TABLET ? 56 : 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    borderWidth: 1,
  },
  tileLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: F_MEDIUM, textAlign: 'center' },

  // Sections
  section: { marginTop: 28 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 14,
  },
  sectionTitle: { color: '#fff', fontSize: IS_TABLET ? 18 : 16, fontFamily: F_TITLE, letterSpacing: -0.2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_MEDIUM },

  productList: { paddingHorizontal: 20, gap: 12 },
  productListLarge: { paddingHorizontal: 20, gap: 14 },

  // Product cards
  card: {
    width: CARD_W,
    backgroundColor: '#141416',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cardLarge: {
    width: CARD_LARGE_W,
    backgroundColor: '#141416',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardImgWrap: { position: 'relative' },
  cardImagePlaceholder: {
    backgroundColor: '#1a1a1d', justifyContent: 'center', alignItems: 'center',
  },
  saleBadge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.85)',
  },
  saleBadgeText: { color: '#fff', fontSize: 10, fontFamily: F_BOLD, letterSpacing: 0.4 },
  cardBody: { padding: 12, gap: 4 },
  cardVendor: { color: 'rgba(212,197,160,0.7)', fontSize: 10, fontFamily: F_BOLD, letterSpacing: 0.6, textTransform: 'uppercase' },
  cardTitle: { color: '#fff', fontSize: 13, fontFamily: F_MEDIUM, lineHeight: 17 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  cardPrice: { color: '#fff', fontSize: 14, fontFamily: F_BOLD },
  cardCompare: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: F_REG, textDecorationLine: 'line-through' },

  // Visit store
  visitStore: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 32, marginHorizontal: 20, paddingVertical: 16, paddingHorizontal: 18,
    backgroundColor: 'rgba(212,197,160,0.06)',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(212,197,160,0.18)',
  },
  visitStoreTitle: { color: '#fff', fontSize: 14, fontFamily: F_SEMIBOLD },
  visitStoreSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_REG, marginTop: 2 },
});
