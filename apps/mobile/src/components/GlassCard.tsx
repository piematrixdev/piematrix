import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  borderRadius?: number;
}

/** Reusable glass card wrapper — blur + gradient edge highlights */
export default function GlassCard({ children, style, intensity = 30, borderRadius = 16 }: GlassCardProps) {
  return (
    <View style={[{ borderRadius, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 14 }, style]}>
      {/* Top edge shine */}
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.45)', 'transparent']}
        locations={[0, 0.15, 0.85, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.edgeTop}
      />
      {/* Left edge */}
      <LinearGradient
        colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.04)', 'transparent']}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.edgeLeft}
      />
      {/* Right edge */}
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.edgeRight}
      />
      {/* Corner bloom */}
      <LinearGradient
        colors={['rgba(255,255,255,0.15)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cornerBloom, { borderTopLeftRadius: borderRadius }]}
      />
      <BlurView intensity={intensity} tint="dark" style={{ padding: 0, borderRadius, overflow: 'hidden' }}>
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,18,0.4)' }} />
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  edgeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 3 },
  edgeLeft: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 1, zIndex: 3 },
  edgeRight: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 1, zIndex: 3 },
  cornerBloom: { position: 'absolute', top: 0, left: 0, width: 70, height: 70, zIndex: 3, opacity: 0.6 },
});
