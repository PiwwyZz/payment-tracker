// 🔗 Supabase Config
const SUPABASE_URL = 'https://nfmvibhspqivbnahcalh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mbXZpYmhzcHFpdmJuYWhjYWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTA3NTgsImV4cCI6MjA5MzA2Njc1OH0.pfO0RSeAeT2cxKIuRp22L46ZWU1-trM3SiBI1h3JmK0';

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
