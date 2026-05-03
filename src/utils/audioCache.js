import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUDIO_CACHE_DIR = FileSystem.cacheDirectory + 'soundquiz_audio/';

// Espacio mínimo libre requerido para cachear (30 MB en bytes)
const MIN_FREE_SPACE_BYTES = 30 * 1024 * 1024;

// Los archivos de audio expiran a los 7 días sin uso
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_META_KEY = 'soundquiz_cache_meta'; // AsyncStorage: { [filename]: lastUsedTimestamp }

// ── Helpers de metadatos ─────────────────────────────────────────────────────

async function getMeta() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function touchFile(filename) {
  try {
    const meta = await getMeta();
    meta[filename] = Date.now();
    await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
  } catch { /* silencioso */ }
}

async function removeMeta(filename) {
  try {
    const meta = await getMeta();
    delete meta[filename];
    await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
  } catch { /* silencioso */ }
}

// ── Expiración automática ────────────────────────────────────────────────────

/**
 * Recorre los archivos del directorio de caché y elimina los que
 * llevan más de CACHE_TTL_MS ms sin ser usados.
 * Se llama una vez al inicio, en ensureCacheDir().
 */
async function evictExpiredFiles() {
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
    if (!dirInfo.exists) return;

    const meta = await getMeta();
    const now = Date.now();
    const files = await FileSystem.readDirectoryAsync(AUDIO_CACHE_DIR);

    for (const filename of files) {
      const lastUsed = meta[filename];
      if (!lastUsed) {
        // Sin metadata → archivo huérfano, ponerle timestamp y dejarlo
        await touchFile(filename);
      } else if (now - lastUsed > CACHE_TTL_MS) {
        // Expirado → borrar
        try {
          await FileSystem.deleteAsync(AUDIO_CACHE_DIR + filename, { idempotent: true });
          await removeMeta(filename);
          console.log(`[cache] expirado y borrado: ${filename}`);
        } catch { /* ignorar fallos individuales */ }
      }
    }
  } catch (e) {
    console.warn('[cache] evictExpiredFiles error:', e?.message);
  }
}

// ── API pública ──────────────────────────────────────────────────────────────

/** Asegura que el directorio de caché existe y limpia archivos expirados. */
async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
  }
  // Limpieza en segundo plano: no bloquea el flujo principal
  evictExpiredFiles();
}

/**
 * Borra todos los archivos de audio cacheados por la app.
 * Se llama automáticamente cuando el espacio es bajo.
 */
export async function clearAudioCache() {
  try {
    const info = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(AUDIO_CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
    }
    // Limpiar también los metadatos de timestamps
    await AsyncStorage.removeItem(CACHE_META_KEY);
  } catch (e) {
    console.error('Error limpiando caché de audio:', e);
  }
}

/**
 * Devuelve la URI local del audio, descargando si hace falta.
 * Verifica espacio libre antes de descargar; si no hay suficiente,
 * limpia el caché propio y reintenta una vez.
 * Lanza { code: 'NO_SPACE' } si el espacio sigue siendo insuficiente.
 */
export async function getCachedAudio(song) {
  await ensureCacheDir();

  const filename  = `${song.id}.mp3`;
  const localPath = AUDIO_CACHE_DIR + filename;

  // Si ya está cacheado, refrescar timestamp y devolver
  const fileInfo = await FileSystem.getInfoAsync(localPath);
  if (fileInfo.exists) {
    await touchFile(filename);
    return localPath;
  }

  // Verificar espacio disponible antes de descargar
  const freeSpace = await FileSystem.getFreeDiskStorageAsync();
  if (freeSpace < MIN_FREE_SPACE_BYTES) {
    console.warn(`Espacio bajo (${(freeSpace / 1024 / 1024).toFixed(1)} MB). Limpiando caché...`);
    await clearAudioCache();
    const freeAfter = await FileSystem.getFreeDiskStorageAsync();
    if (freeAfter < MIN_FREE_SPACE_BYTES) {
      const err = new Error('Almacenamiento insuficiente en el dispositivo.');
      err.code = 'NO_SPACE';
      throw err;
    }
  }

  await FileSystem.downloadAsync(song.audioUrl, localPath);
  await touchFile(filename); // registrar timestamp de primera descarga
  return localPath;
}

/**
 * Pre-descarga todas las canciones de una lista en segundo plano.
 * Silencia errores individuales para que un fallo no detenga el resto.
 * Si se queda sin espacio, detiene el prefetch limpiamente.
 * @param {Array}    songs      - Lista de canciones con { id, audioUrl }
 * @param {Function} onProgress - Callback opcional (downloaded, total)
 */
export async function prefetchSongs(songs, onProgress) {
  await ensureCacheDir();
  let downloaded = 0;
  for (const song of songs) {
    try {
      await getCachedAudio(song);
    } catch (e) {
      // NO_SPACE u otro error: detenemos el prefetch para no insistir
      console.warn(`prefetchSongs: detenido en "${song.title}" —`, e?.message);
      break;
    }
    downloaded++;
    onProgress?.(downloaded, songs.length);
  }
}
