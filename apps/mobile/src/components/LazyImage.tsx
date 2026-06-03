/**
 * LazyImage — Image with skeleton shimmer placeholder and fade-in.
 * Shows a SkeletonLoader while loading, fades in the image on load,
 * and displays a subtle placeholder on error.
 * Uses only react-native Animated for Expo compatibility.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  Animated,
  StyleSheet,
  ImageStyle,
  ViewStyle,
  ImageResizeMode,
  Text,
} from 'react-native';
import SkeletonLoader from './SkeletonLoader';

interface LazyImageProps {
  uri: string;
  width: number | string;
  height: number | string;
  borderRadius?: number;
  resizeMode?: ImageResizeMode;
  style?: ImageStyle;
  containerStyle?: ViewStyle;
}

export default function LazyImage({
  uri,
  width,
  height,
  borderRadius = 0,
  resizeMode = 'cover',
  style,
  containerStyle,
}: LazyImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleLoad = () => {
    setLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <View
      style={[
        styles.container,
        { width: width as any, height: height as any, borderRadius },
        containerStyle,
      ]}
    >
      {/* Skeleton placeholder — visible while loading */}
      {loading && !error && (
        <View style={StyleSheet.absoluteFill}>
          <SkeletonLoader
            width="100%"
            height="100%"
            borderRadius={borderRadius}
          />
        </View>
      )}

      {/* Error placeholder */}
      {error && (
        <View style={[styles.errorPlaceholder, { borderRadius }]}>
          <Text style={styles.errorText}>✦</Text>
        </View>
      )}

      {/* Actual image — fades in on load */}
      {!error && (
        <Animated.Image
          source={{ uri }}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius, opacity: fadeAnim },
            style,
          ]}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  errorPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.02)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'rgba(255,255,255,0.12)',
    fontSize: 20,
  },
});
