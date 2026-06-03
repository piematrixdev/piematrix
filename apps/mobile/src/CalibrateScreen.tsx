/**
 * CalibrateScreen — Point phone at the sky to calibrate.
 * Simple, fast, reliable — like Stellarium's approach.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Magicpen, Mobile, Refresh } from 'iconsax-react-native';

const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';

export default function CalibrateScreen() {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const arrowBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Gentle pulse on the circle
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Arrow bounce up
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowBounce, {
          toValue: -12,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(arrowBounce, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const ringScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.05],
  });

  const ringOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  return (
    <Animated.View style={[s.root, { opacity: fadeIn }]}>
      {/* Arrow pointing up */}
      <Animated.View style={[s.arrowWrap, { transform: [{ translateY: arrowBounce }] }]}>
        <View style={s.arrowHead} />
        <View style={s.arrowStem} />
      </Animated.View>

      {/* Pulsing ring */}
      <View style={s.circleWrap}>
        <Animated.View style={[s.outerRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
        <View style={s.innerDot} />
      </View>

      {/* Instructions */}
      <Text style={s.title}>Point at the sky</Text>
      <Text style={s.subtitle}>
        Hold your phone up toward the stars{'\n'}and stay still for a moment
      </Text>

      {/* Tips */}
      <View style={s.tipsWrap}>
        <View style={s.tipRow}>
          <Magicpen size={14} color="rgba(212,197,160,0.5)" variant="Linear" />
          <Text style={s.tip}>Move away from metal objects & electronics</Text>
        </View>
        <View style={s.tipRow}>
          <Mobile size={14} color="rgba(212,197,160,0.5)" variant="Linear" />
          <Text style={s.tip}>Hold phone steady, don't wave it around</Text>
        </View>
        <View style={s.tipRow}>
          <Refresh size={14} color="rgba(212,197,160,0.5)" variant="Linear" />
          <Text style={s.tip}>If off, exit and re-enter to recalibrate</Text>
        </View>
      </View>

      <Text style={s.hint}>Aligning with compass…</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#0a0a0c',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40,
  },

  arrowWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  arrowHead: {
    width: 0, height: 0,
    borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 18,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: 'rgba(212, 197, 160, 0.7)',
  },
  arrowStem: {
    width: 3, height: 30,
    backgroundColor: 'rgba(212, 197, 160, 0.5)',
    borderRadius: 2,
  },

  circleWrap: {
    width: 80, height: 80,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
  },
  outerRing: {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5, borderColor: 'rgba(212, 197, 160, 0.4)',
  },
  innerDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(212, 197, 160, 0.6)',
  },

  title: {
    color: '#e8dcc8', fontSize: 22, fontFamily: F_BOLD,
    marginBottom: 10,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: F_LIGHT,
    textAlign: 'center', lineHeight: 22,
    marginBottom: 40,
  },
  hint: {
    color: 'rgba(212, 197, 160, 0.3)', fontSize: 12, fontFamily: F_REG,
    letterSpacing: 0.5,
  },
  tipsWrap: {
    marginBottom: 30, gap: 12,
  },
  tipRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  tip: {
    color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: F_LIGHT,
  },
});
