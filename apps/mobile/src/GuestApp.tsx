/**
 * GuestApp — minimal experience for users who skipped sign-up.
 *
 * Shows only the Shop (the one truly non-account feature) plus a clear
 * "Sign in to unlock everything" CTA. Once the user signs in, AuthGate
 * swaps GuestApp out for AppContent (full app).
 *
 * Apple App Review 5.1.1(v): guests can browse the shop without giving up
 * any personal data; account-bound features (sky view personalization,
 * favorites, calendar reminders, AI history) live behind sign-in.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Linking, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight2 } from 'iconsax-react-native';
import ShopScreen from './ShopScreen';
import ProductDetailScreen from './ProductDetailScreen';
import CategoryScreen from './CategoryScreen';
import { useAuth } from './auth/AuthContext';

const { width: W } = Dimensions.get('window');
const F_REG = 'Poppins-Regular';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_BOLD = 'Poppins-Bold';

type Screen = 'shop' | 'product' | 'category';

export default function GuestApp() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>('shop');
  const [productHandle, setProductHandle] = useState<string | null>(null);
  const [category, setCategory] = useState<{ handle: string; title: string } | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // Auto-dismiss the login modal once the user is signed in. AuthGate will
  // then swap GuestApp out for AppContent.
  useEffect(() => { if (user && showLogin) setShowLogin(false); }, [user, showLogin]);

  // Bouncing bottom CTA so the sign-in path stays visible.
  return (
    <View style={s.root}>
      {screen === 'shop' && (
        <ShopScreen
          onClose={() => {
            // No back navigation in guest mode — close just no-ops or could
            // open the system share/quit. Bring up sign-in instead so the
            // CTA is unmissable.
            setShowLogin(true);
          }}
          onProfilePress={() => setShowLogin(true)}
          onProductSelect={(handle) => { setProductHandle(handle); setScreen('product'); }}
          onCategorySelect={(handle, title) => { setCategory({ handle, title }); setScreen('category'); }}
        />
      )}
      {screen === 'product' && productHandle && (
        <ProductDetailScreen
          handle={productHandle}
          onClose={() => setScreen('shop')}
        />
      )}
      {screen === 'category' && category && (
        <CategoryScreen
          collectionHandle={category.handle}
          title={category.title}
          onClose={() => setScreen('shop')}
          onProductSelect={(handle) => { setProductHandle(handle); setScreen('product'); }}
        />
      )}

      {/* Persistent "Sign in to unlock more" pill — sits above any system
          tab bar territory so it stays visible while scrolling the shop.
          Hidden on the product detail screen, where its own "Shop Now" CTA
          lives at the bottom and would otherwise be covered. */}
      {screen !== 'product' && (
        <View style={s.ctaWrap} pointerEvents="box-none">
          <LinearGradient
            colors={['transparent', 'rgba(3,3,8,0.85)', '#030308']}
            locations={[0, 0.4, 1]}
            style={s.ctaFade}
            pointerEvents="none"
          />
          <TouchableOpacity
            style={s.ctaBtn}
            activeOpacity={0.85}
            onPress={() => setShowLogin(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.ctaTitle}>Sign in to unlock everything</Text>
              <Text style={s.ctaSub}>AR sky view, telescope tools, calendar &amp; more</Text>
            </View>
            <ArrowRight2 size={18} color="#030308" variant="Bold" />
          </TouchableOpacity>
        </View>
      )}

      {/* Sign-in modal — reuses the existing LoginScreen. */}
      <Modal
        visible={showLogin}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLogin(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#030308' }}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowLogin(false)} style={s.modalClose}>
              <Text style={s.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          {showLogin && (() => {
            const LoginScreen = require('./auth/LoginScreen').default;
            return <LoginScreen />;
          })()}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },
  ctaWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingBottom: 24, paddingHorizontal: 16, paddingTop: 56,
  },
  ctaFade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#d4c5a0',
    paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: 18,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaTitle: { color: '#030308', fontSize: 14, fontFamily: F_BOLD },
  ctaSub: { color: 'rgba(3,3,8,0.65)', fontSize: 11, fontFamily: F_REG, marginTop: 2 },

  modalHeader: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  modalClose: { paddingHorizontal: 8, paddingVertical: 6 },
  modalCloseText: { color: '#d4c5a0', fontSize: 15, fontFamily: F_BOLD },
});
