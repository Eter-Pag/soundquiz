import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { colors, getFandomTheme } from '../theme';
import { fetchSongs, fetchFandoms } from '../firebase/firestore';
import { getCachedAudio } from '../utils/audioCache';
import { saveInfinityRecord, saveInfinityAllRecord, saveEpicRecord } from '../utils/scores';

const { width } = Dimensions.get('window');
const CLIP_DURATION = 10000;
const OPTIONS_COUNT = 6;

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function getRandomStart(song) {
  if (song.isClip) return Math.random() < 0.5 ? 0 : 10;
  const start   = song.playStart ?? 10;
  const end     = song.playEnd   ?? 170;
  const safeEnd = end - 10;
  if (safeEnd <= start) return start;
  return start + Math.floor(Math.random() * (safeEnd - start));
}

function buildOptions(correct, allSongs) {
  const pool   = allSongs.filter(s => s.id !== correct.id);
  const wrongs = shuffle(pool).slice(0, OPTIONS_COUNT - 1);
  return shuffle([correct, ...wrongs]);
}

export default function InfinityScreen({ route, navigation }) {
  const { fandomId, fandomName: routeFandomName, theme: routeTheme, multiFandom, mode } = route.params;

  const [allSongs,   setAllSongs]   = useState([]);
  const [fandomName, setFandomName] = useState(routeFandomName ?? '');
  const [loading,    setLoading]    = useState(true);
  const [streak,     setStreak]     = useState(0);
  const [answered,   setAnswered]   = useState(false);
  const [options,    setOptions]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [playing,    setPlaying]    = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [feedback,   setFeedback]   = useState('');
  const [question,   setQuestion]   = useState(null);
  const [theme,      setTheme]      = useState(routeTheme ?? getFandomTheme(''));

  const streakRef    = useRef(0);
  const answeredRef  = useRef(false);
  const allSongsRef  = useRef([]);
  const usedIdsRef   = useRef(new Set());

  const ring1Anim = useRef(new Animated.Value(1)).current;
  const ring2Anim = useRef(new Animated.Value(1)).current;
  const ringLoop  = useRef(null);
  const soundRef  = useRef(null);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const timerRef  = useRef(null);

  // ── Carga inicial ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (multiFandom) {
        // Cargar canciones de todos los fandoms
        const fandoms = await fetchFandoms();
        const songArrays = await Promise.all(fandoms.map(f => fetchSongs(f.id)));
        const all = songArrays.flat();
        allSongsRef.current = all;
        setAllSongs(all);
        setFandomName('Todos los fandoms');
        setTheme(getFandomTheme(''));
      } else {
        const [songs, fandoms] = await Promise.all([fetchSongs(fandomId), fetchFandoms()]);
        allSongsRef.current = songs;
        setAllSongs(songs);
        if (fandoms && !routeFandomName) {
          const f = fandoms.find(f => f.id === fandomId);
          if (f) {
            setFandomName(f.name);
            setTheme(getFandomTheme(f.name));
          }
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  // Cuando allSongs carga, lanzar primera pregunta
  useEffect(() => {
    if (!loading && allSongs.length > 0) nextQuestion(allSongs);
  }, [loading]);

  // ── Audio visual ──────────────────────────────────────────────
  useEffect(() => {
    if (playing) {
      ring1Anim.setValue(1); ring2Anim.setValue(1);
      ringLoop.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ring1Anim, { toValue: 1.35, duration: 700, useNativeDriver: true }),
            Animated.timing(ring2Anim, { toValue: 1.20, duration: 700, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ring1Anim, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(ring2Anim, { toValue: 1, duration: 700, useNativeDriver: true }),
          ]),
        ])
      );
      ringLoop.current.start();
    } else {
      if (ringLoop.current) ringLoop.current.stop();
      ring1Anim.setValue(1); ring2Anim.setValue(1);
    }
    return () => { if (ringLoop.current) ringLoop.current.stop(); };
  }, [playing]);

  // ── Stop audio ────────────────────────────────────────────────
  const stopAudio = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlaying(false);
  }, []);

  // ── Siguiente pregunta ────────────────────────────────────────
  const nextQuestion = (songs) => {
    const pool = (songs ?? allSongsRef.current);
    // Evitar repetir canciones hasta agotar el pool
    let available = pool.filter(s => !usedIdsRef.current.has(s.id));
    if (available.length === 0) {
      usedIdsRef.current = new Set();
      available = pool;
    }
    const next = available[Math.floor(Math.random() * available.length)];
    usedIdsRef.current.add(next.id);

    setQuestion(next);
    setOptions(buildOptions(next, pool));
    setSelected(null);
    setAnswered(false);
    answeredRef.current = false;
    setFeedback('');
    setPlaying(false);
    setAudioReady(false);
    timerAnim.setValue(1);
    setTimeout(() => playFragment(next), 400);
  };

  // ── Reproducir fragmento ──────────────────────────────────────
  const playFragment = async (songOverride) => {
    const song  = songOverride || question;
    if (!song) return;
    await stopAudio();
    const start = getRandomStart(song);

    const startPlayback = async (uri) => {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { positionMillis: start * 1000 }
      );
      soundRef.current = sound;
      await sound.playAsync();
      setPlaying(true);
      setAudioReady(true);

      timerAnim.setValue(1);
      Animated.timing(timerAnim, { toValue: 0, duration: CLIP_DURATION, useNativeDriver: false }).start();

      timerRef.current = setTimeout(async () => {
        await stopAudio();
        if (!answeredRef.current) {
          answeredRef.current = true;
          setAnswered(true);
          setFeedback(`⏱ Tiempo — era: ${song.title}`);
          setTimeout(() => handleGameOver(), 1800);
        }
      }, CLIP_DURATION);
    };

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const uri = await getCachedAudio(song);
      await startPlayback(uri);
    } catch {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        await startPlayback(song.audioUrl);
      } catch (e2) {
        setFeedback('⚠ No se pudo cargar el audio');
      }
    }
  };

  // ── Respuesta ─────────────────────────────────────────────────
  const handleAnswer = async (opt) => {
    if (answeredRef.current || !question) return;
    answeredRef.current = true;
    setAnswered(true);
    setSelected(opt.id);
    await stopAudio();

    const isCorrect = opt.id === question.id;
    if (isCorrect) {
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      setStreak(newStreak);
      setFeedback(`✓ ¡Correcto! Racha x${newStreak}`);
      setTimeout(() => nextQuestion(), 1200);
    } else {
      setFeedback(`✗ Era: ${question.title}`);
      setTimeout(() => handleGameOver(), 1800);
    }
  };

  // ── Game over ─────────────────────────────────────────────────
  const handleGameOver = async () => {
    await stopAudio();
    const finalStreak = streakRef.current;
    let isNewRecord = false;

    if (mode === 'epic') {
      isNewRecord = await saveEpicRecord(finalStreak);
    } else if (multiFandom) {
      isNewRecord = await saveInfinityAllRecord(finalStreak);
    } else {
      isNewRecord = await saveInfinityRecord(fandomId, finalStreak);
    }

    navigation.replace('InfinityResults', {
      streak:     finalStreak,
      isNewRecord,
      fandomId:   multiFandom ? null : fandomId,
      fandomName,
      theme,
      multiFandom,
    });
  };

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (allSongs.length < OPTIONS_COUNT) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={{ fontSize: 40 }}>😅</Text>
        <Text style={styles.loadingText}>Necesitas al menos {OPTIONS_COUNT} canciones para el modo Infinity.</Text>
        <TouchableOpacity style={styles.backBtnCenter} onPress={() => navigation.goBack()}>
          <Text style={styles.backTextCenter}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const timerWidth = timerAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const letters    = ['A', 'B', 'C', 'D', 'E', 'F'];

  const getOptionStyle = (opt) => {
    if (!answered) return styles.optionBtn;
    if (opt.id === question?.id) return [styles.optionBtn, styles.optionCorrect];
    if (opt.id === selected)     return [styles.optionBtn, styles.optionWrong];
    return [styles.optionBtn, styles.optionDisabled];
  };

  const getOptionTextStyle = (opt) => {
    if (!answered) return styles.optionText;
    if (opt.id === question?.id) return [styles.optionText, styles.optionTextCorrect];
    if (opt.id === selected)     return [styles.optionText, styles.optionTextWrong];
    return [styles.optionText, styles.optionTextDisabled];
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { stopAudio(); navigation.goBack(); }}>
          <Text style={styles.backText}>← Salir</Text>
        </TouchableOpacity>
        <View style={styles.stats}>
          <View style={[styles.statPill, { backgroundColor: '#FFF3EC', borderColor: '#E07830' }]}>
            <Text style={[styles.statText, { color: '#C05820', fontWeight: '700' }]}>∞</Text>
          </View>
          {streak > 0 && (
            <View style={[styles.statPill, styles.statPillStreak]}>
              <Text style={[styles.statText, styles.statTextStreak]}>🔥 x{streak}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Audio card */}
      <View style={[styles.audioCard, { backgroundColor: theme.cardBg ?? colors.purple }]}>
        <View style={styles.audioVisual}>
          {playing && (
            <>
              <Animated.View style={[styles.ring, styles.ring1, { transform: [{ scale: ring1Anim }] }]} />
              <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: ring2Anim }] }]} />
            </>
          )}
          <TouchableOpacity
            style={[styles.playBtn, { backgroundColor: theme.bg }]}
            onPress={() => { if (!answered) playFragment(); }}
            activeOpacity={0.85}
            disabled={answered || playing}
          >
            <Text style={[styles.playBtnText, { color: theme.accent ?? colors.purple }]}>
              {playing ? '■' : '▶'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.audioHint}>
          {answered ? '—' : playing ? 'Escuchando...' : audioReady ? '▶ Toca para repetir' : 'Cargando audio...'}
        </Text>
        <View style={styles.timerWrap}>
          <Animated.View style={[styles.timerBar, { width: timerWidth }]} />
        </View>
      </View>

      {/* Opciones — 6 en grid de 2 columnas */}
      <View style={styles.optionsGrid}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={opt.id}
            style={getOptionStyle(opt)}
            onPress={() => handleAnswer(opt)}
            activeOpacity={0.8}
            disabled={answered}
          >
            <Text style={styles.optLetter}>{letters[i]}</Text>
            <Text style={getOptionTextStyle(opt)} numberOfLines={2}>{opt.title}</Text>
            {multiFandom && (
              <Text style={styles.optArtist} numberOfLines={1}>{opt.fandomId}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[
        styles.feedback,
        feedback.startsWith('✓') ? styles.feedbackCorrect : styles.feedbackWrong,
      ]}>
        {feedback}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.cream, paddingTop: 48 },
  loadingWrap:    { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText:    { fontSize: 14, color: colors.textSoft, textAlign: 'center' },
  backBtnCenter:  { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: colors.creamDark, borderRadius: 12 },
  backTextCenter: { fontSize: 14, color: colors.textSoft, fontWeight: '500' },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  backBtn:     { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.creamDark },
  backText:    { fontSize: 13, color: colors.textSoft, fontWeight: '500' },
  stats:       { flexDirection: 'row', gap: 8 },
  statPill:    { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.creamDeep },
  statPillStreak:  { borderColor: '#E07830', backgroundColor: '#FFF3EC' },
  statText:        { fontSize: 13, color: colors.textSoft },
  statTextStreak:  { color: '#C05820', fontWeight: '600' },

  audioCard:   { marginHorizontal: 20, borderRadius: 24, padding: 24, alignItems: 'center', gap: 14, elevation: 10, marginBottom: 16 },
  audioVisual: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
  ring:        { position: 'absolute', borderRadius: 50, borderWidth: 2, borderColor: 'rgba(245,240,232,0.25)' },
  ring1:       { width: 90, height: 90 },
  ring2:       { width: 70, height: 70 },
  playBtn:     { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  playBtnText: { fontSize: 20 },
  audioHint:   { fontSize: 13, color: 'rgba(245,240,232,0.7)', fontWeight: '300' },
  timerWrap:   { width: '100%', height: 4, backgroundColor: 'rgba(245,240,232,0.15)', borderRadius: 2, overflow: 'hidden' },
  timerBar:    { height: '100%', backgroundColor: colors.cream, borderRadius: 2 },

  optionsGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 8 },
  optionBtn:         { width: (width - 48) / 2, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.creamDeep, borderRadius: 16, padding: 12, gap: 3 },
  optionCorrect:     { backgroundColor: colors.correctBg, borderColor: colors.correct },
  optionWrong:       { backgroundColor: colors.wrongBg,   borderColor: colors.wrong },
  optionDisabled:    { opacity: 0.45 },
  optLetter:         { fontSize: 10, letterSpacing: 1.5, color: colors.textSoft, fontWeight: '500' },
  optionText:        { fontSize: 12, color: colors.textDark, fontWeight: '500', lineHeight: 17 },
  optionTextCorrect: { color: colors.correct },
  optionTextWrong:   { color: colors.wrong },
  optionTextDisabled:{ color: colors.textSoft },
  optArtist:         { fontSize: 10, color: colors.textSoft },

  feedback:        { textAlign: 'center', fontSize: 14, fontWeight: '500', marginTop: 12, minHeight: 20 },
  feedbackCorrect: { color: colors.correct },
  feedbackWrong:   { color: colors.wrong },
});
