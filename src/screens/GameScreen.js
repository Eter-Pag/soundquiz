import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { colors, getFandomTheme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { fetchSongs, fetchFandoms } from '../firebase/firestore';
import { getCachedAudio } from '../utils/audioCache';

const { width } = Dimensions.get('window');
const CLIP_DURATION = 10000;

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function getRandomStart(song) {
  if (song.isClip) return Math.random() < 0.5 ? 0 : 10;
  const start   = song.playStart ?? 10;
  const end     = song.playEnd   ?? 170;
  const safeEnd = end - 10;
  if (safeEnd <= start) return start;
  return start + Math.floor(Math.random() * (safeEnd - start));
}

function calcPoints(streak) {
  if (streak <= 1) return 100;
  if (streak === 2) return 150;
  if (streak === 3) return 200;
  return Math.min(400, 100 + streak * 60);
}

function buildOptions(correct, allSongs) {
  const pool   = allSongs.filter(s => s.fandomId === correct.fandomId && s.id !== correct.id);
  const wrongs = shuffle(pool).slice(0, 3);
  return shuffle([correct, ...wrongs]);
}

export default function GameScreen({ route, navigation }) {
  const { theme: appTheme } = useTheme();
  const { fandomId, theme: routeTheme, fandomName: routeFandomName } = route.params;
  const [resolvedTheme, setResolvedTheme] = useState(routeTheme ?? null);

  const [queue,        setQueue]        = useState([]);
  const [allSongs,     setAllSongs]     = useState([]);
  const [fandomName,   setFandomName]   = useState(routeFandomName ?? '');
  const [loading,      setLoading]      = useState(true);
  const [current,      setCurrent]      = useState(0);
  const [score,        setScore]        = useState(0);
  const [streak,       setStreak]       = useState(0);
  const [maxStreak,    setMaxStreak]    = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered,     setAnswered]     = useState(false);
  const [options,      setOptions]      = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [playing,      setPlaying]      = useState(false);
  const [audioReady,   setAudioReady]   = useState(false);
  const [feedback,     setFeedback]     = useState('');
  const [randomStart,  setRandomStart]  = useState(0);

  const scoreRef        = useRef(0);
  const correctCountRef = useRef(0);
  const streakRef       = useRef(0);
  const maxStreakRef    = useRef(0);
  const answeredRef     = useRef(false);
  const currentRef      = useRef(0);
  const queueRef        = useRef([]);
  const allSongsRef     = useRef([]);

  const ring1Anim    = useRef(new Animated.Value(1)).current;
  const ring2Anim    = useRef(new Animated.Value(1)).current;
  const ringLoop     = useRef(null);
  const soundRef     = useRef(null);
  const timerAnim    = useRef(new Animated.Value(1)).current;
  const timerRef     = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Promise.all([fetchSongs(fandomId), fetchFandoms()]).then(([songs, fandoms]) => {
      allSongsRef.current = songs;
      setAllSongs(songs);
      if (fandoms) {
        const f = fandoms.find(f => f.id === fandomId);
        if (f) {
          if (!routeFandomName) setFandomName(f.name);
          if (!routeTheme) setResolvedTheme(getFandomTheme(f.name));
        }
      }
      const q = shuffle(songs).slice(0, Math.min(10, songs.length));
      queueRef.current = q;
      setQueue(q);
      setLoading(false);
    });
  }, []);

  const question = queue[current];

  const stopAudio = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (question) generateOptions();
    return () => { stopAudio(); };
  }, [current, question]);

  useEffect(() => {
    if (queue.length === 0) return;
    Animated.timing(progressAnim, {
      toValue: current / queue.length,
      duration: 300, useNativeDriver: false,
    }).start();
  }, [current, queue]);

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

  const generateOptions = () => {
    if (!question) return;
    setOptions(buildOptions(question, allSongsRef.current));
    setSelected(null);
    setAnswered(false);
    answeredRef.current = false;
    setFeedback('');
    setPlaying(false);
    setAudioReady(false);
    timerAnim.setValue(1);
    const start = getRandomStart(question);
    setRandomStart(start);
    setTimeout(() => playFragment(question, start), 400);
  };

  const playFragment = async (songOverride, startOverride) => {
    const song  = songOverride  || question;
    const start = startOverride ?? randomStart;
    if (!song) return;
    await stopAudio();

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
          setFeedback(`⏱ Tiempo — era: ${song.title}`);
          setTimeout(nextQuestion, 1800);
        }
      }, CLIP_DURATION);
    };

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const uri = await getCachedAudio(song);
      await startPlayback(uri);
    } catch (e) {
      if (e?.code === 'NO_SPACE') {
        setFeedback('⚠ Almacenamiento lleno — reproduciendo en línea');
        setTimeout(() => setFeedback(''), 2500);
      } else {
        console.error('getCachedAudio error:', e?.message || e);
      }
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        await startPlayback(song.audioUrl);
      } catch (e2) {
        console.error('playFragment fallback error:', e2?.message || e2);
        setFeedback('⚠ No se pudo cargar el audio');
      }
    }
  };

  const handleAnswer = async (opt) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setAnswered(true);
    setSelected(opt.id);
    await stopAudio();
    const isCorrect = opt.id === question.id;
    if (isCorrect) {
      const newStreak = streakRef.current + 1;
      const newMax    = Math.max(maxStreakRef.current, newStreak);
      const pts       = calcPoints(newStreak);
      streakRef.current        = newStreak;
      maxStreakRef.current     = newMax;
      scoreRef.current        += pts;
      correctCountRef.current += 1;
      setStreak(newStreak);
      setMaxStreak(newMax);
      setScore(scoreRef.current);
      setCorrectCount(correctCountRef.current);
      setFeedback(newStreak > 1 ? `✓ ¡Correcto! Racha x${newStreak} (+${pts})` : `✓ ¡Correcto! (+${pts})`);
    } else {
      streakRef.current = 0;
      setStreak(0);
      setFeedback(`✗ Era: ${question.title}`);
    }
    setTimeout(nextQuestion, 1800);
  };

  const nextQuestion = () => {
    const q = queueRef.current;
    const c = currentRef.current;
    if (c + 1 >= q.length) {
      navigation.replace('Results', {
        score:     scoreRef.current,
        correct:   correctCountRef.current,
        total:     q.length,
        maxStreak: maxStreakRef.current,
        fandomId,
        fandomName,
        theme:     resolvedTheme,
      });
    } else {
      currentRef.current = c + 1;
      setCurrent(c + 1);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: appTheme.bg }]}>
        <StatusBar barStyle={appTheme.statusBar} backgroundColor={appTheme.bg} />
        <Text style={[styles.loadingText, { color: appTheme.textSub }]}>Cargando...</Text>
      </View>
    );
  }

  if (queue.length === 0) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: appTheme.bg }]}>
        <Text style={{ fontSize: 40 }}>😅</Text>
        <Text style={[styles.loadingText, { color: appTheme.textSub }]}>No hay canciones para este fandom.</Text>
        <TouchableOpacity style={[styles.backBtnCenter, { backgroundColor: appTheme.bg2 }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backTextCenter, { color: appTheme.textSub }]}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const theme = resolvedTheme ?? getFandomTheme('');
  const timerWidth    = timerAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const getOptionStyle = (opt) => {
    if (!answered) return styles.optionBtn;
    if (opt.id === question.id) return [styles.optionBtn, styles.optionCorrect];
    if (opt.id === selected)    return [styles.optionBtn, styles.optionWrong];
    return [styles.optionBtn, styles.optionDisabled];
  };

  const getOptionTextStyle = (opt) => {
    if (!answered) return styles.optionText;
    if (opt.id === question.id) return [styles.optionText, styles.optionTextCorrect];
    if (opt.id === selected)    return [styles.optionText, styles.optionTextWrong];
    return [styles.optionText, styles.optionTextDisabled];
  };

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <View style={[styles.container, { backgroundColor: appTheme.bg }]}>
      <StatusBar barStyle={appTheme.statusBar} backgroundColor={appTheme.bg} />

      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: appTheme.bg2, borderColor: appTheme.border }]}
          onPress={() => { stopAudio(); navigation.goBack(); }}
        >
          <Text style={[styles.backText, { color: appTheme.textSub }]}>← Salir</Text>
        </TouchableOpacity>
        <View style={styles.stats}>
          <View style={[styles.statPill, { backgroundColor: appTheme.card, borderColor: appTheme.border }]}>
            <Text style={[styles.statText, { color: appTheme.textSub }]}>{current + 1}/{queue.length}</Text>
          </View>
          {streak > 1 && (
            <View style={[styles.statPill, styles.statPillStreak]}>
              <Text style={[styles.statText, styles.statTextStreak]}>🔥 x{streak}</Text>
            </View>
          )}
          <View style={[styles.statPill, { borderColor: theme.accent, backgroundColor: theme.accentLight }]}>
            <Text style={[styles.statText, { color: theme.accent, fontWeight: '500' }]}>✶ {score}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.progressWrap, { backgroundColor: appTheme.border }]}>
        <Animated.View style={[styles.progressBar, { width: progressWidth, backgroundColor: theme.accent }]} />
      </View>

      <View style={[styles.audioCard, { backgroundColor: theme.cardBg }]}>
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
            <Text style={[styles.playBtnText, { color: theme.accent }]}>{playing ? '■' : '▶'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.audioHint}>
          {answered ? '—' : playing ? 'Escuchando...' : audioReady ? '▶ Toca para repetir' : 'Cargando audio...'}
        </Text>
        <View style={styles.timerWrap}>
          <Animated.View style={[styles.timerBar, { width: timerWidth }]} />
        </View>
      </View>

      <View style={styles.optionsGrid}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={opt.id}
            style={[
              getOptionStyle(opt),
              !answered && { backgroundColor: appTheme.card, borderColor: appTheme.border },
            ]}
            onPress={() => handleAnswer(opt)}
            activeOpacity={0.8}
            disabled={answered}
          >
            <Text style={[styles.optLetter, { color: appTheme.textSub }]}>{letters[i]}</Text>
            <Text style={[getOptionTextStyle(opt), !answered && { color: appTheme.text }]}>{opt.title}</Text>
            <Text style={[styles.optArtist, { color: appTheme.textSub }]}>{fandomName}</Text>
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
  container:      { flex: 1, paddingTop: 48 },
  loadingWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText:    { fontSize: 14 },
  backBtnCenter:  { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 16 },
  backTextCenter: { fontSize: 14, fontWeight: '500' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  backBtn:        { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  backText:       { fontSize: 13, fontWeight: '500' },
  stats:          { flexDirection: 'row', gap: 8 },
  statPill:       { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  statPillStreak: { borderColor: '#E07830', backgroundColor: '#FFF3EC' },
  statText:       { fontSize: 13 },
  statTextStreak: { color: '#C05820', fontWeight: '600' },
  progressWrap:   { height: 3, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden', marginBottom: 20 },
  progressBar:    { height: '100%', borderRadius: 2 },
  audioCard:      { marginHorizontal: 20, borderRadius: 24, padding: 28, alignItems: 'center', gap: 16, elevation: 10, marginBottom: 20 },
  audioVisual:    { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
  ring:           { position: 'absolute', borderRadius: 50, borderWidth: 2, borderColor: 'rgba(245,240,232,0.25)' },
  ring1:          { width: 90, height: 90 },
  ring2:          { width: 70, height: 70 },
  playBtn:        { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  playBtnText:    { fontSize: 20 },
  audioHint:      { fontSize: 13, color: 'rgba(245,240,232,0.7)', fontWeight: '300' },
  timerWrap:      { width: '100%', height: 4, backgroundColor: 'rgba(245,240,232,0.15)', borderRadius: 2, overflow: 'hidden' },
  timerBar:       { height: '100%', backgroundColor: 'rgba(245,240,232,0.9)', borderRadius: 2 },
  optionsGrid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
  optionBtn:      { width: (width - 50) / 2, borderWidth: 2, borderRadius: 16, padding: 16, gap: 4 },
  optionCorrect:  { backgroundColor: colors.correctBg, borderColor: colors.correct },
  optionWrong:    { backgroundColor: colors.wrongBg,   borderColor: colors.wrong },
  optionDisabled: { opacity: 0.5 },
  optLetter:      { fontSize: 10, letterSpacing: 1.5, fontWeight: '500', textTransform: 'uppercase' },
  optionText:     { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  optionTextCorrect:  { color: colors.correct },
  optionTextWrong:    { color: colors.wrong },
  optionTextDisabled: { color: colors.textSoft },
  optArtist:      { fontSize: 11, fontWeight: '300' },
  feedback:       { textAlign: 'center', fontSize: 14, fontWeight: '500', marginTop: 16, minHeight: 20 },
  feedbackCorrect:{ color: colors.correct },
  feedbackWrong:  { color: colors.wrong },
});
