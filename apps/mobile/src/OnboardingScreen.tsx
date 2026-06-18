/**
 * OnboardingScreen — Multi-step welcome flow.
 * Includes sign-up (Name, Email, Phone, Password), then collects
 * interests, experience level, gear, and profile photo.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Image,
  ScrollView, Animated, Easing, TextInput, Alert, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import {
  Star1, Moon, Sun1, Global, Camera, Telescope, Magicpen,
  Radar, Eye, ArrowRight2, TickCircle, Gallery, Call, Sms,
} from 'iconsax-react-native';
import { useAuth } from './auth/AuthContext';
import { useContent } from './content/ContentContext';
import { supabase } from './auth/supabaseClient';
import { fetchCollectionProducts, Product } from './shopify';
import { requestAllPermissions } from './permissions';

WebBrowser.maybeCompleteAuthSession();

const { width: W, height: H } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // If user is already signed in (e.g. social auth or returning),
  // skip the sign-up step and go straight to permissions.
  const isSignedIn = !!user;

  useEffect(() => {
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

  const handleFinish = async () => {
    setSaving(true);
    try {
      // If no user session (email confirmation pending), go to confirmation screen
      if (!user?.id) {
        setSaving(false);
        animateTransition(6); // Show confirmation step
        return;
      }

      const finalAvatar = user?.user_metadata?.avatar_url
        ?? user?.user_metadata?.picture
        ?? null;

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
      onComplete();
    } catch (e: any) {
      console.error('[Onboarding] Save failed:', JSON.stringify(e));
      Alert.alert('Note', (e.message ?? 'Profile save had an issue.') + ' You can update later in Profile.');
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  // Steps: 0=Welcome, 1=SignUp, 2=Permissions, 3=Interests, 4=Level, 5=Gear, 6=Confirmation
  // If already signed in, skip step 1 (sign-up) and step 6 (confirmation)
  const renderStep = () => {
    switch (step) {
      case 0: return <WelcomeStep onNext={nextStep} />;
      case 1:
        // If already signed in, skip to permissions
        if (isSignedIn) { nextStep(); return null; }
        return <SignUpStep onNext={nextStep} />;
      case 2: return <PermissionsStep onNext={nextStep} />;
      case 3: return <InterestsStep interests={interests} onToggle={toggleInterest} onNext={nextStep} />;
      case 4: return <LevelStep level={level} onSelect={setLevel} onNext={nextStep} />;
      case 5: return <GearStep products={products} selected={selectedGear} onToggle={toggleGear} customGear={customGear} onCustomChange={setCustomGear} onNext={() => { handleFinish(); }} />;
      case 6:
        // If already signed in, no confirmation needed — finish
        if (isSignedIn) { onComplete(); return null; }
        return <ConfirmEmailStep onDone={onComplete} />;
      default: return null;
    }
  };

  const totalSteps = isSignedIn ? 5 : 6;
  const displayStep = isSignedIn ? Math.max(0, step - 1) : step;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#030308', '#0a0a1a', '#030308']} style={StyleSheet.absoluteFill} />

      {/* Progress dots */}
      {step > 0 && (
        <View style={s.progress}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View key={i} style={[s.dot, i < displayStep && s.dotActive]} />
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
        <Image source={require('../assets/pie-logo.png')} style={s.welcomeLogo} />
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

function SignUpStep({ onNext }: { onNext: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const handleSignUp = async () => {
    if (!fullName.trim()) { Alert.alert('Name required', 'Please enter your full name.'); return; }
    if (!email.trim()) { Alert.alert('Email required', 'Please enter your email address.'); return; }
    if (!password || password.length < 6) { Alert.alert('Password too short', 'Password must be at least 6 characters.'); return; }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
          },
        },
      });
      if (error) {
        Alert.alert('Sign up failed', error.message);
      } else {
        // Account created. If email confirmation is required, Supabase won't
        // emit SIGNED_IN until confirmed. But we still advance — the session
        // will activate once they confirm, and onboarding profile save handles
        // the no-session case gracefully.
        onNext();
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) { Alert.alert('Missing fields', 'Please enter email and password.'); return; }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        Alert.alert('Sign in failed', error.message);
      } else {
        onNext();
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) Alert.alert('Sign in failed', error.message);
        else onNext();
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'com.thepiematrix.app',
        path: 'auth/callback',
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) { Alert.alert('Error', error.message); return; }
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          const url = result.url;
          let accessToken: string | null = null;
          let refreshToken: string | null = null;
          const hashIdx = url.indexOf('#');
          if (hashIdx !== -1) {
            const params = new URLSearchParams(url.substring(hashIdx + 1));
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          }
          if (!accessToken) {
            const qIdx = url.indexOf('?');
            if (qIdx !== -1) {
              const params = new URLSearchParams(url.substring(qIdx + 1));
              accessToken = params.get('access_token');
              refreshToken = params.get('refresh_token');
            }
          }
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            onNext();
          }
        }
      }
    } catch {
      Alert.alert('Error', 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.step}>
          <Text style={s.stepTitle}>{showSignIn ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={s.stepSub}>
            {showSignIn
              ? 'Sign in to continue your stargazing journey'
              : 'Join the Pie Matrix stargazing community'}
          </Text>

          <View style={s.signUpForm}>
            {!showSignIn && (
              <View style={s.inputRow}>
                <View style={s.inputIcon}>
                  <Star1 size={18} color="rgba(212,197,160,0.6)" variant="Bulk" />
                </View>
                <TextInput
                  style={s.signUpInput}
                  placeholder="Full Name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            )}

            <View style={s.inputRow}>
              <View style={s.inputIcon}>
                <Sms size={18} color="rgba(212,197,160,0.6)" variant="Bulk" />
              </View>
              <TextInput
                style={s.signUpInput}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {!showSignIn && (
              <View style={s.inputRow}>
                <View style={s.inputIcon}>
                  <Call size={18} color="rgba(212,197,160,0.6)" variant="Bulk" />
                </View>
                <TextInput
                  style={s.signUpInput}
                  placeholder="Phone (optional)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            <View style={s.inputRow}>
              <View style={s.inputIcon}>
                <Eye size={18} color="rgba(212,197,160,0.6)" variant="Bulk" />
              </View>
              <TextInput
                style={s.signUpInput}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, loading && s.btnDisabled]}
              onPress={showSignIn ? handleSignIn : handleSignUp}
              disabled={loading}
            >
              <Text style={s.primaryBtnText}>
                {loading ? 'Please wait…' : showSignIn ? 'Sign In' : 'Create Account'}
              </Text>
              {!loading && <ArrowRight2 size={18} color="#030308" variant="Bold" />}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowSignIn(!showSignIn)} style={{ marginTop: 12 }}>
              <Text style={s.switchAuthText}>
                {showSignIn ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Social sign-in divider */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or continue with</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Social buttons */}
          <View style={s.socialRow}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={s.socialBtn} onPress={handleAppleSignIn} disabled={loading}>
                <Text style={s.socialBtnIcon}>&#xF8FF;</Text>
                <Text style={s.socialBtnText}>Apple</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.socialBtn} onPress={handleGoogleSignIn} disabled={loading}>
              <Text style={[s.socialBtnIcon, { color: '#4285F4' }]}>G</Text>
              <Text style={s.socialBtnText}>Google</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PermissionsStep({ onNext }: { onNext: () => void }) {
  const { t } = useContent();
  const [requesting, setRequesting] = useState(false);
  const [done, setDone] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    await requestAllPermissions();
    setRequesting(false);
    setDone(true);
    setTimeout(onNext, 500);
  };

  const PERMS = [
    { icon: <Radar size={22} color="#d4c5a0" variant="Bulk" />, title: t('onboarding.perm.motion_title', 'Motion & Location'), desc: t('onboarding.perm.motion_desc', 'Point your phone at the sky to identify what you see') },
    { icon: <Star1 size={22} color="#d4c5a0" variant="Bulk" />, title: t('onboarding.perm.notif_title', 'Notifications'), desc: t('onboarding.perm.notif_desc', 'Nightly sky alerts and event reminders') },
    { icon: <Gallery size={22} color="#d4c5a0" variant="Bulk" />, title: t('onboarding.perm.photos_title', 'Photos'), desc: t('onboarding.perm.photos_desc', 'Set a profile photo (optional)') },
  ];

  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>{t('onboarding.perm.title', 'Set up your experience')}</Text>
      <Text style={s.stepSub}>{t('onboarding.perm.subtitle', "To bring the night sky to life, Pie Matrix can use a few device features. You're always in control — choose what feels right for you.")}</Text>

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
        <Text style={s.primaryBtnText}>{done ? t('onboarding.perm.cta_done', 'All set') : requesting ? t('onboarding.perm.cta_busy', 'Requesting…') : t('onboarding.perm.cta', 'Continue')}</Text>
        {!requesting && !done && <ArrowRight2 size={18} color="#030308" variant="Bold" />}
        {done && <TickCircle size={18} color="#030308" variant="Bold" />}
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

function ConfirmEmailStep({ onDone }: { onDone: () => void }) {
  const handleConfirmed = async () => {
    // Try to refresh the session — if email was confirmed, this will pick up the session
    const { supabase } = require('./auth/supabaseClient');
    const { data } = await supabase.auth.getSession();
    // Whether session exists or not, proceed — AuthGate will route correctly
    onDone();
  };

  return (
    <View style={s.stepCenter}>
      <View style={s.confirmIcon}>
        <Sms size={48} color="#d4c5a0" variant="Bulk" />
      </View>
      <Text style={s.stepTitle}>Check your email</Text>
      <Text style={s.stepSub}>
        We've sent a confirmation link to your email address.{'\n\n'}
        Tap the link in the email to verify your account, then come back here to start exploring the sky.
      </Text>
      <View style={s.confirmBanner}>
        <Text style={s.confirmBannerText}>
          📧  Didn't get it? Check your spam folder or try signing up again.
        </Text>
      </View>
      <TouchableOpacity style={s.primaryBtn} onPress={handleConfirmed}>
        <Text style={s.primaryBtnText}>I've confirmed my email</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDone}>
        <Text style={s.permSkip}>Skip for now</Text>
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
  stepTitle: { color: '#fff', fontSize: 24, fontFamily: 'Poppins-Black', marginBottom: 8, textAlign: 'center' },
  stepSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: F_REG, textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  // Welcome
  welcomeLogo: { width: 90, height: 90, borderRadius: 22, backgroundColor: '#fff', padding: 12, resizeMode: 'contain' } as any,
  welcomeTitle: { color: '#fff', fontSize: 28, fontFamily: 'Poppins-Black', marginTop: 24, textAlign: 'center' },
  welcomeSub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontFamily: F_LIGHT, textAlign: 'center', marginTop: 12, lineHeight: 22 },

  // Sign-up form
  signUpForm: { marginBottom: 20 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  signUpInput: {
    flex: 1, paddingVertical: 16, color: '#fff', fontSize: 15, fontFamily: F_REG,
  },
  switchAuthText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: F_REG, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: F_LIGHT, marginHorizontal: 14 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  socialBtnIcon: { fontSize: 18, fontWeight: '700', color: '#fff' },
  socialBtnText: { color: '#fff', fontSize: 14, fontFamily: F_BOLD },
  termsText: {
    color: 'rgba(255,255,255,0.2)', fontSize: 11, fontFamily: F_LIGHT,
    textAlign: 'center', lineHeight: 17, marginTop: 8,
  },

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
  permTitle: { color: '#fff', fontSize: 16, fontFamily: F_SEMIBOLD },
  permDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: F_LIGHT, marginTop: 3, lineHeight: 18 },
  permSkip: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: F_REG, textAlign: 'center', marginBottom: 16 },

  // Level
  levelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 20, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  levelCardActive: { backgroundColor: 'rgba(212,197,160,0.1)', borderColor: '#d4c5a0' },
  levelTitle: { color: '#fff', fontSize: 17, fontFamily: F_SEMIBOLD },
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

  // Buttons
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#d4c5a0', paddingVertical: 18, paddingHorizontal: 32, borderRadius: 16, marginTop: 24, marginBottom: 20,
  },
  primaryBtnText: { color: '#030308', fontSize: 16, fontFamily: F_BOLD },
  btnDisabled: { opacity: 0.4 },

  // Confirm email
  confirmIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(212,197,160,0.1)', justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  confirmBanner: {
    backgroundColor: 'rgba(212,197,160,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(212,197,160,0.2)',
    padding: 16, marginTop: 20, width: '100%',
  },
  confirmBannerText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: F_REG, lineHeight: 19, textAlign: 'center' },
});
