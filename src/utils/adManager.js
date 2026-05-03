import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAds } from '../firebase/firestore';

const ADS_CACHE_KEY = 'soundquiz_ads_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

async function loadCache() {
  try {
    const raw = await AsyncStorage.getItem(ADS_CACHE_KEY);
    if (!raw) return { ads: [], lastFetch: 0 };
    return JSON.parse(raw);
  } catch {
    return { ads: [], lastFetch: 0 };
  }
}

async function saveCache(ads) {
  try {
    await AsyncStorage.setItem(ADS_CACHE_KEY, JSON.stringify({ ads, lastFetch: Date.now() }));
  } catch { /* silencioso */ }
}

/**
 * Trae los anuncios de Firebase, con caché persistente de 10 min.
 * Sobrevive cierres de la app para no hacer una query cada sesión.
 */
export async function getAds(forceRefresh = false) {
  const { ads: cachedAds, lastFetch } = await loadCache();
  const now = Date.now();

  if (!forceRefresh && cachedAds.length > 0 && now - lastFetch < CACHE_TTL) {
    return cachedAds;
  }

  const fresh = await fetchAds();
  await saveCache(fresh);
  return fresh;
}

/**
 * Devuelve un anuncio aleatorio de la lista.
 * Retorna null si no hay anuncios disponibles.
 */
export async function getRandomAd() {
  const ads = await getAds();
  if (!ads || ads.length === 0) return null;
  const idx = Math.floor(Math.random() * ads.length);
  return ads[idx];
}
