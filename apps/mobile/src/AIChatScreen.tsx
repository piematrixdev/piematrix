/**
 * AIChatScreen — Orion, the Pie Matrix AI astronomy assistant.
 * Multi-thread: new chat on open, history sidebar to resume past conversations.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  KeyboardAvoidingView, Platform, Dimensions, Animated, Image, Modal,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { ArrowLeft2, Send2, Star1, ShoppingBag, Eye, Calendar, Clock, Add, MessageText1 } from 'iconsax-react-native';
import { supabase } from './auth/supabaseClient';
import type { Product } from './shopify';

const { width: W } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  actions?: ActionItem[];
  anim: Animated.Value;
}

type ActionItem =
  | { type: 'product'; product: Product }
  | { type: 'navigate'; screen: string; label: string }
  | { type: 'object'; name: string };

interface Props {
  onClose: () => void;
  onNavigate?: (screen: string) => void;
  onProductSelect?: (handle: string) => void;
  onSearchObject?: (target: { name: string; azimuth: number; altitude: number }) => void;
  products?: Product[];
  tonightSummary?: string;
  telescopeSpec?: string;
}

interface ChatThread {
  id: string;
  title: string;
  updated_at: string;
}

const SUGGESTED = [
  "What's visible tonight?",
  "Best telescope for nebulae?",
  "How do I polar align?",
  "Tips for astrophotography",
  "What can kids see with a telescope?",
];

/** Parse **bold** markdown into styled Text nodes. */
function FormattedText({ text, isUser }: { text: string; isUser: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={[s.msgText, isUser && s.userText]}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={[s.boldText, isUser && s.userBold]}>{part.slice(2, -2)}</Text>;
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

/** Compact product card shown inline in chat. */
function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.productCard} activeOpacity={0.8} onPress={onPress}>
      {product.image && <Image source={{ uri: product.image }} style={s.productImg} />}
      <View style={s.productInfo}>
        <Text style={s.productTitle} numberOfLines={2}>{product.title}</Text>
        <Text style={s.productPrice}>{product.currency} {product.price}</Text>
      </View>
      <ShoppingBag size={16} color="#d4c5a0" variant="Bulk" />
    </TouchableOpacity>
  );
}

