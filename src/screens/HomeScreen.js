import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Dimensions, SafeAreaView
} from 'react-native';
import { colors } from '../theme';
import { FANDOMS } from '../data/songs';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [selectedFandom, setSelectedFandom] = useState(FANDOMS[0].id);
  const [difficulty, setDifficulty] = useState('easy');

  const difficulties = [
    { id: 'easy', label: 'Fácil', color: '#10B981' },
    { id: 'medium', label: 'Normal', color: '#F59E0B' },
    { id: 'hard', label: 'Difícil', color: '#EF4444' },
  ];

  const handleStart = () => {
    navigation.navigate('Game', {
      fandomId: selectedFandom,
      difficulty: difficulty
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Sound<Text style={styles.titleAccent}>Quiz</Text></Text>
          <Text style={styles.subtitle}>Pon a prueba tu oído musical</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Elige tu Fandom</Text>
          <View style={styles.fandomGrid}>
            {FANDOMS.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.fandomCard,
                  selectedFandom === f.id && styles.fandomCardSelected
                ]}
                onPress={() => setSelectedFandom(f.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.fandomEmoji}>{f.emoji}</Text>
                <Text style={[
                  styles.fandomName,
                  selectedFandom === f.id && styles.fandomNameSelected
                ]}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Dificultad</Text>
          <View style={styles.difficultyRow}>
            {difficulties.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={[
                  styles.diffBtn,
                  difficulty === d.id && { backgroundColor: d.color, borderColor: d.color }
                ]}
                onPress={() => setDifficulty(d.id)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.diffText,
                  difficulty === d.id && { color: '#FFF' }
                ]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.startBtn} 
          onPress={handleStart}
          activeOpacity={0.8}
        >
          <Text style={styles.startBtnText}>¡EMPEZAR JUEGO!</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 25,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  titleAccent: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 5,
    fontWeight: '500',
  },
  section: {
    marginBottom: 35,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 15,
    marginLeft: 5,
  },
  fandomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fandomCard: {
    width: (width - 62) / 2,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  fandomCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  fandomEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  fandomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  fandomNameSelected: {
    color: colors.primary,
  },
  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  diffBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  diffText: {
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  startBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
    elevation: 5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
