'use client'

/**
 * useGeolocation Hook
 *
 * Provides user location data for localized web search results.
 * Uses multiple strategies to determine location:
 * 1. Browser Geolocation API (with user permission)
 * 2. Timezone-based inference (fallback)
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#localization
 *
 * @module hooks/useGeolocation
 */

import { useState, useEffect, useCallback } from 'react'
import type { WebSearchUserLocation } from '@/types'

/**
 * Extended location data with coordinates for future enhancements
 */
export type GeolocationData = WebSearchUserLocation & {
  /** Latitude coordinate (if available from Geolocation API) */
  latitude?: number
  /** Longitude coordinate (if available from Geolocation API) */
  longitude?: number
  /** Source of the location data */
  source: 'geolocation' | 'timezone' | 'unknown'
  /** Whether location data is still loading */
  isLoading: boolean
  /** Error message if geolocation failed */
  error?: string
}

/**
 * Comprehensive timezone to location mapping
 * Maps IANA timezone identifiers to approximate locations
 *
 * @see https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 */
const TIMEZONE_LOCATION_MAP: Record<
  string,
  { country: string; region?: string; city?: string }
> = {
  // United States
  'America/New_York': { country: 'US', region: 'New York', city: 'New York' },
  'America/Chicago': { country: 'US', region: 'Illinois', city: 'Chicago' },
  'America/Denver': { country: 'US', region: 'Colorado', city: 'Denver' },
  'America/Los_Angeles': {
    country: 'US',
    region: 'California',
    city: 'Los Angeles',
  },
  'America/Phoenix': { country: 'US', region: 'Arizona', city: 'Phoenix' },
  'America/Anchorage': { country: 'US', region: 'Alaska', city: 'Anchorage' },
  'Pacific/Honolulu': { country: 'US', region: 'Hawaii', city: 'Honolulu' },
  'America/Detroit': { country: 'US', region: 'Michigan', city: 'Detroit' },
  'America/Indianapolis': {
    country: 'US',
    region: 'Indiana',
    city: 'Indianapolis',
  },
  'America/Boise': { country: 'US', region: 'Idaho', city: 'Boise' },

  // Canada
  'America/Toronto': { country: 'CA', region: 'Ontario', city: 'Toronto' },
  'America/Vancouver': {
    country: 'CA',
    region: 'British Columbia',
    city: 'Vancouver',
  },
  'America/Montreal': { country: 'CA', region: 'Quebec', city: 'Montreal' },
  'America/Edmonton': { country: 'CA', region: 'Alberta', city: 'Edmonton' },
  'America/Winnipeg': { country: 'CA', region: 'Manitoba', city: 'Winnipeg' },
  'America/Halifax': { country: 'CA', region: 'Nova Scotia', city: 'Halifax' },

  // United Kingdom & Ireland
  'Europe/London': { country: 'GB', region: 'England', city: 'London' },
  'Europe/Dublin': { country: 'IE', region: 'Leinster', city: 'Dublin' },

  // Western Europe
  'Europe/Paris': { country: 'FR', region: 'Île-de-France', city: 'Paris' },
  'Europe/Berlin': { country: 'DE', region: 'Berlin', city: 'Berlin' },
  'Europe/Amsterdam': {
    country: 'NL',
    region: 'North Holland',
    city: 'Amsterdam',
  },
  'Europe/Brussels': { country: 'BE', region: 'Brussels', city: 'Brussels' },
  'Europe/Zurich': { country: 'CH', region: 'Zurich', city: 'Zurich' },
  'Europe/Vienna': { country: 'AT', region: 'Vienna', city: 'Vienna' },
  'Europe/Madrid': { country: 'ES', region: 'Madrid', city: 'Madrid' },
  'Europe/Rome': { country: 'IT', region: 'Lazio', city: 'Rome' },
  'Europe/Lisbon': { country: 'PT', region: 'Lisbon', city: 'Lisbon' },

  // Northern Europe
  'Europe/Stockholm': { country: 'SE', region: 'Stockholm', city: 'Stockholm' },
  'Europe/Oslo': { country: 'NO', region: 'Oslo', city: 'Oslo' },
  'Europe/Copenhagen': {
    country: 'DK',
    region: 'Capital Region',
    city: 'Copenhagen',
  },
  'Europe/Helsinki': { country: 'FI', region: 'Uusimaa', city: 'Helsinki' },

  // Eastern Europe
  'Europe/Warsaw': { country: 'PL', region: 'Masovia', city: 'Warsaw' },
  'Europe/Prague': { country: 'CZ', region: 'Prague', city: 'Prague' },
  'Europe/Budapest': { country: 'HU', region: 'Budapest', city: 'Budapest' },
  'Europe/Bucharest': { country: 'RO', region: 'Bucharest', city: 'Bucharest' },
  'Europe/Athens': { country: 'GR', region: 'Attica', city: 'Athens' },
  'Europe/Istanbul': { country: 'TR', region: 'Istanbul', city: 'Istanbul' },
  'Europe/Moscow': { country: 'RU', region: 'Moscow', city: 'Moscow' },
  'Europe/Kiev': { country: 'UA', region: 'Kyiv', city: 'Kyiv' },

  // Asia - East
  'Asia/Tokyo': { country: 'JP', region: 'Tokyo', city: 'Tokyo' },
  'Asia/Seoul': { country: 'KR', region: 'Seoul', city: 'Seoul' },
  'Asia/Shanghai': { country: 'CN', region: 'Shanghai', city: 'Shanghai' },
  'Asia/Hong_Kong': { country: 'HK', city: 'Hong Kong' },
  'Asia/Taipei': { country: 'TW', region: 'Taipei', city: 'Taipei' },

  // Asia - Southeast
  'Asia/Singapore': { country: 'SG', city: 'Singapore' },
  'Asia/Bangkok': { country: 'TH', region: 'Bangkok', city: 'Bangkok' },
  'Asia/Ho_Chi_Minh': {
    country: 'VN',
    region: 'Ho Chi Minh City',
    city: 'Ho Chi Minh City',
  },
  'Asia/Jakarta': { country: 'ID', region: 'Jakarta', city: 'Jakarta' },
  'Asia/Manila': { country: 'PH', region: 'Metro Manila', city: 'Manila' },
  'Asia/Kuala_Lumpur': {
    country: 'MY',
    region: 'Kuala Lumpur',
    city: 'Kuala Lumpur',
  },

  // Asia - South
  'Asia/Kolkata': { country: 'IN', region: 'Maharashtra', city: 'Mumbai' },
  'Asia/Mumbai': { country: 'IN', region: 'Maharashtra', city: 'Mumbai' },
  'Asia/Dhaka': { country: 'BD', region: 'Dhaka', city: 'Dhaka' },
  'Asia/Karachi': { country: 'PK', region: 'Sindh', city: 'Karachi' },

  // Asia - Middle East
  'Asia/Dubai': { country: 'AE', region: 'Dubai', city: 'Dubai' },
  'Asia/Riyadh': { country: 'SA', region: 'Riyadh', city: 'Riyadh' },
  'Asia/Jerusalem': { country: 'IL', region: 'Jerusalem', city: 'Jerusalem' },
  'Asia/Tel_Aviv': { country: 'IL', region: 'Tel Aviv', city: 'Tel Aviv' },

  // Oceania
  'Australia/Sydney': {
    country: 'AU',
    region: 'New South Wales',
    city: 'Sydney',
  },
  'Australia/Melbourne': {
    country: 'AU',
    region: 'Victoria',
    city: 'Melbourne',
  },
  'Australia/Brisbane': {
    country: 'AU',
    region: 'Queensland',
    city: 'Brisbane',
  },
  'Australia/Perth': {
    country: 'AU',
    region: 'Western Australia',
    city: 'Perth',
  },
  'Australia/Adelaide': {
    country: 'AU',
    region: 'South Australia',
    city: 'Adelaide',
  },
  'Pacific/Auckland': { country: 'NZ', region: 'Auckland', city: 'Auckland' },
  'Pacific/Fiji': { country: 'FJ', city: 'Suva' },

  // South America
  'America/Sao_Paulo': {
    country: 'BR',
    region: 'São Paulo',
    city: 'São Paulo',
  },
  'America/Buenos_Aires': {
    country: 'AR',
    region: 'Buenos Aires',
    city: 'Buenos Aires',
  },
  'America/Santiago': { country: 'CL', region: 'Santiago', city: 'Santiago' },
  'America/Lima': { country: 'PE', region: 'Lima', city: 'Lima' },
  'America/Bogota': { country: 'CO', region: 'Bogotá', city: 'Bogotá' },
  'America/Mexico_City': {
    country: 'MX',
    region: 'Mexico City',
    city: 'Mexico City',
  },

  // Africa
  'Africa/Cairo': { country: 'EG', region: 'Cairo', city: 'Cairo' },
  'Africa/Johannesburg': {
    country: 'ZA',
    region: 'Gauteng',
    city: 'Johannesburg',
  },
  'Africa/Lagos': { country: 'NG', region: 'Lagos', city: 'Lagos' },
  'Africa/Nairobi': { country: 'KE', region: 'Nairobi', city: 'Nairobi' },
  'Africa/Casablanca': {
    country: 'MA',
    region: 'Casablanca-Settat',
    city: 'Casablanca',
  },
}

