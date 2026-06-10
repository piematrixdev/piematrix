/**
 * CategoryScreen — Displays products from a specific collection/category.
 * Navigated to when user taps "View all" on a category section.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Dimensions, ActivityIndicator,
} from 'react-native';
import { ArrowLeft2, ShoppingBag } from 'iconsax-react-native';
import { fetchCollectionProducts, Product } from './shopify';
import LazyImage from './components/LazyImage';
import SkeletonLoader from './components/SkeletonLoader';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 48) / 2; // 2-column grid with gaps

const F_LIGHT = 'Poppins-Light';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';

interface CategoryScreenProps {
  collectionHandle: string;
  title: string;
  onClose: () => void;
  onProductSelect: (handle: string) => void;
}

export default function CategoryScreen({ collectionHandle, title, onClose, onProductSelect }: CategoryScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchCollectionProducts(collectionHandle, 50);
      setProducts(data);
      setLoading(false);
    })();
  }, [collectionHandle]);

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.9}
      onPress={() => onProductSelect(item.handle)}
    >
      {item.image ? (
        <LazyImage uri={item.image} width={CARD_W} height={CARD_W} borderRadius={16} resizeMode="cover" />
      ) : (
        <View style={s.cardImageEmpty}>
          <ShoppingBag size={24} color="rgba(255,255,255,0.1)" variant="Linear" />
        </View>
      )}
      <View style={s.cardInfo}>
        <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={s.cardPrice}>₹{parseFloat(item.price).toLocaleString('en-IN')}</Text>
        {item.vendor ? <Text style={s.cardVendor}>{item.vendor}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  const renderSkeleton = () => (
    <View style={s.skeletonGrid}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <View key={i} style={s.card}>
          <SkeletonLoader width={CARD_W} height={CARD_W} borderRadius={16} />
          <View style={s.cardInfo}>
            <SkeletonLoader width={CARD_W - 24} height={14} borderRadius={4} />
            <SkeletonLoader width={80} height={14} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <ArrowLeft2 size={22} color="#fff" variant="Linear" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{title}</Text>
          <Text style={s.headerSub}>{loading ? 'Loading...' : `${products.length} products`}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Product grid */}
      {loading ? (
        renderSkeleton()
      ) : products.length === 0 ? (
        <View style={s.empty}>
          <ShoppingBag size={40} color="rgba(255,255,255,0.15)" variant="Bulk" />
          <Text style={s.emptyText}>No products found</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.row}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: F_TITLE, letterSpacing: -0.3 },
  headerSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 2 },

  grid: { padding: 16, paddingBottom: 40 },
  row: { gap: 12, marginBottom: 12 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },

  card: {
    width: CARD_W, borderRadius: 20, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cardImageEmpty: {
    width: CARD_W, height: CARD_W,
    backgroundColor: '#0a0a12', justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { padding: 12 },
  cardTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: F_REG, lineHeight: 18 },
  cardPrice: { color: '#d4c5a0', fontSize: 15, fontFamily: F_BOLD, marginTop: 6 },
  cardVendor: { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontFamily: F_LIGHT, marginTop: 4 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontFamily: F_LIGHT },
});
