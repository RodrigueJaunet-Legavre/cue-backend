import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://orjhkfdvihuvqcjxhjwe.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yamhrZmR2aWh1dnFjanhoandlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzU2ODEsImV4cCI6MjA5NDAxMTY4MX0.Ti7anM1O3KqbZYLxRkl1rWbcghJF5FgmRxNqOTV6JL0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
