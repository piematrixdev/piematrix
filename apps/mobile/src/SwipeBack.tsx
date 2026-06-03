/**
 * SwipeBack — Wraps a screen to add iOS-style left-edge swipe to go back.
 * Swipe from the left 30px edge to trigger onBack.
 */

import React, { useRef } from 'react';
import { View, Animated, PanResponder, Dimensions, StyleSheet } from 'react-native';

const { width: W } = Dimensions.get('window');
const EDGE_WIDTH = 30; // touch must start within 30px of left edge
const THRESHOLD = W * 0.3; // swipe 30% of screen to trigger

interface Props {
  onBack: () => void;
  children: React.ReactNode;
  enabled?: boolean;
}

export default function SwipeBack({ onBack, children, enabled = true }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => {
        if (!enabled) return false;
        return e.nativeEvent.pageX < EDGE_WIDTH;
      },
      onMoveShouldSetPanResponder: (e, gs) => {
        if (!enabled) return false;
        return e.nativeEvent.pageX < EDGE_WIDTH + 20 && gs.dx > 10 && Math.abs(gs.dy) < 30;
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          translateX.setValue(gs.dx);
          opacity.setValue(1 - gs.dx / W * 0.3);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > THRESHOLD || gs.vx > 0.5) {
          // Complete the swipe
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: W,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => onBack());
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 12,
          }).start();
          Animated.spring(opacity, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX }], opacity }]}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
