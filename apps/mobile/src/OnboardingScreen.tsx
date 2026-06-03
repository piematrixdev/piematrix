/**
 * OnboardingScreen — Multi-step welcome flow.
 * Collects interests, experience level, gear, and profile photo.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Image,
  ScrollView, Animated, Easing, TextInput, Alert, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  Star1, Moon, Sun1, Global, Camera, Telescope, Magicpen,
  Radar, Eye, ArrowRight2, TickCircle, Gallery,
} from 'iconsax-react-native';
import { useAuth } from './auth/AuthContext';
import { supabase } from './auth/supabaseClient';
import { fetchCollectionProducts, Product } from './shopify';
import { requestAllPermissions } from './permissions';

const { width: W, height: H } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'TenorSans_400Regular';

const INTERESTS = [
  { id: 'planets', label: 'Planets' },
  { id: 'deep_sky', label: 'Deep Sky' },
  { id: 'astrophotography', label: 'Astrophotography' },
  { id: 'casual', label: 'Casual Stargazing' },
  { id: 'moon', label: 'Lunar' },
  { id: 'solar', label: 'Solar' },
  { id: 'satellites', label: 'Satellites & ISS' },
  { id: 'meteor_showers', label: 'Meteor Showers' },
  { id: 'constellations', label: 'Constellations' },
  { id: 'science', label: 'Astronomy Science' },
];

const LEVELS = [
  { id: 'beginner', label: 'Beginner', desc: 'Just getting started, learning the sky' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Own a telescope, know the basics' },
  { id: 'advanced', label: 'Advanced', desc: 'Deep sky hunting, astrophotography' },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [level, setLevel] = useState<string>('');
  const [selectedGear, setSelectedGear] = useState<string[]>([]);
  const [customGear, setCustomGear] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fetch Pie Matrix gear from Shopify
    fetchCollectionProducts('telescopes', 20).then(setProducts);
  }, []);

  const animateTransition = (next: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

  const nextStep = () => animateTransition(step + 1);

  const toggleInterest = (id: string) => {
    setInterests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleGear = (handle: string) => {
    setSelectedGear(prev => prev.includes(handle) ? prev.filter(g => g !== handle) : [...prev, handle]);
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      let uploadedAvatarUrl: string | null = null;

      // Upload avatar if selected
      if (avatarUri && user) {
        try {
          const ext = avatarUri.split('.').pop()?.split('?')[0] ?? 'jpg';
          const fileName = `${user.id}/avatar.${ext}`;
          // Read file as base64 for React Native compatibility
          const response = await fetch(avatarUri);
          const arrayBuffer = await response.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, uint8, { upsert: true, contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}` });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            uploadedAvatarUrl = urlData.publicUrl;
          }
        } catch (uploadErr) {
          // Avatar upload failed — continue without it
          console.warn('Avatar upload failed:', uploadErr);
        }
      }

      // Save profile
      const finalAvatar = uploadedAvatarUrl
        ?? user?.user_metadata?.avatar_url
        ?? user?.user_metadata?.picture
        ?? null;

      if (!user?.id) throw new Error('No user session');

      const { error } = await supabase.from('user_profiles').upsert({
        id: user.id,
        display_name: user.user_metadata?.full_name ?? user.email?.split('@')[0],
        avatar_url: finalAvatar,
        experience_level: level || 'beginner',
        interests,
        gear: selectedGear,
        custom_gear: customGear.trim() ? customGear.split(',').map(g => g.trim()) : [],
        onboarding_complete: true,
      });

      if (error) throw error;
      // Verify the save worked
      onComplete();
    } catch (e: any) {
      console.error('[Onboarding] Save failed:', JSON.stringify(e));
      Alert.alert('Note', (e.message ?? 'Profile save had an issue.') + ' You can update later in Profile.');
      onComplete(); // Don't block them
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <WelcomeStep onNext={nextStep} />;
      case 1: return <PermissionsStep onNext={nextStep} />;
      case 2: return <InterestsStep interests={interests} onToggle={toggleInterest} onNext={nextStep} />;
      case 3: return <LevelStep level={level} onSelect={setLevel} onNext={nextStep} />;
      case 4: return <GearStep products={products} selected={selectedGear} onToggle={toggleGear} customGear={customGear} onCustomChange={setCustomGear} onNext={nextStep} />;
      case 5: return <AvatarStep avatarUri={avatarUri} onPick={pickAvatar} onFinish={handleFinish} saving={saving} />;
      default: return null;
    }
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={['#030308', '#0a0a1a', '#030308']} style={StyleSheet.absoluteFill} />

      {/* Progress dots */}
      {step > 0 && (
        <View style={s.progress}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={[s.dot, i <= step && s.dotActive]} />
          ))}
        </View>
      )}

      {/* Animated content */}
      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {renderStep()}
      </Animated.View>
    </View>
  );
}

