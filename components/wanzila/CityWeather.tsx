'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSun, Moon, Sun } from 'lucide-react'

type Weather = { temperature: number; code: number; isDay: boolean }
const WEATHER_CACHE_KEY = 'wanzila:weather:v1'
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast?latitude=-4.263&longitude=15.268&current=temperature_2m,weather_code,is_day&timezone=Africa%2FBrazzaville'

function parseWeather(data: unknown): Weather | null {
  if (!data || typeof data !== 'object') return null
  const source = 'current' in data && data.current && typeof data.current === 'object' ? data.current : data
  const temperature = 'temperature' in source ? source.temperature : 'temperature_2m' in source ? source.temperature_2m : null
  const code = 'code' in source ? source.code : 'weather_code' in source ? source.weather_code : null
  const isDay = 'isDay' in source ? source.isDay : 'is_day' in source ? source.is_day === 1 : null
  return Number.isFinite(temperature) && Number.isFinite(code) && typeof isDay === 'boolean'
    ? { temperature: Math.round(Number(temperature)), code: Number(code), isDay }
    : null
}

function describe(code: number) {
  if (code === 0) return 'Ciel dégagé'
  if (code <= 3) return 'Partiellement nuageux'
  if (code <= 48) return 'Brume'
  if (code <= 57) return 'Bruine'
  if (code <= 67 || (code >= 80 && code <= 82)) return 'Pluie'
  if (code >= 95) return 'Orage'
  return 'Nuageux'
}

function WeatherIcon({ code, isDay }: Pick<Weather, 'code' | 'isDay'>) {
  if (code === 0) return isDay ? <Sun size={18} /> : <Moon size={18} />
  if (code <= 2) return isDay ? <CloudSun size={18} /> : <CloudMoon size={18} />
  if (code <= 3) return <Cloud size={18} />
  if (code <= 48) return <CloudFog size={18} />
  if (code <= 57) return <CloudDrizzle size={18} />
  if (code <= 82) return <CloudRain size={18} />
  if (code >= 95) return <CloudLightning size={18} />
  return <Cloud size={18} />
}

export function CityWeather() {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [weatherReady, setWeatherReady] = useState(false)
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        let response = await fetch('/api/weather')
        if (!response.ok) response = await fetch(OPEN_METEO_URL)
        if (!response.ok) throw new Error('Weather unavailable')
        const nextWeather = parseWeather(await response.json())
        if (!nextWeather) throw new Error('Invalid weather data')
        if (active) setWeather(nextWeather)
        try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(nextWeather)) } catch { /* Cache is optional. */ }
      } catch {
        try {
          const cached = parseWeather(JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null'))
          if (active && cached) setWeather(cached)
        } catch { /* City name stays visible when no fresh or cached weather is available. */ }
      }
      finally { if (active) setWeatherReady(true) }
    }
    load()
    const interval = window.setInterval(load, 15 * 60 * 1000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])
  return <div className="map-city" title={weather ? `${describe(weather.code)} · météo Open-Meteo` : 'Brazzaville'}>
    {weather && <WeatherIcon code={weather.code} isDay={weather.isDay} />}
    <span>Brazzaville</span>
    {!weatherReady && <span className="skeleton-block weather-skeleton" aria-label="Chargement météo" />}
    {weather && <strong>{weather.temperature} °C</strong>}
  </div>
}
