import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_INFINITY     = 'scores_infinity';
const KEY_INFINITY_ALL = 'scores_infinity_all';
const KEY_EPIC         = 'scores_epic';

// ── Infinity por fandom ───────────────────────────────────────────

export async function getInfinityRecord(fandomId) {
  try {
    const raw = await AsyncStorage.getItem(KEY_INFINITY);
    const map = raw ? JSON.parse(raw) : {};
    return map[fandomId] ?? 0;
  } catch { return 0; }
}

export async function saveInfinityRecord(fandomId, streak) {
  try {
    const raw    = await AsyncStorage.getItem(KEY_INFINITY);
    const map    = raw ? JSON.parse(raw) : {};
    const prev   = map[fandomId] ?? 0;
    if (streak > prev) {
      map[fandomId] = streak;
      await AsyncStorage.setItem(KEY_INFINITY, JSON.stringify(map));
      return true; // nuevo récord
    }
    return false;
  } catch { return false; }
}

// ── Epic Mode ────────────────────────────────────────────────────

export async function getEpicRecord() {
  try {
    const raw = await AsyncStorage.getItem(KEY_EPIC);
    return raw ? parseInt(raw) : 0;
  } catch { return 0; }
}

export async function saveEpicRecord(streak) {
  try {
    const prev = await getEpicRecord();
    if (streak > prev) {
      await AsyncStorage.setItem(KEY_EPIC, String(streak));
      return true;
    }
    return false;
  } catch { return false; }
}

export async function getInfinityAllRecord() {
  try {
    const raw = await AsyncStorage.getItem(KEY_INFINITY_ALL);
    return raw ? parseInt(raw) : 0;
  } catch { return 0; }
}

export async function saveInfinityAllRecord(streak) {
  try {
    const prev = await getInfinityAllRecord();
    if (streak > prev) {
      await AsyncStorage.setItem(KEY_INFINITY_ALL, String(streak));
      return true;
    }
    return false;
  } catch { return false; }
}
