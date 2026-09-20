export type PharmacyCategory = 'pharmacy' | 'night_pharmacy'
export type DutyStatus = 'unverified' | 'confirmed'

export interface DutyPeriod {
  starts_at: string
  ends_at: string
  source_url: string
  source_name?: string
  verified_at?: string
  precision?: 'day' | 'time'
}

export interface Pharmacy {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  city: string
  full_address: string
  neighborhood?: string | null
  borough?: string | null
  phone?: string | null
  photo_url?: string | null
  photo_credit?: string | null
  place_source_url?: string | null
  place_verified_at?: string | null
  opening_hours?: { daily_start: string; daily_end: string; source_url: string } | null
  data_origin?: 'osm' | 'provided' | 'dpm' | 'google_maps'
  category: PharmacyCategory
  duty_status: DutyStatus
  duty_periods: DutyPeriod[]
  source_url: string
}

export interface SearchFilters {
  query: string
  category: 'all' | PharmacyCategory | 'on_duty'
  availability?: 'all' | 'open' | 'closed' | 'unknown'
  neighborhood?: string
  borough?: string
}
