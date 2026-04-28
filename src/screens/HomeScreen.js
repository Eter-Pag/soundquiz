import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Dimensions,
} from 'react-native';
import { colors } from '../theme';
import { FANDOMS } from '../data/songs';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [selectedFandom, setSelectedFandom] = useState(FANDOMS[0].id);
  const [difficulty, setDifficulty] = useState('easy');

  const difficulties = [
    { id: 'easy',   label: 'Fácil' },
    { id: 'medium', label: 'Normal' },
    { id: 'hard',   label: 'Difícil' },
  ];

  const handleStart = () => {
    navigation.navigate('Game', { fandomId: selectedFandom, difficulty });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* Logo */}
      <View style={styles.logoArea}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoEmoji}>♪</Text>
        </View>
        <Text style={styles.logoTitle}>SoundQuiz</Text>
        <Text style={styles.logoSub}>Adivina la canción antes de que acabe</Text>
      </View>

      {/* Fandom selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ELIGE TU FANDOM</Text>
        <View style={styles.fandomRow}>
          {FANDOMS.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.fandomCard, selectedFandom === f.id && styles.fandomCardSelected]}
              onPress={() => setSelectedFandom(f.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.fandomEmoji}>{f.emoji}</Text>
              <Text style={[styles.fandomName, selectedFandom === f.id && styles.fandomNameSelected]}>
                {f.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Difficulty */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DIFICULTAD</Text>
        <View style={styles.diffRow}>
          {difficulties.map(d => (
            <TouchableOpacity
              key={d.id}
              style={[styles.diffBtn, difficulty === d.id && styles.diffBtnActive]}
              onPress={() => setDifficulty(d.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.diffLabel, difficulty === d.id && styles.diffLabelActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Start */}
      <TouchableOpacity style={styles.btnPrimary} onPress={handleStart} activeOpacity={0.85}>
        <Text style={styles.btnPrimaryText}>Comenzar Quiz</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 32,
    paddingTop: 60,
    gap: 36,
  },
  logoArea: {
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 88, height: 88,
    borderRadius: 24,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 40,
    color: colors.cream,
  },
  logoTitle: {
    fontSize: 42,
    fontWeight: '600',
    color: colors.purple,
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize: 14,
    color: colors.textSoft,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  section: {
    gap: 14,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSoft,
    fontWeight: '500',
  },
  fandomRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fandomCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.creamDeep,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  fandomCardSelected: {
    borderColor: colors.purple,
    backgroundColor: colors.purplePale,
  },
  fandomEmoji: {
    fontSize: 28,
  },
  fandomName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMid,
  },
  fandomNameSelected: {
    color: colors.purple,
  },
  diffRow: {
    flexDirection: 'row',
    gap: 8,
  },
  diffBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.creamDeep,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  diffBtnActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  diffLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSoft,
  },
  diffLabelActive: {
    color: colors.cream,
  },
  btnPrimary: {
    backgroundColor: colors.purple,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 6,
  },
  btnPrimaryText: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
