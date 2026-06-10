/**
 * Shop Screen — dark premium design matching the app's UI.
 * Fetches products from Shopify, displays in horizontal scroll sections.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Linking, Dimensions, FlatList,
} from 'react-native';
import { ArrowLeft, ShoppingBag, ArrowRight2 } from 'iconsax-react-native';
import { fetchCollections, Collection, Product, SHOP_URL } from './shopify';
import LazyImage from './components/LazyImage';

const { width: W } = Dimensions.get('window');

const F_LIGHT = 'Poppins-Light';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_REG = 'Poppins-Regular';
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

interface ShopScreenProps {
  onClose: () => void;
  onProductSelect?: (handle: string) => void;
  onCategorySelect?: (handle: string, title: string) => void;
}

export default function ShopScreen({ onClose, onProductSelect, onCategorySelect }: ShopScreenProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

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

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity style={s.card} onPress={() => openProduct(item.handle)} activeOpacity={0.9}>
      {item.image ? (
        <LazyImage uri={item.image} width={'100%'} height={160} borderRadius={12} resizeMode="cover" />
      ) : (
        <View style={s.cardImagePlaceholder}>
          <ShoppingBag size={24} color="rgba(255,255,255,0.2)" variant="Bulk" />
        </View>
      )}
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={s.cardPrice}>₹{parseFloat(item.price).toLocaleString('en-IN')}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <ArrowLeft size={20} color="#fff" variant="Linear" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Shop</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={s.loadingText}>Loading products…</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {collections.map(col => (
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
                renderItem={renderProduct}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.productList}
              />
            </View>
          ))}

          {/* Visit store */}
          <TouchableOpacity style={s.visitStore} onPress={() => Linking.openURL(SHOP_URL)}>
            <Text style={s.visitStoreText}>Visit Full Store</Text>
            <ArrowRight2 size={16} color="rgba(255,255,255,0.5)" variant="Linear" />
          </TouchableOpacity>

          <View style={{ height: 140 }} />
        </ScrollView>
      )}
    </View>
  );
}

const CARD_W = W * 0.4;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 58, paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#161619', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontFamily: F_TITLE },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: F_LIGHT },

  scroll: { flex: 1 },

  // Sections
  section: { marginTop: 28 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 14,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontFamily: F_TITLE },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: F_REG },

  // Product list
  productList: { paddingHorizontal: 20, gap: 12 },

  // Product cards
  card: {
    width: CARD_W, backgroundColor: '#141416',
    borderRadius: 16, overflow: 'hidden',
  },
  cardImage: { width: CARD_W, height: CARD_W, backgroundColor: '#1a1a1d' },
  cardImagePlaceholder: {
    width: CARD_W, height: CARD_W * 0.75,
    backgroundColor: '#1a1a1d', justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { padding: 12 },
  cardTitle: { color: '#fff', fontSize: 13, fontFamily: F_REG, lineHeight: 18 },
  cardPrice: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: F_BOLD, marginTop: 6 },

  // Visit store
  visitStore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 32, marginHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#161619', borderRadius: 14,
  },
  visitStoreText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: F_REG },
});
