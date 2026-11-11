import { createClient } from '@supabase/supabase-js';

// Supabase project used by the application. The anon key is a public key
// (it only grants what the Row Level Security policies allow), so it can ship
// with the front-end. Both values can be overridden with a `.env` file:
//   VITE_SUPABASE_URL=...
//   VITE_SUPABASE_ANON_KEY=...
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://bgmysnsdytrkjomuuqmr.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbXlzbnNkeXRya2pvbXV1cW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0MDc2NzcsImV4cCI6MjEwOTk4MzY3N30.IMjaLVnGF7y8lev9Cv4fox3pywqvkXcN2ne4oXt8vS8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'altech-auth' },
});

// Storage buckets (created by supabase/schema.sql)
export const PRODUCT_IMAGES_BUCKET = 'product-images';
export const STORE_ASSETS_BUCKET = 'store-assets';
