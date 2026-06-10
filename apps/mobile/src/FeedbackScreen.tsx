/**
 * FeedbackScreen — Combined Support & Feedback screen.
 * Tab-based: Feedback (rating + message) or Support (issue form).
 * User info (name, email, phone) is pre-filled from auth.
 * Categories and purchase sources are fetched from backend (editable from admin).
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Dimensions, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ArrowLeft2, Star1, MessageText1, Call } from 'iconsax-react-native';
import { supabase } from './auth/supabaseClient';
import { useAuth } from './auth/AuthContext';
import Constants from 'expo-constants';

const { width: W } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';

// Fallback categories if backend fetch fails
const DEFAULT_FEEDBACK_CATEGORIES = ['General', 'Bug Report', 'Feature Request', 'UI/UX', 'Performance'];
const DEFAULT_SUPPORT_CATEGORIES = ['General', 'Telescope', 'Binoculars', 'Delivery', 'Purchase', 'Demo'];
const DEFAULT_PURCHASE_SOURCES = ['Amazon', 'Website', 'Flipkart', 'Other'];

interface Props {
  onClose: () => void;
}

export default function FeedbackScreen({ onClose }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'feedback' | 'support'>('feedback');

  // User info (pre-filled)
  const [name, setName] = useState(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.user_metadata?.phone ?? '');

  // Backend-editable categories
  const [feedbackCategories, setFeedbackCategories] = useState<string[]>(DEFAULT_FEEDBACK_CATEGORIES);
  const [supportCategories, setSupportCategories] = useState<string[]>(DEFAULT_SUPPORT_CATEGORIES);
  const [purchaseSources, setPurchaseSources] = useState<string[]>(DEFAULT_PURCHASE_SOURCES);

  // Feedback state
  const [feedCategory, setFeedCategory] = useState('General');
  const [rating, setRating] = useState(0);
  const [feedMessage, setFeedMessage] = useState('');

  // Support state
  const [supCategory, setSupCategory] = useState('General');
  const [purchaseSource, setPurchaseSource] = useState('');
  const [supMessage, setSupMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fetch phone from profile if not in metadata
  useEffect(() => {
    if (!phone && user?.id) {
      supabase.from('user_profiles').select('phone').eq('id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.phone) setPhone(data.phone); });
    }
  }, [user?.id]);

  // Fetch configurable options from backend
  useEffect(() => {
    supabase.from('support_config').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        if (data.feedback_categories?.length) setFeedbackCategories(data.feedback_categories);
        if (data.support_categories?.length) setSupportCategories(data.support_categories);
        if (data.purchase_sources?.length) setPurchaseSources(data.purchase_sources);
      }
    }).catch(() => {});
  }, []);

  const handleSubmitFeedback = async () => {
    if (!feedMessage.trim()) { Alert.alert('Required', 'Please enter your feedback message.'); return; }
    if (rating === 0) { Alert.alert('Required', 'Please select a rating.'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user?.id,
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim() || null,
        category: feedCategory.toLowerCase().replace(/ /g, '_'),
        rating,
        message: feedMessage.trim(),
        type: 'feedback',
        app_version: Constants.expoConfig?.version ?? '0.0.1',
        device_info: `${Platform.OS} ${Platform.Version}`,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSupport = async () => {
    if (!supMessage.trim()) { Alert.alert('Required', 'Please describe your issue.'); return; }
    if (!email.trim()) { Alert.alert('Required', 'Email is needed so we can get back to you.'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user?.id,
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim() || null,
        category: supCategory.toLowerCase().replace(/ /g, '_'),
        message: supMessage.trim(),
        type: 'support',
        purchase_source: purchaseSource || null,
        app_version: Constants.expoConfig?.version ?? '0.0.1',
        device_info: `${Platform.OS} ${Platform.Version}`,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={s.root}>
        <View style={s.successWrap}>
          <Star1 size={56} color="#d4c5a0" variant="Bulk" />
          <Text style={s.successTitle}>Thank you!</Text>
          <Text style={s.successSub}>
            {tab === 'feedback'
              ? 'Your feedback helps us make Pie Matrix better.'
              : "We've received your request. We'll get back to you soon."}
          </Text>
          <TouchableOpacity style={s.doneBtn} onPress={onClose}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <ArrowLeft2 size={22} color="#fff" variant="Linear" />
        </TouchableOpacity>
        <Text style={s.title}>Support & Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, tab === 'feedback' && s.tabActive]}
          onPress={() => setTab('feedback')}
        >
          <MessageText1 size={16} color={tab === 'feedback' ? '#d4c5a0' : 'rgba(255,255,255,0.4)'} variant="Bulk" />
          <Text style={[s.tabText, tab === 'feedback' && s.tabTextActive]}>Feedback</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'support' && s.tabActive]}
          onPress={() => setTab('support')}
        >
          <Call size={16} color={tab === 'support' ? '#d4c5a0' : 'rgba(255,255,255,0.4)'} variant="Bulk" />
          <Text style={[s.tabText, tab === 'support' && s.tabTextActive]}>Support</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Pre-filled user info */}
          <Text style={s.label}>Your Info</Text>
          <TextInput style={s.input} placeholder="Name" placeholderTextColor="rgba(255,255,255,0.25)" value={name} onChangeText={setName} />
          <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Email" placeholderTextColor="rgba(255,255,255,0.25)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Phone" placeholderTextColor="rgba(255,255,255,0.25)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          {tab === 'feedback' ? (
            <>
              {/* Category */}
              <Text style={s.label}>Category</Text>
              <View style={s.chipRow}>
                {feedbackCategories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.chip, feedCategory === cat && s.chipActive]}
                    onPress={() => setFeedCategory(cat)}
                  >
                    <Text style={[s.chipText, feedCategory === cat && s.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Rating */}
              <Text style={s.label}>Rating</Text>
              <View style={s.starRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setRating(n)} style={s.starBtn}>
                    <Star1 size={36} color={n <= rating ? '#d4c5a0' : 'rgba(255,255,255,0.15)'} variant={n <= rating ? 'Bold' : 'Linear'} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Message */}
              <Text style={s.label}>Your Feedback</Text>
              <TextInput
                style={s.textArea}
                placeholder="Tell us what you think, report a bug, or suggest a feature..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline numberOfLines={5} textAlignVertical="top"
                value={feedMessage} onChangeText={setFeedMessage}
              />

              <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleSubmitFeedback} disabled={submitting}>
                <Text style={s.submitBtnText}>{submitting ? 'Submitting…' : 'Submit Feedback'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Support Category */}
              <Text style={s.label}>Issue Category</Text>
              <View style={s.chipRow}>
                {supportCategories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.chip, supCategory === cat && s.chipActive]}
                    onPress={() => setSupCategory(cat)}
                  >
                    <Text style={[s.chipText, supCategory === cat && s.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Purchase Source */}
              <Text style={s.label}>Source of Purchase</Text>
              <View style={s.chipRow}>
                {purchaseSources.map(src => (
                  <TouchableOpacity
                    key={src}
                    style={[s.chip, purchaseSource === src && s.chipActive]}
                    onPress={() => setPurchaseSource(prev => prev === src ? '' : src)}
                  >
                    <Text style={[s.chipText, purchaseSource === src && s.chipTextActive]}>{src}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Message */}
              <Text style={s.label}>Describe your issue</Text>
              <TextInput
                style={s.textArea}
                placeholder="What do you need help with? Include order number if relevant..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline numberOfLines={5} textAlignVertical="top"
                value={supMessage} onChangeText={setSupMessage}
              />

              <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleSubmitSupport} disabled={submitting}>
                <Text style={s.submitBtnText}>{submitting ? 'Submitting…' : 'Submit Support Request'}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 58, paddingHorizontal: 18, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontFamily: F_TITLE },

  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: 22, marginBottom: 8, gap: 8 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: { backgroundColor: 'rgba(212,197,160,0.1)', borderColor: 'rgba(212,197,160,0.3)' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: F_MEDIUM },
  tabTextActive: { color: '#d4c5a0', fontFamily: F_SEMIBOLD },

  scroll: { flex: 1, paddingHorizontal: 22 },

  label: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: F_SEMIBOLD, letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 14, fontFamily: F_REG,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(212,197,160,0.15)', borderColor: '#d4c5a0' },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F_REG },
  chipTextActive: { color: '#d4c5a0' },

  starRow: { flexDirection: 'row', gap: 8 },
  starBtn: { padding: 4 },

  textArea: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16,
    color: '#fff', fontSize: 14, fontFamily: F_REG, minHeight: 120,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  submitBtn: {
    backgroundColor: '#d4c5a0', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#030308', fontSize: 15, fontFamily: F_BOLD },

  // Success state
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  successTitle: { color: '#fff', fontSize: 24, fontFamily: F_TITLE, marginTop: 20 },
  successSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: F_REG, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  doneBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginTop: 28 },
  doneBtnText: { color: '#fff', fontSize: 15, fontFamily: F_BOLD },
});