// ─── Step Components ─────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={s.stepCenter}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Star1 size={80} color="#d4c5a0" variant="Bulk" />
      </Animated.View>
      <Text style={s.welcomeTitle}>Welcome to Pie Matrix</Text>
      <Text style={s.welcomeSub}>Your personal window to the universe.{'\n'}Let's set up your stargazing profile.</Text>
      <TouchableOpacity style={s.primaryBtn} onPress={onNext}>
        <Text style={s.primaryBtnText}>Get Started</Text>
        <ArrowRight2 size={18} color="#030308" variant="Bold" />
      </TouchableOpacity>
    </View>
  );
}

function PermissionsStep({ onNext }: { onNext: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [done, setDone] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    await requestAllPermissions();
    setRequesting(false);
    setDone(true);
    // Brief beat so the user sees the confirmation, then advance.
    setTimeout(onNext, 500);
  };

  const PERMS = [
    { icon: <Radar size={22} color="#d4c5a0" variant="Bulk" />, title: 'Motion & Location', desc: 'Point your phone at the sky to identify what you see' },
    { icon: <Star1 size={22} color="#d4c5a0" variant="Bulk" />, title: 'Notifications', desc: 'Nightly sky alerts and event reminders' },
    { icon: <Gallery size={22} color="#d4c5a0" variant="Bulk" />, title: 'Photos', desc: 'Set a profile photo (optional)' },
  ];

  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>Enable the experience</Text>
      <Text style={s.stepSub}>Pie Matrix works best with a few permissions. We'll ask once, now.</Text>

      <View style={{ gap: 12, marginTop: 20, flex: 1 }}>
        {PERMS.map((p, i) => (
          <View key={i} style={s.permCard}>
            <View style={s.permIcon}>{p.icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.permTitle}>{p.title}</Text>
              <Text style={s.permDesc}>{p.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={[s.primaryBtn, requesting && s.btnDisabled]} onPress={handleEnable} disabled={requesting || done}>
        <Text style={s.primaryBtnText}>{done ? 'All set' : requesting ? 'Requesting…' : 'Enable & Continue'}</Text>
        {!requesting && !done && <ArrowRight2 size={18} color="#030308" variant="Bold" />}
        {done && <TickCircle size={18} color="#030308" variant="Bold" />}
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} disabled={requesting}>
        <Text style={s.permSkip}>Maybe later</Text>
      </TouchableOpacity>
    </View>
  );
}

function InterestsStep({ interests, onToggle, onNext }: { interests: string[]; onToggle: (id: string) => void; onNext: () => void }) {
  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>What interests you?</Text>
      <Text style={s.stepSub}>Select all that apply — we'll personalize your experience</Text>
      <View style={s.grid}>
        {INTERESTS.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[s.interestChip, interests.includes(item.id) && s.interestChipActive]}
            onPress={() => onToggle(item.id)}
          >
            <Text style={[s.interestLabel, interests.includes(item.id) && s.interestLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={[s.primaryBtn, interests.length === 0 && s.btnDisabled]} onPress={onNext} disabled={interests.length === 0}>
        <Text style={s.primaryBtnText}>Continue</Text>
        <ArrowRight2 size={18} color="#030308" variant="Bold" />
      </TouchableOpacity>
    </View>
  );
}

function LevelStep({ level, onSelect, onNext }: { level: string; onSelect: (l: string) => void; onNext: () => void }) {
  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>Your experience level</Text>
      <Text style={s.stepSub}>This helps us show the right amount of detail</Text>
      <View style={{ gap: 12, marginTop: 20 }}>
        {LEVELS.map(l => (
          <TouchableOpacity
            key={l.id}
            style={[s.levelCard, level === l.id && s.levelCardActive]}
            onPress={() => onSelect(l.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.levelTitle, level === l.id && s.levelTitleActive]}>{l.label}</Text>
              <Text style={s.levelDesc}>{l.desc}</Text>
            </View>
            {level === l.id && <TickCircle size={22} color="#d4c5a0" variant="Bold" />}
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={[s.primaryBtn, !level && s.btnDisabled]} onPress={onNext} disabled={!level}>
        <Text style={s.primaryBtnText}>Continue</Text>
        <ArrowRight2 size={18} color="#030308" variant="Bold" />
      </TouchableOpacity>
    </View>
  );
}

function GearStep({ products, selected, onToggle, customGear, onCustomChange, onNext }: {
  products: Product[]; selected: string[]; onToggle: (h: string) => void;
  customGear: string; onCustomChange: (t: string) => void; onNext: () => void;
}) {
  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>Your gear</Text>
      <Text style={s.stepSub}>Select any Pie Matrix gear you own, or add your own</Text>

      {products.length > 0 && (
        <ScrollView style={s.gearScroll} showsVerticalScrollIndicator={false}>
          {products.map(p => (
            <TouchableOpacity
              key={p.handle}
              style={[s.gearCard, selected.includes(p.handle) && s.gearCardActive]}
              onPress={() => onToggle(p.handle)}
            >
              {p.image && (
                <Image source={{ uri: p.image }} style={s.gearImg} resizeMode="cover" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.gearName} numberOfLines={1}>{p.title}</Text>
                <Text style={s.gearPrice}>{p.price}</Text>
              </View>
              {selected.includes(p.handle) && <TickCircle size={20} color="#d4c5a0" variant="Bold" />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TextInput
        style={s.customInput}
        placeholder="Other gear (comma separated)"
        placeholderTextColor="rgba(255,255,255,0.25)"
        value={customGear}
        onChangeText={onCustomChange}
      />

      <TouchableOpacity style={s.primaryBtn} onPress={onNext}>
        <Text style={s.primaryBtnText}>{selected.length > 0 || customGear ? 'Continue' : 'Skip'}</Text>
        <ArrowRight2 size={18} color="#030308" variant="Bold" />
      </TouchableOpacity>
    </View>
  );
}

function AvatarStep({ avatarUri, onPick, onFinish, saving }: {
  avatarUri: string | null; onPick: () => void; onFinish: () => void; saving: boolean;
}) {
  return (
    <View style={s.stepCenter}>
      <Text style={s.stepTitle}>Profile photo</Text>
      <Text style={s.stepSub}>Add a photo so your stargazing friends can find you</Text>

      <TouchableOpacity style={s.avatarPicker} onPress={onPick}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={s.avatarImg} />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Gallery size={40} color="rgba(255,255,255,0.3)" variant="Bulk" />
            <Text style={s.avatarHint}>Tap to choose</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={[s.primaryBtn, saving && s.btnDisabled]} onPress={onFinish} disabled={saving}>
        <Text style={s.primaryBtnText}>{saving ? 'Setting up…' : avatarUri ? 'Finish' : 'Skip & Finish'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 40 },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 60, paddingBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  dotActive: { backgroundColor: '#d4c5a0', width: 24, borderRadius: 4 },

  // Steps
  step: { flex: 1, paddingTop: 30, justifyContent: 'space-between' },
  stepCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 40 },
  stepTitle: { color: '#fff', fontSize: 24, fontFamily: F_TITLE, marginBottom: 8, textAlign: 'center' },
  stepSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: F_LIGHT, textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  // Welcome
  welcomeTitle: { color: '#fff', fontSize: 28, fontFamily: F_TITLE, marginTop: 24, textAlign: 'center' },
  welcomeSub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontFamily: F_LIGHT, textAlign: 'center', marginTop: 12, lineHeight: 22 },

  // Interests
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  interestChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  interestChipActive: { backgroundColor: 'rgba(212,197,160,0.12)', borderColor: '#d4c5a0' },
  interestLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: F_REG },
  interestLabelActive: { color: '#d4c5a0' },

  // Permissions
  permCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  permIcon: {
    width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(212,197,160,0.1)',
  },
  permTitle: { color: '#fff', fontSize: 16, fontFamily: F_BOLD },
  permDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: F_LIGHT, marginTop: 3, lineHeight: 18 },
  permSkip: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: F_REG, textAlign: 'center', marginBottom: 16 },

  // Level
  levelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 20, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  levelCardActive: { backgroundColor: 'rgba(212,197,160,0.1)', borderColor: '#d4c5a0' },
  levelTitle: { color: '#fff', fontSize: 17, fontFamily: F_BOLD },
  levelTitleActive: { color: '#d4c5a0' },
  levelDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: F_LIGHT, marginTop: 4 },

  // Gear
  gearScroll: { flex: 1, marginBottom: 16 },
  gearCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 14, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  gearCardActive: { backgroundColor: 'rgba(212,197,160,0.1)', borderColor: '#d4c5a0' },
  gearImg: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#111' },
  gearName: { color: '#fff', fontSize: 14, fontFamily: F_REG },
  gearPrice: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 3 },
  customInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16,
    color: '#fff', fontSize: 14, fontFamily: F_REG, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  // Avatar
  avatarPicker: { marginVertical: 30 },
  avatarImg: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: '#d4c5a0' },
  avatarPlaceholder: {
    width: 130, height: 130, borderRadius: 65, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', borderStyle: 'dashed',
  },
  avatarHint: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: F_LIGHT, marginTop: 8 },

  // Buttons
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#d4c5a0', paddingVertical: 18, paddingHorizontal: 32, borderRadius: 16, marginTop: 24, marginBottom: 20,
  },
  primaryBtnText: { color: '#030308', fontSize: 16, fontFamily: F_BOLD },
  btnDisabled: { opacity: 0.4 },
});
