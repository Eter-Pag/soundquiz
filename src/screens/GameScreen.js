import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Dimensions, SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import { colors } from '../theme';
import { FANDOMS } from '../data/songs';

const { width } = Dimensions.get('window');
const CLIP_DURATION = 10000;

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function getRandomStart(song) {
  const start = song.playStart || 10;
  const end = (song.playEnd || 170) - 10;
  const range = Math.max(0, end - start);
  return start + Math.floor(Math.random() * range);
}

export default function GameScreen({ route, navigation }) {
  const { fandomId, difficulty } = route.params;
  const fandom = FANDOMS.find(f => f.id === fandomId);

  const buildQueue = () => {
    let pool = fandom.songs;
    if (difficulty === 'medium') pool = pool.filter(s => s.difficulty !== 'easy');
    if (difficulty === 'hard') pool = pool.filter(s => s.difficulty === 'hard');
    if (pool.length < 4) pool = fandom.songs;
    return shuffle(pool).slice(0, Math.min(10, pool.length));
  };

  // Estados del juego
  const [queue] = useState(buildQueue);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  
  // Estados de UI
  const [isReady, setIsReady] = useState(false); // Pantalla de "Prepárate"
  const [answered, setAnswered] = useState(false);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  // Referencias de Audio
  const currentSound = useRef(null);
  const nextSound = useRef(null);
  const [nextReady, setNextReady] = useState(false);

  // Animaciones
  const timerAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);

  const question = queue[current];

  // 1. Inicialización: Cargar la primera canción y mostrar "Prepárate"
  useEffect(() => {
    const initGame = async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      await prepareSound(0, 'current');
      setIsReady(true);
      // Precargar la segunda canción de una vez
      if (queue.length > 1) prepareSound(1, 'next');
    };
    initGame();
    return () => cleanupSounds();
  }, []);

  // 2. Al cambiar de pregunta
  useEffect(() => {
    if (isReady) {
      generateOptions();
      startPlaying();
    }
  }, [current, isReady]);

  const cleanupSounds = async () => {
    if (currentSound.current) await currentSound.current.unloadAsync().catch(()=>{});
    if (nextSound.current) await nextSound.current.unloadAsync().catch(()=>{});
  };

  const prepareSound = async (index, type) => {
    try {
      const song = queue[index];
      const startTime = getRandomStart(song);
      const { sound } = await Audio.Sound.createAsync(
        song.file,
        { positionMillis: startTime * 1000, shouldPlay: false }
      );
      
      if (type === 'current') {
        currentSound.current = sound;
      } else {
        nextSound.current = sound;
        setNextReady(true);
      }
    } catch (e) {
      console.log("Error cargando audio:", e);
    }
  };

  const generateOptions = () => {
    const wrongs = shuffle(fandom.songs.filter(s => s.id !== question.id)).slice(0, 3);
    setOptions(shuffle([question, ...wrongs]));
    setSelected(null);
    setAnswered(false);
    setFeedback('');
    timerAnim.setValue(1);
  };

  const startPlaying = async () => {
    if (!currentSound.current) return;
    
    try {
      setPlaying(true);
      await currentSound.current.playAsync();

      // Animación del timer
      Animated.timing(timerAnim, {
        toValue: 0,
        duration: CLIP_DURATION,
        useNativeDriver: false,
      }).start();

      // Pulso visual
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();

      timerRef.current = setTimeout(() => {
        if (!answered) handleAnswer({ id: 'timeout' });
      }, CLIP_DURATION);

    } catch (e) {
      setFeedback('⚠ Error al reproducir');
    }
  };

  const handleAnswer = async (opt) => {
    if (answered) return;
    setAnswered(true);
    setSelected(opt.id);
    clearTimeout(timerRef.current);
    
    if (currentSound.current) {
      await currentSound.current.stopAsync().catch(()=>{});
      setPlaying(false);
    }

    const isCorrect = opt.id === question.id;
    if (isCorrect) {
      const newStreak = streak + 1;
      const pts = 100 + (newStreak > 1 ? newStreak * 20 : 0);
      setStreak(newStreak);
      setMaxStreak(Math.max(maxStreak, newStreak));
      setScore(s => s + pts);
      setCorrectCount(c => c + 1);
      setFeedback(newStreak > 1 ? `🔥 Racha x${newStreak} (+${pts})` : '✨ ¡Correcto!');
    } else {
      setStreak(0);
      setFeedback(opt.id === 'timeout' ? `⏰ Tiempo: ${question.title}` : `❌ Era: ${question.title}`);
    }

    // Animación de la barra de progreso general
    Animated.spring(progressAnim, {
      toValue: (current + 1) / queue.length,
      useNativeDriver: false,
    }).start();

    setTimeout(nextQuestion, 2000);
  };

  const nextQuestion = async () => {
    if (current + 1 >= queue.length) {
      navigation.replace('Results', {
        score, correct: correctCount, total: queue.length, maxStreak, fandomId, difficulty
      });
      return;
    }

    // ROTACIÓN DE BUFFER:
    // 1. Soltar el sonido viejo
    if (currentSound.current) await currentSound.current.unloadAsync().catch(()=>{});
    
    // 2. El que era "next" ahora es "current"
    currentSound.current = nextSound.current;
    nextSound.current = null;
    setNextReady(false);

    // 3. Avanzar el índice
    setCurrent(c => c + 1);

    // 4. Precargar el siguiente en el fondo
    if (current + 2 < queue.length) {
      prepareSound(current + 2, 'next');
    }
  };

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>¡Prepárate!</Text>
        <Text style={styles.loadingSub}>Cargando primer fragmento...</Text>
      </View>
    );
  }

  const timerWidth = timerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.exitBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.exitText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressText}>{current + 1} de {queue.length}</Text>
        </View>
        <View style={styles.scoreBadge}><Text style={styles.scoreText}>{score}</Text></View>
      </View>

      <View style={styles.playerCard}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={[styles.playBtn, playing && styles.playBtnActive]}>
            <Text style={[styles.playIcon, playing && styles.playIconActive]}>
              {playing ? '❙❙' : '▶'}
            </Text>
          </View>
        </Animated.View>
        <Text style={styles.hintText}>
          {answered ? 'Respuesta revelada' : 'Escuchando...'}
        </Text>
        <View style={styles.timerTrack}>
          <Animated.View style={[styles.timerBar, { width: timerWidth }]} />
        </View>
      </View>

      <View style={styles.optionsContainer}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.optionBtn,
              answered && opt.id === question.id && styles.optionCorrect,
              answered && opt.id === selected && opt.id !== question.id && styles.optionWrong,
              answered && opt.id !== question.id && opt.id !== selected && styles.optionDisabled
            ]}
            onPress={() => handleAnswer(opt)}
            disabled={answered}
          >
            <Text style={styles.optionTitle}>{opt.title}</Text>
            <Text style={styles.optionArtist}>{opt.artist}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {feedback !== '' && (
        <View style={styles.feedbackContainer}>
          <Text style={[styles.feedbackText, (feedback.includes('❌') || feedback.includes('⏰')) ? styles.textError : styles.textSuccess]}>
            {feedback}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 28, fontWeight: '900', color: colors.primary, marginTop: 20 },
  loadingSub: { fontSize: 14, color: colors.textTertiary, marginTop: 5 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  exitBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  exitText: { fontSize: 18, color: colors.textSecondary, fontWeight: 'bold' },
  progressContainer: { flex: 1, marginHorizontal: 15, alignItems: 'center' },
  progressTrack: { width: '100%', height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressBar: { height: '100%', backgroundColor: colors.primary },
  progressText: { fontSize: 12, color: colors.textTertiary, fontWeight: '600' },
  scoreBadge: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  scoreText: { color: colors.surface, fontWeight: 'bold', fontSize: 14 },
  playerCard: { backgroundColor: colors.surface, margin: 20, borderRadius: 30, padding: 30, alignItems: 'center', elevation: 4 },
  playBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.primary },
  playBtnActive: { backgroundColor: colors.primary },
  playIcon: { fontSize: 30, color: colors.primary, marginLeft: 5 },
  playIconActive: { color: colors.surface, marginLeft: 0 },
  hintText: { color: colors.textSecondary, fontSize: 14, marginBottom: 20, fontWeight: '500' },
  timerTrack: { width: '100%', height: 6, backgroundColor: colors.primaryLight, borderRadius: 3, overflow: 'hidden' },
  timerBar: { height: '100%', backgroundColor: colors.primary },
  optionsContainer: { paddingHorizontal: 15, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  optionBtn: { width: '48%', backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 2, borderColor: colors.border, elevation: 2 },
  optionTitle: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  optionArtist: { fontSize: 12, color: colors.textTertiary, textAlign: 'center' },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.successBg },
  optionWrong: { borderColor: colors.error, backgroundColor: colors.errorBg },
  optionDisabled: { opacity: 0.6 },
  feedbackContainer: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: colors.surface, padding: 15, borderRadius: 15, alignItems: 'center', elevation: 10 },
  feedbackText: { fontSize: 16, fontWeight: 'bold' },
  textSuccess: { color: colors.success },
  textError: { color: colors.error },
});
