/**
 * SpaceShooterGame — Retro pixel-art space shooter easter egg.
 * 100 procedurally generated levels. Touch to move, auto-fire.
 * Hidden behind a long-press on the Pie Matrix brand name.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  PanResponder, StatusBar,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const SHIP_W = 24;
const SHIP_H = 28;
const BULLET_W = 3;
const BULLET_H = 10;
const ENEMY_W = 20;
const ENEMY_H = 20;
const STAR_COUNT = 60;
const MAX_LEVEL = 100;

interface Entity { x: number; y: number; w: number; h: number; }
interface Bullet extends Entity { dy: number; }
interface Enemy extends Entity { hp: number; speed: number; type: number; dx: number; }
interface Star { x: number; y: number; speed: number; brightness: number; }
interface Particle { x: number; y: number; dx: number; dy: number; life: number; color: string; }

function generateLevel(level: number) {
  // Procedural level generation — difficulty scales with level
  const enemyCount = Math.min(5 + Math.floor(level * 1.5), 40);
  const baseSpeed = 1 + level * 0.15;
  const baseHp = 1 + Math.floor(level / 10);
  return { enemyCount, baseSpeed, baseHp };
}

function getEnemyColor(type: number): string {
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  return colors[type % colors.length];
}

const MENU_TAGLINES = [
  'Because telescopes need a break too',
  'Defend the cosmos, one pixel at a time',
  'No light pollution here',
  'Your telescope can\'t do this',
  'Aliens hate this one simple trick',
];

const LEVEL_CLEAR_QUIPS = [
  'Not bad for a stargazer',
  'The cosmos approves',
  'Even Hubble is impressed',
  'Your reflexes are astronomical',
  'Light speed reflexes detected',
  'The aliens are reconsidering',
  'Bortle class: legendary',
  'That was stellar',
];

const GAME_OVER_QUIPS = [
  'The stars will remember you',
  'Even supernovae fade eventually',
  'Back to the eyepiece with you',
  'The void claims another pilot',
  'Your ship needed more aperture',
  'Should\'ve bought a bigger telescope',
  'Gravity wins again',
];

const WIN_QUIPS = [
  'You are the universe experiencing itself',
  'The final frontier has been conquered',
  'Neil Armstrong would be proud',
  'Achievement unlocked: Cosmic Legend',
];

interface Props { onClose: () => void; }

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function SpaceShooterGame({ onClose }: Props) {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'levelclear' | 'win'>('menu');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [quip, setQuip] = useState(() => pickRandom(MENU_TAGLINES));

  // Game entities (refs for performance — no re-renders during gameplay)
  const shipRef = useRef({ x: W / 2 - SHIP_W / 2, y: H - 120 });
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const enemyBulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const frameRef = useRef<number>(0);
  const lastShotRef = useRef(0);
  const spawnedRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const killedRef = useRef(0);
  const escapedRef = useRef(0);
  const levelConfigRef = useRef(generateLevel(1));
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const canvasRef = useRef<View>(null);

  // For rendering — force update at 30fps for the UI
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  // Initialize stars
  useEffect(() => {
    starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      speed: 0.5 + Math.random() * 2,
      brightness: 0.3 + Math.random() * 0.7,
    }));
  }, []);

  const startLevel = useCallback((lvl: number) => {
    const config = generateLevel(lvl);
    levelConfigRef.current = config;
    bulletsRef.current = [];
    enemiesRef.current = [];
    enemyBulletsRef.current = [];
    particlesRef.current = [];
    spawnedRef.current = 0;
    spawnTimerRef.current = 0;
    killedRef.current = 0;
    escapedRef.current = 0;
    shipRef.current = { x: W / 2 - SHIP_W / 2, y: H - 120 };
    setLevel(lvl);
    setGameState('playing');
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    startLevel(1);
  }, [startLevel]);

  // Pan responder for ship movement
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        const newX = Math.max(0, Math.min(W - SHIP_W, gesture.moveX - SHIP_W / 2));
        const newY = Math.max(H * 0.4, Math.min(H - 60, gesture.moveY - SHIP_H / 2));
        shipRef.current = { x: newX, y: newY };
      },
    })
  ).current;

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const loop = () => {
      const now = Date.now();
      const config = levelConfigRef.current;

      // Auto-fire
      if (now - lastShotRef.current > 200) {
        lastShotRef.current = now;
        bulletsRef.current.push({
          x: shipRef.current.x + SHIP_W / 2 - BULLET_W / 2,
          y: shipRef.current.y - BULLET_H,
          w: BULLET_W, h: BULLET_H, dy: -10,
        });
      }

      // Spawn enemies
      spawnTimerRef.current++;
      const spawnRate = Math.max(15, 60 - level * 2);
      if (spawnTimerRef.current >= spawnRate && spawnedRef.current < config.enemyCount) {
        spawnTimerRef.current = 0;
        spawnedRef.current++;
        const type = Math.floor(Math.random() * Math.min(3 + Math.floor(level / 10), 6));
        const enemyW = ENEMY_W + type * 4;
        const enemyH = ENEMY_H + type * 3;
        enemiesRef.current.push({
          x: Math.random() * (W - enemyW),
          y: -enemyH,
          w: enemyW, h: enemyH,
          hp: config.baseHp + type,
          speed: config.baseSpeed + Math.random() * 0.5,
          type,
          dx: (Math.random() - 0.5) * 2,
        });
      }

      // Enemy shooting — starts at level 5, very rare, ramps slowly
      if (level >= 5) {
        for (const enemy of enemiesRef.current) {
          // Fire rate: level 5 = 0.0005, level 20 = 0.002, level 50 = 0.005, level 100 = 0.008
          const fireChance = 0.0005 * Math.pow(level / 5, 0.9);
          if (Math.random() < Math.min(fireChance, 0.008)) {
            enemyBulletsRef.current.push({
              x: enemy.x + enemy.w / 2 - 2,
              y: enemy.y + enemy.h,
              w: 4, h: 8, dy: 3.5 + level * 0.03,
            });
          }
        }
      }

      // Update bullets
      bulletsRef.current = bulletsRef.current.filter(b => {
        b.y += b.dy;
        return b.y > -BULLET_H;
      });

      // Update enemy bullets
      enemyBulletsRef.current = enemyBulletsRef.current.filter(b => {
        b.y += b.dy;
        return b.y < H + 10;
      });

      // Update enemies
      enemiesRef.current = enemiesRef.current.filter(e => {
        e.y += e.speed;
        e.x += e.dx;
        if (e.x <= 0 || e.x >= W - e.w) e.dx *= -1;
        // Off screen bottom — lose a life, count as dealt with
        if (e.y > H + 20) {
          livesRef.current--;
          escapedRef.current++;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            setHighScore(h => Math.max(h, scoreRef.current));
            setQuip(pickRandom(GAME_OVER_QUIPS));
            setGameState('gameover');
          }
          return false;
        }
        return true;
      });

      // Collision: player bullets vs enemies
      bulletsRef.current = bulletsRef.current.filter(bullet => {
        for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
          const e = enemiesRef.current[i];
          if (bullet.x < e.x + e.w && bullet.x + bullet.w > e.x &&
              bullet.y < e.y + e.h && bullet.y + bullet.h > e.y) {
            e.hp--;
            // Spawn hit particle
            particlesRef.current.push({
              x: bullet.x, y: bullet.y,
              dx: (Math.random() - 0.5) * 4, dy: (Math.random() - 0.5) * 4,
              life: 15, color: getEnemyColor(e.type),
            });
            if (e.hp <= 0) {
              // Explosion particles
              for (let p = 0; p < 8; p++) {
                particlesRef.current.push({
                  x: e.x + e.w / 2, y: e.y + e.h / 2,
                  dx: (Math.random() - 0.5) * 6, dy: (Math.random() - 0.5) * 6,
                  life: 20 + Math.random() * 10, color: getEnemyColor(e.type),
                });
              }
              enemiesRef.current.splice(i, 1);
              killedRef.current++;
              scoreRef.current += 10 * (e.type + 1);
              setScore(scoreRef.current);
            }
            return false;
          }
        }
        return true;
      });

      // Collision: enemy bullets vs player
      const ship = shipRef.current;
      enemyBulletsRef.current = enemyBulletsRef.current.filter(b => {
        if (b.x < ship.x + SHIP_W && b.x + b.w > ship.x &&
            b.y < ship.y + SHIP_H && b.y + b.h > ship.y) {
          livesRef.current--;
          setLives(livesRef.current);
          // Hit flash particles
          for (let p = 0; p < 5; p++) {
            particlesRef.current.push({
              x: ship.x + SHIP_W / 2, y: ship.y,
              dx: (Math.random() - 0.5) * 5, dy: -Math.random() * 3,
              life: 12, color: '#fff',
            });
          }
          if (livesRef.current <= 0) {
            setHighScore(h => Math.max(h, scoreRef.current));
            setQuip(pickRandom(GAME_OVER_QUIPS));
            setGameState('gameover');
          }
          return false;
        }
        return true;
      });

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
        return p.life > 0;
      });

      // Update stars
      for (const star of starsRef.current) {
        star.y += star.speed;
        if (star.y > H) { star.y = 0; star.x = Math.random() * W; }
      }

      // Level complete check — all enemies either killed or escaped
      const totalDealt = killedRef.current + escapedRef.current;
      if (totalDealt >= config.enemyCount && enemiesRef.current.length === 0) {
        if (level >= MAX_LEVEL) {
          setHighScore(h => Math.max(h, scoreRef.current));
          setQuip(pickRandom(WIN_QUIPS));
          setGameState('win');
        } else {
          setQuip(pickRandom(LEVEL_CLEAR_QUIPS));
          setGameState('levelclear');
        }
        return;
      }

      // Render tick (30fps UI update)
      tickRef.current++;
      if (tickRef.current % 2 === 0) setTick(t => t + 1);

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [gameState, level]);

  // Render game entities as absolute-positioned views (pixel art style)
  const renderGame = () => (
    <View style={s.gameArea} {...panResponder.panHandlers}>
      {/* Stars */}
      {starsRef.current.map((star, i) => (
        <View key={`s${i}`} style={[s.star, {
          left: star.x, top: star.y,
          opacity: star.brightness,
          width: star.speed > 1.5 ? 2 : 1,
          height: star.speed > 1.5 ? 2 : 1,
        }]} />
      ))}

      {/* Player ship (pixel triangle) */}
      <View style={[s.ship, { left: shipRef.current.x, top: shipRef.current.y }]}>
        <View style={s.shipBody} />
        <View style={s.shipWingL} />
        <View style={s.shipWingR} />
        <View style={s.shipNose} />
        <View style={s.shipEngine} />
      </View>

      {/* Bullets */}
      {bulletsRef.current.map((b, i) => (
        <View key={`b${i}`} style={[s.bullet, { left: b.x, top: b.y }]} />
      ))}

      {/* Enemy bullets */}
      {enemyBulletsRef.current.map((b, i) => (
        <View key={`eb${i}`} style={[s.enemyBullet, { left: b.x, top: b.y }]} />
      ))}

      {/* Enemies */}
      {enemiesRef.current.map((e, i) => (
        <View key={`e${i}`} style={[s.enemy, {
          left: e.x, top: e.y, width: e.w, height: e.h,
          backgroundColor: getEnemyColor(e.type),
        }]}>
          <View style={[s.enemyEye, { left: e.w * 0.25 }]} />
          <View style={[s.enemyEye, { left: e.w * 0.6 }]} />
        </View>
      ))}

      {/* Particles */}
      {particlesRef.current.map((p, i) => (
        <View key={`p${i}`} style={[s.particle, {
          left: p.x, top: p.y,
          backgroundColor: p.color,
          opacity: p.life / 20,
          width: 3 + (p.life / 10),
          height: 3 + (p.life / 10),
        }]} />
      ))}

      {/* HUD */}
      <View style={s.hud}>
        <TouchableOpacity onPress={onClose} style={s.hudExit}>
          <Text style={s.hudExitText}>EXIT</Text>
        </TouchableOpacity>
        <Text style={s.hudText}>LVL {level}</Text>
        <Text style={s.hudText}>SCORE {score}</Text>
        <Text style={s.hudText}>{'■ '.repeat(Math.max(0, lives)).trim()}</Text>
      </View>
    </View>
  );

  // Animated starfield for menu/overlay backgrounds
  const [menuStars] = useState(() =>
    Array.from({ length: 80 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      speed: 0.3 + Math.random() * 1.5,
      size: Math.random() > 0.8 ? 2 : 1,
      brightness: 0.2 + Math.random() * 0.8,
    }))
  );

  useEffect(() => {
    if (gameState === 'playing') return;
    const iv = setInterval(() => {
      for (const star of menuStars) {
        star.y += star.speed;
        if (star.y > H) { star.y = -2; star.x = Math.random() * W; }
      }
      setTick(t => t + 1);
    }, 33);
    return () => clearInterval(iv);
  }, [gameState]);

  const renderMenuStars = () => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {menuStars.map((star, i) => (
        <View key={i} style={{
          position: 'absolute', left: star.x, top: star.y,
          width: star.size, height: star.size + (star.speed > 1 ? 1 : 0),
          backgroundColor: '#fff', borderRadius: 1,
          opacity: star.brightness,
        }} />
      ))}
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar hidden />

      {gameState === 'menu' && (
        <View style={s.overlay}>
          {renderMenuStars()}
          {/* Pixel ship art */}
          <View style={s.menuShip}>
            <View style={[s.shipNose, { left: 9, top: 0 }]} />
            <View style={[s.shipBody, { left: 6, top: 8 }]} />
            <View style={[s.shipWingL, { left: 0, top: 16 }]} />
            <View style={[s.shipWingR, { right: 0, top: 16 }]} />
            <View style={[s.shipEngine, { left: 9, top: 24 }]} />
          </View>
          <Text style={s.title}>SPACE{'\n'}SHOOTER</Text>
          <Text style={s.subtitle}>{quip}</Text>
          <View style={s.menuDivider} />
          <TouchableOpacity style={s.btn} onPress={startGame}>
            <Text style={s.btnText}>START GAME</Text>
          </TouchableOpacity>
          {highScore > 0 && <Text style={s.highScore}>HIGH SCORE: {highScore}</Text>}
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>EXIT</Text>
          </TouchableOpacity>
          <Text style={s.menuHint}>Drag to move - Auto fire</Text>
        </View>
      )}

      {gameState === 'playing' && renderGame()}

      {gameState === 'levelclear' && (
        <View style={s.overlay}>
          {renderMenuStars()}
          <Text style={s.levelClearText}>LEVEL {level}</Text>
          <Text style={s.title}>CLEAR</Text>
          <Text style={s.subtitle}>{quip}</Text>
          <Text style={s.scoreText}>Score: {score}</Text>
          <TouchableOpacity style={s.btn} onPress={() => startLevel(level + 1)}>
            <Text style={s.btnText}>NEXT LEVEL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>EXIT</Text>
          </TouchableOpacity>
        </View>
      )}

      {gameState === 'gameover' && (
        <View style={s.overlay}>
          {renderMenuStars()}
          <Text style={[s.title, { color: '#ef4444' }]}>GAME{'\n'}OVER</Text>
          <Text style={s.subtitle}>{quip}</Text>
          <Text style={s.scoreText}>Score: {score}  |  Level {level}</Text>
          <View style={s.menuDivider} />
          <TouchableOpacity style={s.btn} onPress={startGame}>
            <Text style={s.btnText}>RETRY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>EXIT</Text>
          </TouchableOpacity>
        </View>
      )}

      {gameState === 'win' && (
        <View style={s.overlay}>
          {renderMenuStars()}
          <Text style={[s.title, { color: '#4ade80' }]}>VICTORY</Text>
          <Text style={s.subtitle}>{quip}</Text>
          <View style={s.menuDivider} />
          <TouchableOpacity style={s.btn} onPress={startGame}>
            <Text style={s.btnText}>PLAY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>EXIT</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  gameArea: { flex: 1, backgroundColor: '#000' },

  // Stars
  star: { position: 'absolute', backgroundColor: '#fff', borderRadius: 1 },

  // Ship (pixel art)
  ship: { position: 'absolute', width: SHIP_W, height: SHIP_H },
  shipBody: { position: 'absolute', left: 6, top: 8, width: 12, height: 16, backgroundColor: '#60a5fa' },
  shipWingL: { position: 'absolute', left: 0, top: 16, width: 8, height: 10, backgroundColor: '#3b82f6' },
  shipWingR: { position: 'absolute', right: 0, top: 16, width: 8, height: 10, backgroundColor: '#3b82f6' },
  shipNose: { position: 'absolute', left: 9, top: 0, width: 6, height: 10, backgroundColor: '#93c5fd', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  shipEngine: { position: 'absolute', left: 9, bottom: 0, width: 6, height: 4, backgroundColor: '#f59e0b' },

  // Bullets
  bullet: { position: 'absolute', width: BULLET_W, height: BULLET_H, backgroundColor: '#4ade80' },
  enemyBullet: { position: 'absolute', width: 4, height: 8, backgroundColor: '#ef4444' },

  // Enemies (pixel blocks)
  enemy: { position: 'absolute', borderRadius: 3 },
  enemyEye: { position: 'absolute', top: 4, width: 4, height: 4, backgroundColor: '#000', borderRadius: 1 },

  // Particles
  particle: { position: 'absolute', borderRadius: 2 },

  // HUD
  hud: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hudText: { color: '#fff', fontSize: 14, fontFamily: 'Poppins-Bold', letterSpacing: 1 },
  hudExit: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },
  hudExitText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Poppins-Regular', letterSpacing: 1 },

  // Overlays
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 40 },
  title: { color: '#fff', fontSize: 48, fontFamily: 'TenorSans_400Regular', textAlign: 'center', letterSpacing: 4, marginBottom: 16 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: 'Poppins-Light', textAlign: 'center', marginBottom: 20 },
  menuShip: { width: SHIP_W, height: SHIP_H, marginBottom: 32, transform: [{ scale: 3 }] },
  menuDivider: { width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 20 },
  menuHint: { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontFamily: 'Poppins-Light', marginTop: 32, letterSpacing: 1 },
  levelClearText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'Poppins-Bold', letterSpacing: 3, marginBottom: 4 },
  btn: { backgroundColor: '#d4c5a0', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, marginBottom: 16 },
  btnText: { color: '#000', fontSize: 16, fontFamily: 'Poppins-Bold', letterSpacing: 2 },
  highScore: { color: '#d4c5a0', fontSize: 13, fontFamily: 'Poppins-Regular', marginTop: 12 },
  scoreText: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'Poppins-Regular', marginBottom: 20, letterSpacing: 1 },
  closeBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  closeBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Poppins-Regular', letterSpacing: 1 },
});
