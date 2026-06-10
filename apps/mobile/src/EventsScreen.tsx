/**
 * EventsScreen — Browse upcoming events/activities and RSVP.
 * Shows admin-created events with join/RSVP functionality.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Dimensions, Alert, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft2, Calendar, Location, People, TickCircle } from 'iconsax-react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './auth/supabaseClient';
import { useAuth } from './auth/AuthContext';

const { width: W } = Dimensions.get('window');
const F_LIGHT = 'Poppins-Light';
const F_MEDIUM = 'Poppins-Medium';
const F_SEMIBOLD = 'Poppins-SemiBold';
const F_REG = 'Poppins-Regular';
const F_BOLD = 'Poppins-Bold';
const F_TITLE = 'Poppins-ExtraBold';
const ACCENT = '#d4c5a0';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_event_date: string | null;
  location: string | null;
  location_url: string | null;
  image_url: string | null;
  type: string;
  max_capacity: number | null;
  price: number;
  currency: string;
  is_online: boolean;
}

interface RSVP {
  event_id: string;
  status: string;
  pass_code: string;
}

interface Props {
  onClose: () => void;
}

export default function EventsScreen({ onClose }: Props) {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [rsvps, setRsvps] = useState<Map<string, RSVP>>(new Map());
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch active events (upcoming)
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('active', true)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true });

      if (eventsData) setEvents(eventsData);

      // Fetch user's RSVPs
      if (user?.id) {
        const { data: rsvpData } = await supabase
          .from('event_rsvps')
          .select('event_id, status, pass_code')
          .eq('user_id', user.id)
          .eq('status', 'confirmed');

        if (rsvpData) {
          const map = new Map<string, RSVP>();
          for (const r of rsvpData) map.set(r.event_id, r as RSVP);
          setRsvps(map);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (event: Event) => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to join events.');
      return;
    }

    const existing = rsvps.get(event.id);
    if (existing) {
      // Already RSVP'd — show pass
      showPass(event, existing.pass_code);
      return;
    }

    setRsvpLoading(event.id);
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .insert({ event_id: event.id, user_id: user.id })
        .select('event_id, status, pass_code')
        .single();

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already joined', 'You\'re already registered for this event.');
        } else {
          Alert.alert('Error', error.message);
        }
      } else if (data) {
        const newRsvps = new Map(rsvps);
        newRsvps.set(event.id, data as RSVP);
        setRsvps(newRsvps);
        showPass(event, data.pass_code);
        // Schedule reminder notification 1 hour before event
        scheduleEventNotification(event);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setRsvpLoading(null);
    }
  };

  const showPass = (event: Event, passCode: string) => {
    Alert.alert(
      'You\'re in!',
      `Event: ${event.title}\n\nYour Pass Code:\n${passCode.toUpperCase()}\n\nShow this at the event for entry.`,
      [{ text: 'OK' }]
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Schedule a local notification 1 hour before the event
  const scheduleEventNotification = async (event: Event) => {
    const eventTime = new Date(event.event_date).getTime();
    const reminderTime = eventTime - 60 * 60 * 1000; // 1 hour before
    if (reminderTime <= Date.now()) return; // Already past

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Reminder: ${event.title}`,
          body: event.is_online
            ? 'Starting in 1 hour — get your link ready!'
            : `Starting in 1 hour at ${event.location ?? 'the venue'}. Don't forget your pass!`,
          data: { screen: 'events', eventId: event.id, type: 'event-rsvp-reminder' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminderTime),
        },
      });
    } catch {}
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stargazing: 'Stargazing',
      workshop: 'Workshop',
      webinar: 'Webinar',
      meetup: 'Meetup',
      launch: 'Product Launch',
      observation: 'Observation Night',
      other: 'Event',
    };
    return labels[type] ?? 'Event';
  };

  if (selectedEvent) {
    const rsvp = rsvps.get(selectedEvent.id);
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={s.scroll}>
          {/* Event image */}
          {selectedEvent.image_url && (
            <Image source={{ uri: selectedEvent.image_url }} style={s.detailImage} resizeMode="cover" />
          )}
          <LinearGradient
            colors={['transparent', '#030308']}
            style={s.detailGradient}
          />

          {/* Back button */}
          <TouchableOpacity style={s.backBtn} onPress={() => setSelectedEvent(null)}>
            <ArrowLeft2 size={20} color="#fff" variant="Linear" />
          </TouchableOpacity>

          <View style={s.detailContent}>
            <View style={s.typeBadge}>
              <Text style={s.typeBadgeText}>{getTypeLabel(selectedEvent.type)}</Text>
            </View>
            <Text style={s.detailTitle}>{selectedEvent.title}</Text>

            <View style={s.detailMeta}>
              <View style={s.metaRow}>
                <Calendar size={16} color={ACCENT} variant="Bulk" />
                <Text style={s.metaText}>{formatDate(selectedEvent.event_date)} at {formatTime(selectedEvent.event_date)}</Text>
              </View>
              {selectedEvent.location && (
                <View style={s.metaRow}>
                  <Location size={16} color={ACCENT} variant="Bulk" />
                  <Text style={s.metaText}>{selectedEvent.is_online ? 'Online' : selectedEvent.location}</Text>
                </View>
              )}
              {selectedEvent.max_capacity && (
                <View style={s.metaRow}>
                  <People size={16} color={ACCENT} variant="Bulk" />
                  <Text style={s.metaText}>{selectedEvent.max_capacity} spots</Text>
                </View>
              )}
            </View>

            {selectedEvent.description && (
              <Text style={s.detailDesc}>{selectedEvent.description}</Text>
            )}

            {selectedEvent.price > 0 && (
              <Text style={s.priceText}>{selectedEvent.currency} {selectedEvent.price}</Text>
            )}

            {/* RSVP / Pass */}
            {rsvp ? (
              <View style={s.passCard}>
                <TickCircle size={24} color="#4ade80" variant="Bold" />
                <View style={{ flex: 1 }}>
                  <Text style={s.passTitle}>You're registered!</Text>
                  <Text style={s.passCode}>Pass: {rsvp.pass_code.toUpperCase()}</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={s.rsvpBtn}
                onPress={() => handleRSVP(selectedEvent)}
                disabled={rsvpLoading === selectedEvent.id}
                activeOpacity={0.85}
              >
                {rsvpLoading === selectedEvent.id ? (
                  <ActivityIndicator color="#030308" />
                ) : (
                  <Text style={s.rsvpBtnText}>
                    {selectedEvent.price > 0 ? `Join · ${selectedEvent.currency} ${selectedEvent.price}` : 'Join Event — Free'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.headerBack}>
          <ArrowLeft2 size={20} color="#fff" variant="Linear" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Events</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : events.length === 0 ? (
        <View style={s.center}>
          <Calendar size={48} color="rgba(255,255,255,0.15)" variant="Bulk" />
          <Text style={s.emptyText}>No upcoming events</Text>
          <Text style={s.emptySubtext}>Check back soon for stargazing nights and workshops</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {events.map(event => {
            const isJoined = rsvps.has(event.id);
            return (
              <TouchableOpacity
                key={event.id}
                style={s.eventCard}
                activeOpacity={0.85}
                onPress={() => setSelectedEvent(event)}
              >
                {event.image_url && (
                  <Image source={{ uri: event.image_url }} style={s.cardImage} resizeMode="cover" />
                )}
                <View style={s.cardBody}>
                  <View style={s.cardTop}>
                    <View style={s.cardTypeBadge}>
                      <Text style={s.cardTypeText}>{getTypeLabel(event.type)}</Text>
                    </View>
                    {event.price === 0 && <Text style={s.freeTag}>FREE</Text>}
                  </View>
                  <Text style={s.cardTitle}>{event.title}</Text>
                  <View style={s.cardMeta}>
                    <Text style={s.cardDate}>{formatDate(event.event_date)} · {formatTime(event.event_date)}</Text>
                    {event.location && (
                      <Text style={s.cardLocation}>{event.is_online ? 'Online' : event.location}</Text>
                    )}
                  </View>
                  {isJoined ? (
                    <View style={s.joinedBadge}>
                      <TickCircle size={14} color="#4ade80" variant="Bold" />
                      <Text style={s.joinedText}>Joined</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={s.cardRsvpBtn}
                      onPress={() => handleRSVP(event)}
                      disabled={rsvpLoading === event.id}
                    >
                      <Text style={s.cardRsvpText}>
                        {rsvpLoading === event.id ? '...' : 'RSVP'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030308' },
  scroll: { paddingBottom: 40 },
  list: { padding: 20, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 58, paddingHorizontal: 20, paddingBottom: 16,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: F_TITLE },

  // Empty state
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontFamily: F_TITLE, marginTop: 16 },
  emptySubtext: { color: 'rgba(255,255,255,0.25)', fontSize: 13, fontFamily: F_LIGHT, marginTop: 8, textAlign: 'center' },

  // Event card
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 140 },
  cardBody: { padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTypeBadge: { backgroundColor: 'rgba(212,197,160,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardTypeText: { color: ACCENT, fontSize: 10, fontFamily: F_BOLD, letterSpacing: 0.5 },
  freeTag: { color: '#4ade80', fontSize: 10, fontFamily: F_BOLD, letterSpacing: 1 },
  cardTitle: { color: '#fff', fontSize: 17, fontFamily: F_TITLE, marginBottom: 8 },
  cardMeta: { gap: 4, marginBottom: 12 },
  cardDate: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F_REG },
  cardLocation: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: F_LIGHT },
  cardRsvpBtn: {
    backgroundColor: ACCENT, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  cardRsvpText: { color: '#030308', fontSize: 13, fontFamily: F_BOLD },
  joinedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  joinedText: { color: '#4ade80', fontSize: 12, fontFamily: F_BOLD },

  // Detail view
  detailImage: { width: W, height: 250 },
  detailGradient: { position: 'absolute', top: 150, left: 0, right: 0, height: 100 },
  backBtn: {
    position: 'absolute', top: 58, left: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  detailContent: { padding: 24, paddingTop: 16 },
  typeBadge: { backgroundColor: 'rgba(212,197,160,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
  typeBadgeText: { color: ACCENT, fontSize: 11, fontFamily: F_BOLD, letterSpacing: 0.5 },
  detailTitle: { color: '#fff', fontSize: 26, fontFamily: F_TITLE, marginBottom: 16 },
  detailMeta: { gap: 10, marginBottom: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: F_REG },
  detailDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontFamily: F_LIGHT, lineHeight: 21, marginBottom: 20 },
  priceText: { color: ACCENT, fontSize: 18, fontFamily: F_BOLD, marginBottom: 20 },

  // RSVP button
  rsvpBtn: {
    backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 8,
  },
  rsvpBtnText: { color: '#030308', fontSize: 16, fontFamily: F_BOLD },

  // Pass card
  passCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(74,222,128,0.08)', borderRadius: 14,
    padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
  },
  passTitle: { color: '#4ade80', fontSize: 14, fontFamily: F_BOLD },
  passCode: { color: '#fff', fontSize: 16, fontFamily: F_BOLD, letterSpacing: 2, marginTop: 4 },
});
