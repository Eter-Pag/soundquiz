import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { colors } from '../theme';
import { FANDOMS } from '../data/songs';

const { width } = Dimensions.get('window');
const CLIP_DURATION = 10000; // 10 segundos en ms

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Elige un punto aleatorio dentro del rango jugable
// dejando espacio para los 10 segundos del fragmento
function getRandomStart(song) {
  const start = song.playStart || 10;
  const end   = (song.playEnd || 170) - 10;
  const range = Math.max(0, end - start);
  return start + Math.floor(Math.random() * range);
}

export default function GameScreen({ route, navigation }) {
  const { fandomId, difficulty } = route.params;
  const fandom = FANDOMS.find(f => f.id === fandomId);

  const buildQueue = () => {
    let pool = fandom.songs;
    if (difficulty === 'medium') pool = pool.filter(s => s.difficulty !== 'easy');
    if (difficulty === 'hard')   pool = pool.filter(s => s.difficulty === 'hard');
    if (pool.length < 4) pool = fandom.songs;
    return shuffle(pool).slice(0, Math.min(10, pool.length));
  };

  const [queue]                     = useState(buildQueue);
  const [current, setCurrent]       = useState(0);
  const [score, setScore]           = useState(0);
  const [streak, setStreak]         = useState(0);
  const [maxStreak, setMaxStreak]   = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered]     = useState(false);
  const [options, setOptions]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [playing, setPlaying]       = useState(false);
  const [feedback, setFeedback]     = useState('');
  const [randomStart, setRandomStart] = useState(0);

  const soundRef    = useRef(null);
  const timerAnim   = useRef(new Animated.Value(1)).current;
  const timerRef    = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const question = queue[current];

  useEffect(() => {
    generateOptions();
    return () => stopAudio();
  }, [current]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: current / queue.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [current]);

  const generateOptions = () => {
    const wrongs = shuffle(fandom.songs.filter(s => s.id !== question.id)).slice(0, 3);
    setOptions(shuffle([question, ...wrongs]));
    setSelected(null);
    setAnswered(false);
    setFeedback('');
    setPlaying(false);
    timerAnim.setValue(1);
    // Genera el punto de inicio aleatorio para esta pregunta
    setRandomStart(getRandomStart(question));
  };

  const playFragment = async () => {
    if (answered || playing) return;
    await stopAudio();

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        question.file,
        { positionMillis: randomStart * 1000 }
      );
      soundRef.current = sound;
      await sound.playAsync();
      setPlaying(true);

      // Anima el timer
      timerAnim.setValue(1);
      Animated.timing(timerAnim, {
        toValue: 0,
        duration: CLIP_DURATION,
        useNativeDriver: false,
      }).start();

      // Detiene después de 10 seg
      timerRef.current = setTimeout(async () => {
        await stopAudio();
        if (!answered) {
          setFeedback(`⏱ Tiempo — era: ${question.title}`);
          setTimeout(nextQuestion, 1800);
        }
      }, CLIP_DURATION);

    } catch (e) {
      setFeedback('⚠ No se pudo cargar el audio');
    }
  };

  const stopAudio = async () => {
    clearTimeout(timerRef.current);
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlaying(false);
  };

  const handleAnswer = async (opt) => {
    if (answered) return;
    setAnswered(true);
    setSelected(opt.id);
    await stopAudio();

    const isCorrect = opt.id === question.id;

    if (isCorrect) {
      const newStreak = streak + 1;
      const newMax    = Math.max(maxStreak, newStreak);
      const pts       = newStreak > 1 ? Math.round(100 * 1.5) : 100;
      setStreak(newStreak);
      setMaxStreak(newMax);
      setScore(s => s + pts);
      setCorrectCount(c => c + 1);
      setFeedback(newStreak > 1 ? `✓ ¡Correcto! Racha x${newStreak}` : '✓ ¡Correcto!');
    } else {
      setStreak(0);
      setFeedback(`✗ Era: ${question.title}`);
    }

    setTimeout(nextQuestion, 1800);
  };

  const nextQuestion = () => {
    if (current + 1 >= queue.length) {
      navigation.replace('Results', {
        score,
        correct: correctCount,
        total: queue.length,
        maxStreak,
        fandomId,
        difficulty,
      });
    } else {
      setCurrent(c => c + 1);
    }
  };

  const timerWidth = timerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { stopAudio(); navigation.goBack(); }}
        >
          <Text style={styles.backText}>← Salir</Text>
        </TouchableOpacity>
        <View style={styles.stats}>
          <View style={styles.statPill}>
            <Text style={styles.statText}>{current + 1}/{queue.length}</Text>
          </View>
          <View style={[styles.statPill, styles.statPillScore]}>
            <Text style={[styles.statText, styles.statTextScore]}>✦ {score}</Text>
          </View>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressWrap}>
        <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
      </View>

      {/* Audio Card */}
      <View style={styles.audioCard}>
        <View style={styles.audioVisual}>
          {playing && (
            <>
              <Animated.View style={[styles.ring, styles.ring1]} />
              <Animated.View style={[styles.ring, styles.ring2]} />
            </>
          )}
          <TouchableOpacity
            style={styles.playBtn}
            onPress={playFragment}
            activeOpacity={0.85}
            disabled={answered}
          >
            <Text style={styles.playBtnText}>{playing ? '■' : '▶'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.audioHint}>
          {answered ? '—' : playing ? 'Escuchando...' : 'Presiona ▶ para escuchar'}
        </Text>

        <View style={styles.timerWrap}>
          <Animated.View style={[styles.timerBar, { width: timerWidth }]} />
        </View>
      </View>

      {/* Options */}
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
            <Text style={getOptionTextStyle(opt)}>{opt.title}</Text>
            <Text style={styles.optArtist}>{opt.artist}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feedback */}
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
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.creamDark,
  },
  backText: {
    fontSize: 13,
    color: colors.textSoft,
    fontWeight: '500',
  },
  stats: { flexDirection: 'row', gap: 8 },
  statPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.creamDeep,
  },
  statPillScore: {
    borderColor: colors.purpleLight,
    backgroundColor: colors.purplePale,
  },
  statText: { fontSize: 13, color: colors.textSoft },
  statTextScore: { color: colors.purple, fontWeight: '500' },
  progressWrap: {
    height: 3,
    backgroundColor: colors.creamDeep,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.purple,
    borderRadius: 2,
  },
  audioCard: {
    backgroundColor: colors.purple,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    elevation: 10,
    marginBottom: 20,
  },
  audioVisual: {
    width: 90, height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(245,240,232,0.25)',
  },
  ring1: { width: 90, height: 90 },
  ring2: { width: 70, height: 70 },
  playBtn: {
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  playBtnText: { fontSize: 20, color: colors.purple },
  audioHint: {
    fontSize: 13,
    color: 'rgba(245,240,232,0.7)',
    fontWeight: '300',
  },
  timerWrap: {
    width: '100%', height: 4,
    backgroundColor: 'rgba(245,240,232,0.15)',
    borderRadius: 2, overflow: 'hidden',
  },
  timerBar: {
    height: '100%',
    backgroundColor: colors.cream,
    borderRadius: 2,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  optionBtn: {
    width: (width - 50) / 2,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.creamDeep,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  optionCorrect: {
    backgroundColor: colors.correctBg,
    borderColor: colors.correct,
  },
  optionWrong: {
    backgroundColor: colors.wrongBg,
    borderColor: colors.wrong,
  },
  optionDisabled: { opacity: 0.5 },
  optLetter: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textSoft,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  optionText: {
    fontSize: 13,
    color: colors.textDark,
    fontWeight: '500',
    lineHeight: 18,
  },
  optionTextCorrect: { color: colors.correct },
  optionTextWrong:   { color: colors.wrong },
  optionTextDisabled:{ color: colors.textSoft },
  optArtist: {
    fontSize: 11,
    color: colors.textSoft,
    fontWeight: '300',
  },
  feedback: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    minHeight: 20,
  },
  feedbackCorrect: { color: colors.correct },
  feedbackWrong:   { color: colors.wrong },
});
