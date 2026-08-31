import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://brvffbgwrvyortjkgkrt.supabase.co'
const supabaseAnonKey = 'sb_publishable__kW0M_gvIng1eXP8J1Dhnw_7kvkUizv'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)