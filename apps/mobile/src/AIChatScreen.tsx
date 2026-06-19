/**
 * AIChatScreen — Orion, the Pie Matrix AI astronomy assistant.
 * Powered by Google Gemini via a Supabase Edge Function.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import { ArrowLeft2, Send2, Star1 } from 'iconsax-react-native';
import { supabase } from './auth/supabaseClient';

const { width: W } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface Props {
  onClose: () => void;
  /** Optional "tonight's sky" summary to inject as context. */
  tonightContext?: string;
  /** Optional telescope description for personalized recommendations. */
  telescopeContext?: string;
}

const SUGGESTED = [
  "What's the best thing to see tonight?",
  "How do I find the Orion Nebula?",
  "What telescope do I need to see Saturn's rings?",
  "Tips for my first astrophoto?",
  "Explain Bortle scale simply",
];

export default function AIChatScreen({ onClose, tonightContext, telescopeContext }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const idCounter = useRef(0);

  const nextId = () => String(++idCounter.current);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: nextId(), role: 'user', text: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Build the conversation history for the API (last 20 messages max)
      const history = newMessages.slice(-20).map((m) => ({ role: m.role, text: m.text }));

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: history,
          context: {
            tonight: tonightContext,
            telescope: telescopeContext,
          },
        },
      });

      if (error) throw error;
      const reply = data?.reply || "I'm having trouble connecting right now. Try again in a moment! 🌙";
      const botMsg: Message = { id: nextId(), role: 'model', text: reply };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      console.warn('[AIChatScreen] Error:', e?.message ?? e);
      const errMsg: Message = {
        id: nextId(),
        role: 'model',
        text: "Sorry, I couldn't reach the stars right now. Check your connection and try again. ⭐",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, tonightContext, telescopeContext]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[s.bubble, isUser ? s.userBubble : s.botBubble]}>
        {!isUser && <Text style={s.botName}>Orion ⭐</Text>}
        <Text style={[s.msgText, isUser && s.userText]}>{item.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft2 size={24} color="#fff" variant="Linear" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Star1 size={18} color="#d4c5a0" variant="Bold" />
          <Text style={s.headerTitle}>Orion</Text>
          <Text style={s.headerSub}>AI Sky Assistant</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.empty}>
            <Star1 size={48} color="#d4c5a0" variant="Bold" />
            <Text style={s.emptyTitle}>Hey! I'm Orion 👋</Text>
            <Text style={s.emptyText}>
              Your personal astronomy assistant. Ask me about the night sky, telescopes, what to observe tonight, or anything space-related.
            </Text>
            <View style={s.suggestions}>
              {SUGGESTED.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={s.sugBtn}
                  onPress={() => sendMessage(q)}
                  activeOpacity={0.7}
                >
                  <Text style={s.sugText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />

      {/* Typing indicator */}
      {loading && (
        <View style={s.typingRow}>
          <ActivityIndicator size="small" color="#d4c5a0" />
          <Text style={s.typingText}>Orion is thinking…</Text>
        </View>
      )}

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.textInput}
          placeholder="Ask about the night sky…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
          blurOnSubmit
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Send2 size={22} color={input.trim() && !loading ? '#0b0b14' : '#555'} variant="Bold" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b14' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: 'Poppins-ExtraBold' },
  headerSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontFamily: 'Poppins-Regular' },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexGrow: 1 },
  bubble: { maxWidth: W * 0.82, marginBottom: 12, borderRadius: 18, padding: 14 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#d4c5a0', borderBottomRightRadius: 4 },
  botBubble: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  botName: { color: '#d4c5a0', fontSize: 11, fontFamily: 'Poppins-Bold', marginBottom: 4 },
  msgText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontFamily: 'Poppins-Regular', lineHeight: 22 },
  userText: { color: '#0b0b14' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  typingText: { color: 'rgba(212,197,160,0.8)', fontSize: 13, fontFamily: 'Poppins-Regular' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0b0b14' },
  textInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, color: '#fff', fontSize: 15, fontFamily: 'Poppins-Regular', maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#d4c5a0', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, paddingTop: 60 },
  emptyTitle: { color: '#fff', fontSize: 22, fontFamily: 'Poppins-ExtraBold', marginTop: 16, marginBottom: 8 },
  emptyText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  suggestions: { gap: 8, width: '100%' },
  sugBtn: { backgroundColor: 'rgba(212,197,160,0.08)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(212,197,160,0.18)' },
  sugText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Poppins-Regular' },
});
