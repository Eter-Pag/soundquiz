import AsyncStorage from '@react-native-async-storage/async-storage';

const UNLOCKED_KEY = 'soundquiz_unlocked_fandoms';

// El índice 0 siempre es gratis — solo guardamos los desbloqueados por video
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
      const updated = [...current, fandomId];
      await AsyncStorage.setItem(UNLOCKED_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Error guardando fandom desbloqueado:', e);
  }
}

export async function isFandomUnlocked(fandomId, index) {
  if (index === 0) return true; // el primero siempre gratis
  const unlocked = await getUnlockedFandoms();
  return unlocked.includes(fandomId);
}
