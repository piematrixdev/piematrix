/**
 * ProductDetailScreen — Full product page fetched from Shopify.
 * Shows images, price, description, variants, and buy button.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Linking, Dimensions, FlatList,
  Modal, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ShoppingBag, CloseCircle } from 'iconsax-react-native';
import { fetchProduct, Product, SHOP_URL } from './shopify';

const { width: W, height: H } = Dimensions.get('window');

const F_LIGHT = 'Poppins-Light';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';

interface Props {
  handle: string;
  onClose: () => void;
}

/** Strip HTML tags and decode entities for clean text display */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function ProductDetailScreen({ handle, onClose }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    fetchProduct(handle).then(p => {
      setProduct(p);
      setLoading(false);
    });
  }, [handle]);

  const buyNow = () => {
    Linking.openURL(`${SHOP_URL}/products/${handle}`);
  };

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={s.loadingWrap}>
        <Text style={s.errorText}>Product not found</Text>
        <TouchableOpacity onPress={onClose} style={s.backBtnFloat}>
          <ArrowLeft size={22} color="#fff" variant="Linear" />
        </TouchableOpacity>
      </View>
    );
  }

  const currentVariant = product.variants[selectedVariant];
  const hasDiscount = currentVariant?.compareAtPrice && parseFloat(currentVariant.compareAtPrice) > parseFloat(currentVariant.price);

  return (
    <View style={s.root}>
      {/* Back button */}
      <TouchableOpacity style={s.backBtn} onPress={onClose}>
        <ArrowLeft size={22} color="#fff" variant="Linear" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero image — edge-to-edge with soft fade to background */}
        <View style={s.heroSection}>
          {product.images.length > 0 ? (
            <>
              <FlatList
                data={product.images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / W);
                  setActiveImage(idx);
                }}
                renderItem={({ item }) => (
                  <View style={s.heroSlide}>
                    <Image source={{ uri: item }} style={s.heroImage} resizeMode="cover" />
                  </View>
                )}
                keyExtractor={(_, i) => String(i)}
              />
              {/* Bottom gradient fade into content */}
              <LinearGradient
                colors={['transparent', '#0a0a0c']}
                style={s.heroFade}
              />
              {/* Minimal pill indicator — bottom center */}
              {product.images.length > 1 && (
                <View style={s.indicatorPill}>
                  {product.images.map((_, i) => (
                    <View key={i} style={[s.indicatorDot, i === activeImage && s.indicatorDotActive]} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={s.heroEmpty}>
              <ShoppingBag size={40} color="rgba(255,255,255,0.1)" variant="Bulk" />
            </View>
          )}
        </View>

        {/* Product info */}
        <View style={s.info}>
          {/* Vendor & type */}
          <Text style={s.vendor}>{product.vendor}</Text>

          {/* Title */}
          <Text style={s.title}>{product.title}</Text>

          {/* Price */}
          <View style={s.priceRow}>
            <Text style={s.price}>₹{parseFloat(currentVariant?.price ?? product.price).toLocaleString('en-IN')}</Text>
            {hasDiscount && (
              <Text style={s.comparePrice}>
                ₹{parseFloat(currentVariant.compareAtPrice!).toLocaleString('en-IN')}
              </Text>
            )}
            {hasDiscount && (
              <View style={s.discountBadge}>
                <Text style={s.discountText}>
                  {Math.round((1 - parseFloat(currentVariant.price) / parseFloat(currentVariant.compareAtPrice!)) * 100)}% OFF
                </Text>
              </View>
            )}
          </View>

          {/* Availability */}
          <View style={s.availRow}>
            <View style={[s.availDot, { backgroundColor: product.available ? '#4ade80' : '#ef4444' }]} />
            <Text style={s.availText}>{product.available ? 'In Stock' : 'Out of Stock'}</Text>
          </View>

          {/* Variants */}
          {product.variants.length > 1 && (
            <View style={s.variantsSection}>
              <Text style={s.variantsLabel}>Options</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.variantsRow}>
                  {product.variants.map((v, i) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[s.variantChip, i === selectedVariant && s.variantChipActive]}
                      onPress={() => setSelectedVariant(i)}
                    >
                      <Text style={[s.variantText, i === selectedVariant && s.variantTextActive]}>
                        {v.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Description — native rendered */}
          {product.description.length > 0 && (
            <View style={s.descSection}>
              <Text style={s.descLabel}>About this product</Text>
              <Text style={s.descText}>{stripHtml(product.description)}</Text>
            </View>
          )}

          {/* Gallery — 2-column grid */}
          {product.images.length > 1 && (
            <View style={s.descSection}>
              <Text style={s.descLabel}>Gallery</Text>
              <View style={s.galleryGrid}>
                {product.images.map((img, i) => (
                  <TouchableOpacity key={i} style={s.galleryItem} activeOpacity={0.9} onPress={() => { setViewerIndex(i); setViewerVisible(true); }}>
                    <Image source={{ uri: img }} style={s.galleryImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Tags */}
          {Array.isArray(product.tags) && product.tags.length > 0 && (
            <View style={s.tagsRow}>
              {product.tags.slice(0, 5).map((tag, i) => (
                <View key={i} style={s.tag}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom bar — redesigned */}
      <View style={s.buyBar}>
        <LinearGradient
          colors={['transparent', 'rgba(10,10,12,0.9)', '#0a0a0c']}
          locations={[0, 0.3, 1]}
          style={s.buyBarGradient}
        />
        <View style={s.buyBarContent}>
          <View style={s.buyPriceCol}>
            <Text style={s.buyPrice}>₹{parseFloat(currentVariant?.price ?? product.price).toLocaleString('en-IN')}</Text>
            {hasDiscount && (
              <Text style={s.buyCompare}>₹{parseFloat(currentVariant.compareAtPrice!).toLocaleString('en-IN')}</Text>
            )}
          </View>
          <TouchableOpacity style={s.buyBtn} onPress={buyNow} activeOpacity={0.9}>
            <Text style={s.buyBtnText}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Viewer Modal — pinch to zoom */}
      {product && (
        <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
          <View style={s.viewerBg}>
            <StatusBar barStyle="light-content" />
            {/* Close button */}
            <TouchableOpacity style={s.viewerClose} onPress={() => setViewerVisible(false)}>
              <CloseCircle size={32} color="#fff" variant="Bulk" />
            </TouchableOpacity>
            {/* Zoomable image */}
            <ScrollView
              contentContainerStyle={s.viewerContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image
                source={{ uri: product.images[viewerIndex] }}
                style={s.viewerImage}
                resizeMode="contain"
              />
            </ScrollView>
            {/* Image counter */}
            <Text style={s.viewerCounter}>{viewerIndex + 1} / {product.images.length}</Text>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0c' },
  loadingWrap: { flex: 1, backgroundColor: '#0a0a0c', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontFamily: F_REG },

  // Back button
  backBtn: {
    position: 'absolute', top: 54, left: 16, zIndex: 10,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  backBtnFloat: {
    position: 'absolute', top: 54, left: 16,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
  },

  // Hero image — full bleed, edge-to-edge with gradient fade at bottom
  heroSection: { height: H * 0.5, position: 'relative', backgroundColor: '#111113' },
  heroSlide: {
    width: W, height: H * 0.5,
    justifyContent: 'center', alignItems: 'center',
  },
  heroImage: { width: W, height: H * 0.5 },
  heroEmpty: {
    width: W, height: H * 0.5,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#111113',
  },
  heroFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
    backgroundColor: 'transparent',
  },
  indicatorPill: {
    position: 'absolute', bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  indicatorDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  indicatorDotActive: {
    backgroundColor: '#fff', width: 18, borderRadius: 3,
  },

  // Info
  info: { paddingHorizontal: 20, paddingTop: 24 },
  vendor: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: F_REG, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  title: { color: '#fff', fontSize: 24, fontFamily: F_TITLE, lineHeight: 30, marginBottom: 14 },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  price: { color: '#fff', fontSize: 22, fontFamily: F_BOLD },
  comparePrice: { color: 'rgba(255,255,255,0.35)', fontSize: 16, fontFamily: F_LIGHT, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: 'rgba(74,222,128,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  discountText: { color: '#4ade80', fontSize: 11, fontFamily: F_BOLD },

  availRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: F_REG },

  // Variants
  variantsSection: { marginBottom: 24 },
  variantsLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_BOLD, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  variantsRow: { flexDirection: 'row', gap: 8 },
  variantChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#161619', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  variantChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  variantText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F_REG },
  variantTextActive: { color: '#0a0a0c', fontFamily: F_BOLD },

  // Description
  descSection: { marginBottom: 24 },
  descLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_BOLD, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  descText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: F_LIGHT, lineHeight: 22 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryItem: { width: (W - 40 - 10) / 2, height: (W - 40 - 10) / 2, borderRadius: 16, overflow: 'hidden', backgroundColor: '#141416' },
  galleryImage: { width: '100%', height: '100%' },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tag: { backgroundColor: '#161619', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tagText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: F_REG },

  // Buy bar
  buyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 36, paddingTop: 40,
  },
  buyBarGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  buyBarContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  buyPriceCol: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  buyPrice: { color: '#fff', fontSize: 24, fontFamily: F_BOLD },
  buyCompare: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontFamily: F_LIGHT, textDecorationLine: 'line-through' },
  buyBtn: {
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 16,
  },
  buyBtnText: { color: '#0a0a0c', fontSize: 15, fontFamily: F_BOLD },

  // Image viewer modal
  viewerBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  viewerClose: {
    position: 'absolute', top: 54, right: 20, zIndex: 10,
  },
  viewerContent: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  viewerImage: {
    width: W, height: H * 0.7,
  },
  viewerCounter: {
    position: 'absolute', bottom: 50,
    color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: F_REG,
  },
});
