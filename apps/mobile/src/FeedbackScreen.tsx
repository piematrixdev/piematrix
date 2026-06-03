/**
 * FeedbackScreen — Submit feedback stored in Supabase.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Dimensions, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ArrowLeft2, Star1 } from 'iconsax-react-native';
import { supabase } from './auth/supabaseClient';
import { useAuth } from './auth/AuthContext';
import Constants from 'expo-constants';

const { width: W } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'TenorSans_400Regular';

const CATEGORIES = ['General', 'Bug Report', 'Feature Request', 'UI/UX', 'Performance'];

interface Props {
  onClose: () => void;
}

export default function FeedbackScreen({ onClose }: Props) {
  const { user } = useAuth();
  const [category, setCategory] = useState('General');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Required', 'Please enter your feedback message.');
      return;
    }
    if (rating === 0) {
      Alert.alert('Required', 'Please select a rating.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user?.id,
        email: user?.email,
        category: category.toLowerCase().replace(' ', '_'),
        rating,
        message: message.trim(),
        app_version: Constants.expoConfig?.version ?? '0.0.1',
        device_info: `${Platform.OS} ${Platform.Version}`,
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit feedback. Please try again.');
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
          <Text style={s.successSub}>Your feedback helps us make Pie Matrix better.</Text>
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
        <Text style={s.title}>Send Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Category */}
          <Text style={s.label}>Category</Text>
          <View style={s.chipRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[s.chip, category === cat && s.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[s.chipText, category === cat && s.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rating */}
          <Text style={s.label}>Rating</Text>
          <View style={s.starRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} style={s.starBtn}>
                <Star1
                  size={36}
                  color={n <= rating ? '#d4c5a0' : 'rgba(255,255,255,0.15)'}
                  variant={n <= rating ? 'Bold' : 'Linear'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Message */}
          <Text style={s.label}>Your Feedback</Text>
          <TextInput
            style={s.input}
            placeholder="Tell us what you think, report a bug, or suggest a feature..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, submitting && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={s.submitBtnText}>{submitting ? 'Submitting…' : 'Submit Feedback'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 58, paddingHorizontal: 18, paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontFamily: F_TITLE },
  scroll: { flex: 1, paddingHorizontal: 22 },

  label: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_BOLD, letterSpacing: 1, textTransform: 'uppercase', marginTop: 24, marginBottom: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(212,197,160,0.15)', borderColor: '#d4c5a0' },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F_REG },
  chipTextActive: { color: '#d4c5a0' },

  starRow: { flexDirection: 'row', gap: 8 },
  starBtn: { padding: 4 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16,
    color: '#fff', fontSize: 14, fontFamily: F_REG, minHeight: 140,
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
  successSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: F_LIGHT, marginTop: 8, textAlign: 'center' },
  doneBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginTop: 28 },
  doneBtnText: { color: '#fff', fontSize: 15, fontFamily: F_BOLD },
});
