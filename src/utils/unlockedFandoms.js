import AsyncStorage from '@react-native-async-storage/async-storage';

const UNLOCKED_KEY          = 'soundquiz_unlocked_fandoms';
const UNLOCKED_INFINITY_KEY = 'soundquiz_unlocked_infinity';

// ── NORMAL ────────────────────────────────────────────────────────
export async function getUnlockedFandoms() {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function unlockFandom(fandomId) {
  try {
    const current = await getUnlockedFandoms();
    if (!current.includes(fandomId)) {
      await AsyncStorage.setItem(UNLOCKED_KEY, JSON.stringify([...current, fandomId]));
    }
  } catch (e) {
    console.error('Error guardando fandom desbloqueado:', e);
  }
}

export async function isFandomUnlocked(fandomId, index) {
  if (index === 0) return true;
  const unlocked = await getUnlockedFandoms();
  return unlocked.includes(fandomId);
}

// ── INFINITY ──────────────────────────────────────────────────────
export async function getUnlockedInfinityFandoms() {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKED_INFINITY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function unlockInfinityFandom(fandomId) {
  try {
    const current = await getUnlockedInfinityFandoms();
    if (!current.includes(fandomId)) {
      await AsyncStorage.setItem(UNLOCKED_INFINITY_KEY, JSON.stringify([...current, fandomId]));
    }
  } catch (e) {
    console.error('Error guardando fandom infinity desbloqueado:', e);
  }
}
