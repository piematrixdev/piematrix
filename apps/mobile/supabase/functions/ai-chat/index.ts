// Supabase Edge Function: ai-chat
// Proxies chat messages to Google Gemini 2.5 Flash with Pie Matrix brand context.
// Deploy: supabase functions deploy ai-chat
// Secret: supabase secrets set GEMINI_API_KEY=your_key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are **Orion**, the AI assistant inside the **Pie Matrix** app — a mobile planetarium and telescope shop.

## Rules
- Keep answers SHORT: 2-3 sentences per point, max 4 short paragraphs total
- NO emojis. Never use emoji characters.
- Use **bold** for emphasis on product names or key terms (the app renders it)
- Be warm and knowledgeable but concise — like a helpful friend at a star party
- Pie Matrix sells ONLY telescopes (reflectors, refractors, Dobsonians, catadioptrics, kids' scopes). No eyepieces, mounts, cameras, or accessories sold separately — they come bundled with the scopes.

## What you do
- Answer astronomy questions: constellations, planets, nebulae, observing tips, astrophotography basics, polar alignment, Bortle scale
- Recommend Pie Matrix telescopes when relevant: suggest aperture/type based on what the user wants to see
- Guide users to app features naturally (the app auto-detects keywords and shows navigation buttons):
  - Polar alignment questions → the app shows "Open Polar Scope" button
  - Telescope targets / what can I see → "Telescope Targets" button
  - Events, meteor showers → "View Events" button  
  - Planning, when to observe → "Sky Calendar" button
  - Shopping → "Browse Telescopes" button
  - Tonight's sky, finding objects → "Open Sky View" button
- You don't need to say "tap the button" — just answer naturally and the app handles navigation

## Tone
- Speak directly. No filler phrases like "Oh, what a fantastic question!"
- Start with the answer, not pleasantries
- If recommending a telescope, state the type and why it fits their need in one line

## Interactive actions
When relevant, append action markers at the END of your response (after the text). The app renders these as tappable buttons/cards:
- To suggest a telescope: [PRODUCT:handle] (use the exact handle from the catalog below)
- To suggest opening the sky view: [NAVIGATE:skywatch:Open Sky View]
- To suggest the calendar: [NAVIGATE:calendar:View Sky Calendar]
- To suggest finding a specific object: [OBJECT:name] (e.g. [OBJECT:M42] or [OBJECT:Jupiter])

Only include actions when genuinely relevant. Don't force them into every response.

## Don't
- Make up product names or prices
- Use emojis
- Say "use the Pie Matrix app" — the user is already in it; use action markers instead
- Give medical, legal, or financial advice
- Discuss competitors`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, context } = await req.json();
    // messages: Array<{ role: 'user' | 'model', text: string }>
    // context: optional { tonight?: string, telescope?: string }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build Gemini contents array with system instruction
    let systemText = SYSTEM_PROMPT;
    if (context?.tonight) {
      systemText += `\n\n## Tonight's sky (user's location)\n${context.tonight}`;
    }
    if (context?.telescope) {
      systemText += `\n\n## User's telescope\n${context.telescope}`;
    }
    if (context?.catalog) {
      systemText += `\n\n## Product catalog (Pie Matrix telescopes — use exact handles for [PRODUCT:] markers)\n${context.catalog}`;
    }

    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const body = {
      system_instruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 1200,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    };

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);
      return new Response(JSON.stringify({ error: 'AI service error', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-chat error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