/**
 * Fallback country mapping based on timezone region prefix
 */
const TIMEZONE_REGION_FALLBACK: Record<string, string> = {
  America: 'US',
  US: 'US',
  Canada: 'CA',
  Europe: 'EU',
  Asia: 'APAC',
  Australia: 'AU',
  Pacific: 'APAC',
  Africa: 'APAC',
  Atlantic: 'EU',
  Indian: 'APAC',
  Arctic: 'EU',
  Antarctica: 'APAC',
}

/**
 * Get location data from timezone
 */
function getLocationFromTimezone(timezone: string): Partial<WebSearchUserLocation> {
  const location: Partial<WebSearchUserLocation> = {
    type: 'approximate',
    timezone,
  }

  // Try exact match first
  const exactMatch = TIMEZONE_LOCATION_MAP[timezone]
  if (exactMatch) {
    location.country = exactMatch.country
    location.region = exactMatch.region
    location.city = exactMatch.city
    return location
  }

  // Fallback to region-based mapping
  const parts = timezone.split('/')
  if (parts.length >= 1) {
    const region = parts[0]
    if (TIMEZONE_REGION_FALLBACK[region]) {
      location.country = TIMEZONE_REGION_FALLBACK[region]
    }
    if (parts.length >= 2) {
      // Use the city part of timezone as region (e.g., "New_York" -> "New York")
      location.region = parts[parts.length - 1].replace(/_/g, ' ')
    }
  }

  return location
}

