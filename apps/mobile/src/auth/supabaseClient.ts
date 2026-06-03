/**
 * Supabase client configured for React Native with persistent auth sessions.
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://gmsylfwpftqdlzoboqqr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdtc3lsZndwZnRxZGx6b2JvcXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjc2NzgsImV4cCI6MjA4NjQwMzY3OH0.xlvx75WroRG-oEhmHhoQJEWiemJ2c_xX4uOprHJm288';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // not needed for React Native
  },
});
