/**
 * StarGLOrb — A mini GL shader sphere that looks like a real star.
 * Procedural surface with noise, limb darkening, corona glow, and rotation.
 * Color is driven by the star's spectral type.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';

interface Props {
  color: string;
  size?: number;
}

export default function StarGLOrb({ color, size = 64 }: Props) {
  const glRef = useRef<any>(null);
  const frameRef = useRef<number>(0);
  const rendererRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendererRef.current) rendererRef.current.dispose();
    };
  }, []);

  const onContextCreate = (gl: any) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.z = 2.8;

    // Parse the hex color
    const starColor = new THREE.Color(color);

    // Star sphere with custom shader
    const geo = new THREE.SphereGeometry(0.9, 32, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(starColor.r, starColor.g, starColor.b) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vPosition;

        // 3D noise (no UV seams)
        float hash3(vec3 p) {
          p = fract(p * vec3(443.897, 441.423, 437.195));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }
        float noise3(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
                mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        float fbm3(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise3(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          // Limb darkening
          float rim = dot(vNormal, vec3(0.0, 0.0, 1.0));
          float limb = pow(max(rim, 0.0), 0.6);

          // Surface noise using 3D position (seamless on sphere)
          vec3 noisePos = vPosition * 3.0 + vec3(uTime * 0.005, uTime * 0.003, uTime * 0.004);
          float surfaceNoise = fbm3(noisePos);

          // Granulation
          float granules = fbm3(vPosition * 6.0 + vec3(uTime * 0.008, 0.0, uTime * 0.003));

          // Combine
          vec3 bright = uColor * 1.3;
          vec3 dark = uColor * 0.7;
          vec3 surface = mix(dark, bright, surfaceNoise * 0.6 + 0.4);
          surface += (granules - 0.5) * 0.12 * uColor;

          // Limb darkening
          surface *= limb;

          // Hot center glow
          surface += pow(rim, 2.5) * 0.25 * uColor;

          // Corona at edge
          float corona = pow(1.0 - max(rim, 0.0), 3.0) * 0.4;
          surface += corona * uColor * 0.8;

          gl_FragColor = vec4(surface, 1.0);
        }
      `,
    });

    const sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    // Outer glow sprite (corona)
    const glowGeo = new THREE.SphereGeometry(1.15, 32, 32);
    const glowMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(starColor.r, starColor.g, starColor.b) },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float rim = dot(vNormal, vec3(0.0, 0.0, 1.0));
          // Only visible at edges (corona)
          float glow = pow(1.0 - rim, 2.5);
          // Pulsing
          float pulse = 0.9 + 0.1 * sin(uTime * 0.5);
          float alpha = glow * pulse * 0.6;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(uColor * 1.2, alpha);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowSphere);

    const startTime = Date.now();

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = (Date.now() - startTime) * 0.001;

      // Rotate the star slowly
      sphere.rotation.y = t * 0.08;
      sphere.rotation.x = Math.sin(t * 0.05) * 0.05;

      // Update time uniforms
      (sphere.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (glowSphere.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <GLView
        style={{ width: size, height: size }}
        onContextCreate={onContextCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 32,
    overflow: 'hidden',
  },
});
