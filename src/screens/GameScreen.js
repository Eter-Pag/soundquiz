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

  const [queue] = useState(buildQueue);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [randomStart, setRandomStart] = useState(0);

  const soundRef = useRef(null);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const question = queue[current];

  useEffect(() => {
    generateOptions();
    return () => stopAudio();
  }, [current]);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: (current + 1) / queue.length,
      useNativeDriver: false,
    }).start();
  }, [current]);

  useEffect(() => {
    if (playing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [playing]);

  const generateOptions = () => {
    const wrongs = shuffle(fandom.songs.filter(s => s.id !== question.id)).slice(0, 3);
    setOptions(shuffle([question, ...wrongs]));
    setSelected(null);
    setAnswered(false);
    setFeedback('');
    setPlaying(false);
    setLoading(false);
    timerAnim.setValue(1);
    setRandomStart(getRandomStart(question));
  };

  const playFragment = async () => {
    if (answered || playing || loading) return;
    setLoading(true);
    await stopAudio();

    try {
      await Audio.setAudioModeAsync({ 
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldRouteThroughEarpieceAndroid: false
      });
      
      const { sound } = await Audio.Sound.createAsync(
        question.file,
        { positionMillis: randomStart * 1000, shouldPlay: true }
      );
      
      soundRef.current = sound;
      setLoading(false);
      setPlaying(true);

      timerAnim.setValue(1);
      Animated.timing(timerAnim, {
        toValue: 0,
        duration: CLIP_DURATION,
        useNativeDriver: false,
      }).start();

      timerRef.current = setTimeout(async () => {
        await stopAudio();
        if (!answered) {
          handleAnswer({ id: 'timeout' });
        }
      }, CLIP_DURATION);

    } catch (e) {
      setLoading(false);
      setFeedback('⚠ Error al cargar audio');
    }
  };

  const stopAudio = async () => {
    clearTimeout(timerRef.current);
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
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
      const newMax = Math.max(maxStreak, newStreak);
      const pts = 100 + (newStreak > 1 ? newStreak * 20 : 0);
      setStreak(newStreak);
      setMaxStreak(newMax);
      setScore(s => s + pts);
      setCorrectCount(c => c + 1);
      setFeedback(newStreak > 1 ? `🔥 ¡Racha x${newStreak}! (+${pts})` : '✨ ¡Correcto!');
    } else if (opt.id === 'timeout') {
      setStreak(0);
      setFeedback(`⏰ Tiempo agotado: ${question.title}`);
    } else {
      setStreak(0);
      setFeedback(`❌ Era: ${question.title}`);
    }

    setTimeout(nextQuestion, 2000);
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
    if (opt.id === selected) return [styles.optionBtn, styles.optionWrong];
    return [styles.optionBtn, styles.optionDisabled];
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.exitBtn} 
          onPress={() => { stopAudio(); navigation.goBack(); }}
        >
          <Text style={styles.exitText}>✕</Text>
        </TouchableOpacity>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressText}>{current + 1} de {queue.length}</Text>
        </View>

        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{score}</Text>
        </View>
      </View>

      {/* Audio Player Card */}
      <View style={styles.playerCard}>
        <Animated.View style={[
          styles.playButtonContainer,
          { transform: [{ scale: pulseAnim }] }
        ]}>
          <TouchableOpacity
            style={[styles.playBtn, playing && styles.playBtnActive]}
            onPress={playFragment}
            disabled={answered || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.playIcon, playing && styles.playIconActive]}>
                {playing ? '❙❙' : '▶'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
        
        <Text style={styles.hintText}>
          {answered ? 'Respuesta revelada' : playing ? 'Escuchando fragmento...' : 'Toca para escuchar'}
        </Text>

        <View style={styles.timerTrack}>
          <Animated.View style={[styles.timerBar, { width: timerWidth }]} />
        </View>
      </View>

      {/* Options Grid */}
      <View style={styles.optionsContainer}>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={opt.id}
            style={getOptionStyle(opt)}
            onPress={() => handleAnswer(opt)}
            disabled={answered}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle} numberOfLines={1}>{opt.title}</Text>
              <Text style={styles.optionArtist} numberOfLines={1}>{opt.artist}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feedback Overlay */}
      {feedback !== '' && (
        <View style={styles.feedbackContainer}>
          <Text style={[
            styles.feedbackText,
            feedback.includes('❌') || feedback.includes('⏰') ? styles.textError : styles.textSuccess
          ]}>
            {feedback}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'space-between',
  },
  exitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  exitText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: 15,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  scoreBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  scoreText: {
    color: colors.surface,
    fontWeight: 'bold',
    fontSize: 14,
  },
  playerCard: {
    backgroundColor: colors.surface,
    margin: 20,
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  playButtonContainer: {
    marginBottom: 20,
  },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.primary,
  },
  playBtnActive: {
    backgroundColor: colors.primary,
  },
  playIcon: {
    fontSize: 30,
    color: colors.primary,
    marginLeft: 5,
  },
  playIconActive: {
    color: colors.surface,
    marginLeft: 0,
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
    fontWeight: '500',
  },
  timerTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  timerBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  optionsContainer: {
    paddingHorizontal: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionBtn: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  optionContent: {
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  optionArtist: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  optionWrong: {
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  feedbackContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  textSuccess: { color: colors.success },
  textError: { color: colors.error },
});