/**
 * Hook for getting user location data for web search localization
 *
 * @param options - Configuration options
 * @returns Geolocation data with loading state
 *
 * @example
 * ```tsx
 * const { location, isLoading, error } = useGeolocation()
 *
 * // Use location for web search
 * const userLocation: WebSearchUserLocation = {
 *   type: 'approximate',
 *   city: location.city,
 *   region: location.region,
 *   country: location.country,
 *   timezone: location.timezone,
 * }
 * ```
 */
export function useGeolocation(options?: {
  /** Whether to request browser geolocation (requires user permission) */
  enableBrowserGeolocation?: boolean
}): GeolocationData {
  const { enableBrowserGeolocation = false } = options ?? {}

  const [data, setData] = useState<GeolocationData>(() => {
    // Initialize with timezone-based location
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const location = getLocationFromTimezone(timezone)

    return {
      type: 'approximate',
      ...location,
      source: 'timezone',
      isLoading: enableBrowserGeolocation,
    }
  })

  const requestGeolocation = useCallback(() => {
    if (!enableBrowserGeolocation) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Geolocation not supported',
      }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Store coordinates for potential future reverse geocoding
        setData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'geolocation',
          isLoading: false,
        }))
      },
      (error) => {
        // Fall back to timezone-based location on error
        setData((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error.code === error.PERMISSION_DENIED
              ? 'Location permission denied'
              : 'Failed to get location',
        }))
      },
      {
        enableHighAccuracy: false, // Low accuracy is fine for city-level
        timeout: 5000,
        maximumAge: 30 * 60 * 1000, // Cache for 30 minutes
      },
    )
  }, [enableBrowserGeolocation])

  useEffect(() => {
    requestGeolocation()
  }, [requestGeolocation])

  return data
}

/**
 * Build a WebSearchUserLocation object from geolocation data
 *
 * @param data - Geolocation data from the hook
 * @returns WebSearchUserLocation for API requests
 */
export function buildUserLocation(data: GeolocationData): WebSearchUserLocation {
  const location: WebSearchUserLocation = {
    type: 'approximate',
  }

  if (data.city) location.city = data.city
  if (data.region) location.region = data.region
  if (data.country) location.country = data.country
  if (data.timezone) location.timezone = data.timezone

  return location
}

/**
 * Get user location synchronously from timezone (for SSR/initial render)
 *
 * @returns WebSearchUserLocation based on current timezone
 */
export function getUserLocationFromTimezone(): WebSearchUserLocation {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const location = getLocationFromTimezone(timezone)

  return {
    type: 'approximate',
    ...location,
  } as WebSearchUserLocation
}

export default useGeolocation

