import {
  decideTerraceWeatherAction,
  type TerraceWeatherAction,
  type TerraceWeatherPolicy,
  type WeatherCondition,
  type WeatherSnapshot,
} from '../domain/weather-policy'

export interface WeatherProvider {
  getSnapshot(input: { latitude: number; longitude: number; at: Date }): Promise<WeatherSnapshot>
}

export async function getTerraceWeatherDecision(
  provider: WeatherProvider,
  input: { latitude: number; longitude: number; at: Date },
  policy?: TerraceWeatherPolicy,
): Promise<{ action: TerraceWeatherAction; snapshot: WeatherSnapshot }> {
  const snapshot = await provider.getSnapshot(input)
  return { action: decideTerraceWeatherAction(snapshot, policy), snapshot }
}

export interface OpenMeteoClientOptions {
  endpoint?: string
  fetcher?: typeof fetch
}

/** Small provider adapter; the domain only receives normalized snapshots. */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  private readonly endpoint: string
  private readonly fetcher: typeof fetch

  constructor(options: OpenMeteoClientOptions = {}) {
    this.endpoint = options.endpoint ?? 'https://api.open-meteo.com/v1/forecast'
    this.fetcher = options.fetcher ?? fetch
  }

  async getSnapshot(input: {
    latitude: number
    longitude: number
    at: Date
  }): Promise<WeatherSnapshot> {
    const url = new URL(this.endpoint)
    url.searchParams.set('latitude', String(input.latitude))
    url.searchParams.set('longitude', String(input.longitude))
    url.searchParams.set(
      'current',
      'temperature_2m,precipitation_probability,weather_code,wind_speed_10m',
    )
    const response = await this.fetcher(url)
    if (!response.ok) throw new Error(`weather_provider_failed:${response.status}`)
    const payload = (await response.json()) as {
      current?: {
        precipitation_probability?: number
        temperature_2m?: number
        weather_code?: number
        wind_speed_10m?: number
      }
    }
    if (!payload.current) throw new Error('weather_provider_invalid_response')
    return normalizeForecastReading({
      precipitationProbability: payload.current.precipitation_probability,
      temperatureC: payload.current.temperature_2m,
      weatherCode: payload.current.weather_code,
      windKph: payload.current.wind_speed_10m,
    })
  }
}

export interface ForecastReading {
  precipitationProbability?: number | null | undefined
  temperatureC?: number | null | undefined
  windKph?: number | null | undefined
  weatherCode?: number | null | undefined
}

/** Keeps vendor-specific forecast codes outside the terrace policy. */
export function normalizeForecastReading(reading: ForecastReading): WeatherSnapshot {
  const code = reading.weatherCode ?? 0
  let condition: WeatherCondition = 'clear'
  if (code >= 95) condition = 'storm'
  else if (code >= 51) condition = 'rain'
  else if ((reading.windKph ?? 0) >= 35) condition = 'strong_wind'
  else if ((reading.temperatureC ?? 0) >= 35) condition = 'heat'
  return {
    condition,
    precipitationProbability: Math.max(0, Math.min(100, reading.precipitationProbability ?? 0)),
    temperatureC: reading.temperatureC ?? 0,
    windKph: Math.max(0, reading.windKph ?? 0),
  }
}
