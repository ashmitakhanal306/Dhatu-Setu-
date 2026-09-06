import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eviextxzpsnuxgvjauek.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_31vyIJFSRalyjBgc69DjKg_44MHXNc3'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Type definitions matching the DB schema ──────────────────────────────────

export type FacilityType = 'Aggregator' | 'Formal Recycler'
export type MaterialCode = 'COPPER' | 'ALUMINUM' | 'EWASTE'

export interface Collector {
  phone: string        // PK
  name: string
  dbt_eligible: boolean
  created_at?: string
}

export interface Facility {
  id: string           // UUID PK
  name: string
  location: string
  type: FacilityType
  pin?: string
  created_at?: string
}

export interface IntakeTransaction {
  id: string           // UUID PK
  collector_phone: string  // FK → collectors.phone
  aggregator_id: string    // FK → facilities.id
  material_code: MaterialCode
  weight_kg: number
  timestamp: string
}

export type DispatchStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export interface Dispatch {
  id: string           // UUID PK
  aggregator_id: string    // FK → facilities.id
  recycler_id: string      // FK → facilities.id
  material_code: MaterialCode
  weight_kg: number
  status?: DispatchStatus
  received_weight_kg?: number | null
  rejection_reason?: string | null
  timestamp: string
}