/** Inline action button (navigate, find object). */
function ActionButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={onPress}>
      {icon}
      <Text style={s.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AIChatScreen({ onClose, onNavigate, onProductSelect, onSearchObject, products = [], tonightSummary, telescopeSpec }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const idCounter = useRef(0);
  const nextId = () => String(++idCounter.current);

  // Thread management
  const [threadId, setThreadId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);

  // Build product catalog string for the system prompt (max 20 products)
  const catalogStr = useRef('');
  useEffect(() => {
    if (products.length) {
      catalogStr.current = products.slice(0, 20).map((p) =>
        `- ${p.title} | ${p.currency} ${p.price} | handle: ${p.handle} | ${p.tags.slice(0, 5).join(', ')}`
      ).join('\n');
    }
  }, [products]);

  // Get user ID on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { userIdRef.current = data.user?.id ?? null; });
  }, []);

  /** Create a new thread in the DB and reset the chat. */
  const startNewChat = useCallback(async () => {
    setMessages([]);
    setThreadId(null);
    setShowHistory(false);
    // Thread is created on first message send (so empty chats don't clutter history)
  }, []);

  /** Load all threads for the history modal. */
  const loadThreads = useCallback(async () => {
    if (!userIdRef.current) return;
    setThreadsLoading(true);
    try {
      const { data } = await supabase
        .from('ai_chat_threads')
        .select('id, title, updated_at')
        .eq('user_id', userIdRef.current)
        .order('updated_at', { ascending: false })
        .limit(30);
      setThreads(data ?? []);
    } catch { /* ignore */ }
    setThreadsLoading(false);
  }, []);

  /** Resume a past thread — load its messages and re-parse actions. */
  const resumeThread = useCallback(async (tid: string) => {
    setShowHistory(false);
    setThreadId(tid);
    setMessages([]);
    try {
      const { data } = await supabase
        .from('ai_chat_messages')
        .select('id, role, text')
        .eq('thread_id', tid)
        .order('created_at', { ascending: true })
        .limit(100);
      if (data && data.length > 0) {
        const loaded: Message[] = data.map((row: any, i: number) => {
          // Re-parse bot messages to restore action cards/buttons
          if (row.role === 'model') {
            const prevUserMsg = data.slice(0, i).reverse().find((m: any) => m.role === 'user');
            const { cleanText, actions } = parseActions(row.text, prevUserMsg?.text ?? '');
            return {
              id: row.id,
              role: row.role as 'model',
              text: cleanText,
              actions: actions.length > 0 ? actions : undefined,
              anim: new Animated.Value(1),
            };
          }
          return {
            id: row.id,
            role: row.role as 'user',
            text: row.text,
            anim: new Animated.Value(1),
          };
        });
        idCounter.current = loaded.length;
        setMessages(loaded);
      }
    } catch { /* ignore */ }
  }, [products]);

  /** Ensure a thread exists (creates one if this is the first message). Non-blocking — if DB fails, returns null and chat still works. */
  const ensureThread = async (firstMsg: string): Promise<string | null> => {
    if (threadId) return threadId;
    if (!userIdRef.current) return null;
    const title = firstMsg.length > 60 ? firstMsg.slice(0, 57) + '…' : firstMsg;
    try {
      const { data } = await supabase
        .from('ai_chat_threads')
        .insert({ user_id: userIdRef.current, title })
        .select('id')
        .single();
      if (data) { setThreadId(data.id); return data.id; }
    } catch { /* table may not exist yet — non-fatal */ }
    return null;
  };

  /** Save a message to the database (fire-and-forget, never throws). */
  const saveMessage = async (tid: string | null, role: 'user' | 'model', text: string) => {
    if (!tid || !userIdRef.current) return;
    try {
      await supabase.from('ai_chat_messages').insert({ thread_id: tid, user_id: userIdRef.current, role, text });
    } catch { /* non-critical — DB may not be set up yet */ }
  };

  /** Parse AI reply for action markers AND smart-match products from keywords. */
  const parseActions = (reply: string, userQuery: string): { cleanText: string; actions: ActionItem[] } => {
    const actions: ActionItem[] = [];
    let cleanText = reply;

    // [PRODUCT:handle] → product card (from AI)
    const productRe = /\[PRODUCT:([^\]]+)\]/g;
    let m;
    while ((m = productRe.exec(reply)) !== null) {
      const handle = m[1].trim().toLowerCase();
      const prod = products.find((p) => p.handle === handle || p.title.toLowerCase().includes(handle));
      if (prod) actions.push({ type: 'product', product: prod });
    }
    cleanText = cleanText.replace(productRe, '').trim();

    // [NAVIGATE:screen:label] → navigation button
    const navRe = /\[NAVIGATE:([^:]+):([^\]]+)\]/g;
    while ((m = navRe.exec(reply)) !== null) {
      // Normalize screen names (AI may use underscores or slight variations)
      let screen = m[1].trim().toLowerCase().replace(/_/g, '');
      if (screen === 'polarscope' || screen === 'polar') screen = 'polarscope';
      if (screen === 'skyview' || screen === 'sky') screen = 'skywatch';
      if (screen === 'skycalendar') screen = 'calendar';
      actions.push({ type: 'navigate', screen, label: m[2].trim() });
    }
    cleanText = cleanText.replace(navRe, '').trim();

    // [OBJECT:name] → find-object button
    const objRe = /\[OBJECT:([^\]]+)\]/g;
    while ((m = objRe.exec(reply)) !== null) {
      actions.push({ type: 'object', name: m[1].trim() });
    }
    cleanText = cleanText.replace(objRe, '').trim();

    // Smart product matching: if the response or query mentions telescope types,
    // attach up to 2 matching product cards even if the AI didn't use markers.
    if (products.length > 0 && !actions.some((a) => a.type === 'product')) {
      const combined = (reply + ' ' + userQuery).toLowerCase();
      const keywords = [
        { terms: ['dobsonian', 'dob', 'deep sky', 'nebula', 'galaxy', 'large aperture'], tags: ['dobsonian'] },
        { terms: ['refractor', 'planet', 'lunar', 'moon', 'sharp', 'beginner'], tags: ['refractor'] },
        { terms: ['reflector', 'newtonian'], tags: ['reflector'] },
        { terms: ['kid', 'child', 'first telescope', 'starter', 'young'], tags: ['kids', 'beginner'] },
        { terms: ['astrophotography', 'photo', 'imaging'], tags: ['astrophotography', 'eq'] },
      ];
      const matchedProducts = new Set<Product>();
      for (const kw of keywords) {
        if (kw.terms.some((t) => combined.includes(t))) {
          for (const p of products) {
            if (matchedProducts.size >= 2) break;
            const pText = (p.title + ' ' + p.tags.join(' ')).toLowerCase();
            if (kw.tags.some((tag) => pText.includes(tag))) {
              matchedProducts.add(p);
            }
          }
        }
      }
      // Fallback: if we talked about telescopes but no specific type matched, show first 2
      if (matchedProducts.size === 0 && /telescope|scope|optic/i.test(combined)) {
        products.slice(0, 2).forEach((p) => matchedProducts.add(p));
      }
      for (const p of matchedProducts) {
        actions.push({ type: 'product', product: p });
      }
    }

    // Smart navigation: detect topics and offer relevant app screens
    const lowerReply = cleanText.toLowerCase();
    const lowerQuery = userQuery.toLowerCase();
    const ctx = lowerReply + ' ' + lowerQuery;

    if (!actions.some((a) => a.type === 'navigate')) {
      // Polar alignment → Polar Scope tool
      if (/polar align|polar scope|polaris.*align|mount align|equatorial align/i.test(ctx)) {
        actions.push({ type: 'navigate', screen: 'polarscope', label: 'Open Polar Scope' });
      }
      // Telescope setup/targets → Telescope profiler
      if (/telescope target|what can i see|magnification|eyepiece|my telescope|scope setup/i.test(ctx)) {
        actions.push({ type: 'navigate', screen: 'telescope', label: 'Telescope Targets' });
      }
      // Events / meteor showers / eclipses → Events screen
      if (/event|meteor shower|eclipse|conjunction|workshop|stargazing night/i.test(ctx)) {
        actions.push({ type: 'navigate', screen: 'events', label: 'View Events' });
      }
      // Calendar / planning / when to observe → Sky Calendar
      if (/calendar|plan|when.*visible|rise.*set|best time|this week|this month/i.test(ctx)) {
        actions.push({ type: 'navigate', screen: 'calendar', label: 'Sky Calendar' });
      }
      // Shop / browse / buy → Shop
      if (/shop|browse|buy|purchase|collection|price/i.test(ctx)) {
        actions.push({ type: 'navigate', screen: 'shop', label: 'Browse Telescopes' });
      }
      // Tonight / visible / observe / find → Sky View (fallback if nothing else matched)
      if (!actions.some((a) => a.type === 'navigate') && /tonight|visible|look at|observe|find|spot|see.*sky/i.test(ctx)) {
        actions.push({ type: 'navigate', screen: 'skywatch', label: 'Open Sky View' });
      }
    }

    return { cleanText, actions };
  };

  const addMessage = (role: 'user' | 'model', text: string, actions?: ActionItem[], tid?: string | null, rawText?: string): Message => {
    const anim = new Animated.Value(0);
    const msg: Message = { id: nextId(), role, text, actions, anim };
    setMessages((prev) => [...prev, msg]);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }).start();
    // Save the raw text (with markers) so history can re-parse actions later
    saveMessage(tid ?? threadId, role, rawText ?? text);
    return msg;
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const trimmed = text.trim();
    setInput('');

    // Create thread (non-blocking — if DB isn't ready, tid is null and that's fine)
    let tid: string | null = null;
    try { tid = await ensureThread(trimmed); } catch { /* ignore */ }
    addMessage('user', trimmed, undefined, tid);
    setLoading(true);

    try {
      const history = [...messages, { id: '', role: 'user' as const, text: trimmed, anim: new Animated.Value(1) }]
        .slice(-16)
        .map((m) => ({ role: m.role, text: m.text }));

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: history,
          context: {
            tonight: tonightSummary,
            telescope: telescopeSpec,
            catalog: catalogStr.current,
          },
        },
      });

      if (error) throw error;
      const rawReply = data?.reply || "I couldn't connect right now. Try again in a moment.";
      const { cleanText, actions } = parseActions(rawReply, trimmed);
      addMessage('model', cleanText, actions.length > 0 ? actions : undefined, tid, rawReply);
    } catch (e: any) {
      console.warn('[AIChatScreen] Error:', e?.message ?? e);
      addMessage('model', "Couldn't reach the stars right now. Check your connection and try again.", undefined, tid);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, tonightSummary, telescopeSpec, products, threadId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages.length]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const translateY = item.anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
    const opacity = item.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.8, 1] });

    return (
      <Animated.View style={[s.bubbleRow, isUser && s.bubbleRowUser, { transform: [{ translateY }], opacity }]}>
        {!isUser && (
          <View style={s.avatar}>
            <Star1 size={14} color="#d4c5a0" variant="Bold" />
          </View>
        )}
        <View style={{ maxWidth: W * 0.78 }}>
          <View style={[s.bubble, isUser ? s.userBubble : s.botBubble]}>
            <FormattedText text={item.text} isUser={isUser} />
          </View>
          {/* Inline actions */}
          {!isUser && item.actions && item.actions.length > 0 && (
            <View style={s.actionsRow}>
              {item.actions.map((action, i) => {
                if (action.type === 'product') {
                  return <ProductCard key={i} product={action.product} onPress={() => onProductSelect?.(action.product.handle)} />;
                }
                if (action.type === 'navigate') {
                  const icon = action.screen === 'skywatch'
                    ? <Eye size={14} color="#d4c5a0" variant="Bulk" />
                    : action.screen === 'calendar'
                    ? <Calendar size={14} color="#d4c5a0" variant="Bulk" />
                    : <Star1 size={14} color="#d4c5a0" variant="Bulk" />;
                  return <ActionButton key={i} icon={icon} label={action.label} onPress={() => onNavigate?.(action.screen)} />;
                }
                if (action.type === 'object') {
                  return (
                    <ActionButton
                      key={i}
                      icon={<Eye size={14} color="#d4c5a0" variant="Bulk" />}
                      label={`Find ${action.name}`}
                      onPress={() => onSearchObject?.({ name: action.name, azimuth: 0, altitude: 45 })}
                    />
                  );
                }
                return null;
              })}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft2 size={24} color="#fff" variant="Linear" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerIcon}><Star1 size={16} color="#d4c5a0" variant="Bold" /></View>
          <View>
            <Text style={s.headerTitle}>Orion</Text>
            <Text style={s.headerSub}>AI Sky Assistant</Text>
          </View>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity onPress={() => { loadThreads(); setShowHistory(true); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Clock size={22} color="rgba(255,255,255,0.6)" variant="Linear" />
          </TouchableOpacity>
          <TouchableOpacity onPress={startNewChat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Add size={24} color="rgba(255,255,255,0.6)" variant="Linear" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat History Modal */}
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={s.historyOverlay}>
          <View style={s.historySheet}>
            <View style={s.historyHead}>
              <Text style={s.historyTitle}>Chat History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <ArrowLeft2 size={22} color="#fff" variant="Linear" style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            </View>
            {threadsLoading ? (
              <ActivityIndicator color="#d4c5a0" style={{ marginTop: 40 }} />
            ) : threads.length === 0 ? (
              <Text style={s.historyEmpty}>No previous conversations yet.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {threads.map((t) => (
                  <TouchableOpacity key={t.id} style={s.historyItem} activeOpacity={0.7} onPress={() => resumeThread(t.id)}>
                    <MessageText1 size={18} color="rgba(212,197,160,0.7)" variant="Linear" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.historyItemTitle} numberOfLines={1}>{t.title}</Text>
                      <Text style={s.historyItemDate}>{new Date(t.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={s.historyNewBtn} onPress={startNewChat}>
              <Add size={18} color="#0b0b14" variant="Bold" />
              <Text style={s.historyNewText}>New Conversation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}><Star1 size={36} color="#d4c5a0" variant="Bold" /></View>
            <Text style={s.emptyTitle}>Ask me anything</Text>
            <Text style={s.emptyText}>Astronomy, telescopes, what to observe tonight, or how to get started.</Text>
            <View style={s.suggestions}>
              {SUGGESTED.map((q) => (
                <TouchableOpacity key={q} style={s.sugBtn} onPress={() => sendMessage(q)} activeOpacity={0.7}>
                  <Text style={s.sugText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />

      {loading && (
        <View style={s.typingRow}>
          <View style={s.typingDots}>
            <View style={s.dot} /><View style={[s.dot, { opacity: 0.6 }]} /><View style={[s.dot, { opacity: 0.3 }]} />
          </View>
          <Text style={s.typingText}>Orion is thinking</Text>
        </View>
      )}

      <View style={s.inputRow}>
        <TextInput
          style={s.textInput}
          placeholder="Ask about the night sky…"
          placeholderTextColor="rgba(255,255,255,0.3)"
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
          <Send2 size={20} color={input.trim() && !loading ? '#0b0b14' : '#555'} variant="Bold" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08080f' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 18, paddingBottom: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(212,197,160,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Poppins-Bold' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Poppins-Regular', marginTop: -1 },
  headerActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  // History modal
  historyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  historySheet: { backgroundColor: '#0c0c18', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, maxHeight: '75%' },
  historyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  historyTitle: { color: '#fff', fontSize: 20, fontFamily: 'Poppins-ExtraBold' },
  historyEmpty: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', marginTop: 40 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  historyItemTitle: { color: '#fff', fontSize: 15, fontFamily: 'Poppins-SemiBold' },
  historyItemDate: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Poppins-Regular', marginTop: 2 },
  historyNewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, backgroundColor: '#d4c5a0', borderRadius: 14, paddingVertical: 14 },
  historyNewText: { color: '#0b0b14', fontSize: 15, fontFamily: 'Poppins-Bold' },
  listContent: { paddingHorizontal: 14, paddingTop: 20, paddingBottom: 8, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-start', gap: 8 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(212,197,160,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  bubble: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  userBubble: { backgroundColor: '#d4c5a0', borderBottomRightRadius: 6 },
  botBubble: { backgroundColor: 'rgba(255,255,255,0.04)', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  msgText: { color: 'rgba(255,255,255,0.88)', fontSize: 14.5, fontFamily: 'Poppins-Regular', lineHeight: 21 },
  userText: { color: '#0b0b14' },
  boldText: { fontFamily: 'Poppins-SemiBold', color: '#d4c5a0' },
  userBold: { color: '#0b0b14', fontFamily: 'Poppins-Bold' },
  // Actions
  actionsRow: { marginTop: 8, gap: 8 },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: 'rgba(212,197,160,0.15)' },
  productImg: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#1a1a2e' },
  productInfo: { flex: 1 },
  productTitle: { color: '#fff', fontSize: 13, fontFamily: 'Poppins-SemiBold', lineHeight: 17 },
  productPrice: { color: '#d4c5a0', fontSize: 12, fontFamily: 'Poppins-Medium', marginTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(212,197,160,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(212,197,160,0.18)', alignSelf: 'flex-start' },
  actionBtnText: { color: '#d4c5a0', fontSize: 13, fontFamily: 'Poppins-SemiBold' },
  // Typing
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 56, paddingVertical: 6 },
  typingDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d4c5a0' },
  typingText: { color: 'rgba(212,197,160,0.7)', fontSize: 12, fontFamily: 'Poppins-Regular' },
  // Input
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: '#08080f' },
  textInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, color: '#fff', fontSize: 15, fontFamily: 'Poppins-Regular', maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#d4c5a0', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  // Empty
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, paddingTop: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(212,197,160,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 20, fontFamily: 'Poppins-Bold', marginBottom: 6 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: 'Poppins-Regular', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  suggestions: { gap: 8, width: '100%' },
  sugBtn: { backgroundColor: 'rgba(212,197,160,0.06)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(212,197,160,0.12)' },
  sugText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: 'Poppins-Regular' },
});
