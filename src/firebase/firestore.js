import { collection, getDocs, query, where, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from './config';

// ── Códigos de error que devolvemos al caller ────────────────────────────────
// null  → error desconocido / Firebase caído
// []    → colección vacía (sin datos, pero sin error)
// Los objetos de error tienen { error: true, code: string }

function classifyFirebaseError(e) {
  const msg = e?.message ?? '';
  const code = e?.code   ?? '';

  // Errores de red / Firebase caído
  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('Failed to fetch') ||
    msg.includes('offline')
  ) return 'network';

  // Errores de permisos
  if (code === 'permission-denied' || code === 'unauthenticated') return 'permission';

  return 'unknown';
}

// ── Valida la contraseña admin ───────────────────────────────────────────────
export async function checkAdminPassword(input) {
  try {
    const snap = await getDoc(doc(db, 'config', 'admin'));
    if (!snap.exists()) return false;
    return snap.data().password === input;
  } catch (e) {
    console.error('Error validando contraseña:', e);
    return false;
  }
}

// ── Trae canciones de un fandom ──────────────────────────────────────────────
export async function fetchSongs(fandomId) {
  try {
    const q = query(
      collection(db, 'songs'),
      where('fandomId', '==', fandomId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error fetching songs:', e);
    // Relanzar para que el caller (prefetchFandom) lo maneje
    const err = new Error('No se pudieron cargar las canciones.');
    err.code  = classifyFirebaseError(e);
    throw err;
  }
}

// ── Trae fandoms con conteo de canciones ─────────────────────────────────────
// Retorna:
//   Array      → éxito (puede ser vacío)
//   null       → error de red / Firebase caído → HomeScreen muestra "Sin conexión"
//   { error: true, code: 'permission' } → error de permisos
export async function fetchFandoms() {
  try {
    const [fandomSnap, songSnap] = await Promise.all([
      getDocs(collection(db, 'fandoms')),
      getDocs(collection(db, 'songs')),
    ]);

    // Contamos canciones por fandomId en memoria (evita N queries extra)
    const counts = {};
    songSnap.docs.forEach(d => {
      const fid = d.data().fandomId;
      counts[fid] = (counts[fid] || 0) + 1;
    });

    return fandomSnap.docs
      .map(d => ({
        id: d.id,
        ...d.data(),
        songCount: counts[d.id] || 0,
      }))
      .filter(f => f.songCount >= 10);

  } catch (e) {
    const errorCode = classifyFirebaseError(e);
    console.error(`[firestore] fetchFandoms error (${errorCode}):`, e?.message);

    if (errorCode === 'permission') {
      return { error: true, code: 'permission' };
    }
    // network / unknown → devolvemos null para mostrar pantalla "Sin conexión"
    return null;
  }
}

// ── Elimina una canción ──────────────────────────────────────────────────────
export async function deleteSong(songId) {
  try {
    await deleteDoc(doc(db, 'songs', songId));
  } catch (e) {
    console.error('Error eliminando canción:', e);
    const err = new Error('No se pudo eliminar la canción.');
    err.code  = classifyFirebaseError(e);
    throw err;
  }
}

// ── Trae todos los anuncios de afiliado ──────────────────────────────────────
export async function fetchAds() {
  try {
    const snapshot = await getDocs(collection(db, 'ads'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error fetching ads:', e);
    return [];
  }
}

// ── Elimina un anuncio ───────────────────────────────────────────────────────
export async function deleteAd(adId) {
  try {
    await deleteDoc(doc(db, 'ads', adId));
  } catch (e) {
    console.error('Error eliminando anuncio:', e);
    const err = new Error('No se pudo eliminar el anuncio.');
    err.code  = classifyFirebaseError(e);
    throw err;
  }
}
