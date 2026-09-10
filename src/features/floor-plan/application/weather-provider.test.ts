import { describe, expect, it } from 'vitest'

import {
  getTerraceWeatherDecision,
  normalizeForecastReading,
  OpenMeteoWeatherProvider,
} from './weather-provider'

describe('weather provider boundary', () => {
  it('normalizes rain and clamps vendor values', () => {
    expect(
      normalizeForecastReading({
        weatherCode: 61,
        precipitationProbability: 120,
        windKph: -2,
        temperatureC: 20,
      }),
    ).toEqual({
      condition: 'rain',
      precipitationProbability: 100,
      temperatureC: 20,
      windKph: 0,
    })
  })

  it('classifies storm, wind and heat without exposing vendor codes', () => {
    expect(normalizeForecastReading({ weatherCode: 95 }).condition).toBe('storm')
    expect(normalizeForecastReading({ windKph: 40 }).condition).toBe('strong_wind')
    expect(normalizeForecastReading({ temperatureC: 36 }).condition).toBe('heat')
  })

  it('calls the provider through an injectable fetcher', async () => {
    let requested = ''
    const provider = new OpenMeteoWeatherProvider({
      endpoint: 'https://weather.test/forecast',
      fetcher: async (input) => {
        requested =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        return new Response(
          JSON.stringify({
            current: {
              temperature_2m: 21,
              precipitation_probability: 10,
              weather_code: 0,
              wind_speed_10m: 8,
            },
          }),
          { status: 200 },
        )
      },
    })
    await expect(
      provider.getSnapshot({ latitude: 41.4, longitude: 2.1, at: new Date() }),
    ).resolves.toMatchObject({ condition: 'clear', temperatureC: 21 })
    expect(requested).toContain('latitude=41.4')
    expect(requested).toContain(
      'current=temperature_2m%2Cprecipitation_probability%2Cweather_code%2Cwind_speed_10m',
    )
  })

  it('returns a business decision without exposing provider details', async () => {
    const result = await getTerraceWeatherDecision(
      {
        getSnapshot: async () => ({
          condition: 'rain',
          precipitationProbability: 90,
          windKph: 10,
          temperatureC: 20,
        }),
      },
      { latitude: 1, longitude: 2, at: new Date() },
    )
    expect(result.action).toBe('move_inside')
    expect(result.snapshot.condition).toBe('rain')
  })
})
