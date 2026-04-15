/** WMO Weather interpretation codes (Open-Meteo). https://open-meteo.com/en/docs */
export function wmoWeatherCodeToLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return ["Mainly clear", "Partly cloudy", "Overcast"][code - 1] ?? "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Unknown";
}

export function wmoWeatherCodeToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return ["🌤️", "⛅", "☁️"][code - 1] ?? "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code === 85 || code === 86) return "❄️";
  if (code >= 95 && code <= 99) return "⛈️";
  return "🌡️";
}

export function windDirectionToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const i = Math.round(((deg % 360) / 45)) % 8;
  return dirs[i] ?? "";
}
