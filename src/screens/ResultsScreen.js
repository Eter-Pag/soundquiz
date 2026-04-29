import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, SafeAreaView
} from 'react-native';
import { colors } from '../theme';

export default function ResultsScreen({ route, navigation }) {
  const { score, correct, total, maxStreak, fandomId, difficulty } = route.params;
  const pct = correct / total;

  let icon, title, sub;
  if (pct === 1) { 
    icon = '🏆'; title = '¡Perfecto!'; sub = '¡Eres un fan legendario!'; 
  } else if (pct >= 0.8) { 
    icon = '🌟'; title = '¡Increíble!'; sub = 'Casi perfecto, ¡muy bien!'; 
  } else if (pct >= 0.5) { 
    icon = '🎵'; title = '¡Buen intento!'; sub = 'Conoces bien las canciones.'; 
  } else { 
    icon = '🎧'; title = '¡A practicar!'; sub = 'Sigue escuchando para mejorar.'; 
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.resultCard}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{sub}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>PUNTUACIÓN</Text>
            <Text style={styles.statValue}>{score}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ACIERTOS</Text>
            <Text style={styles.statValue}>{correct}/{total}</Text>
          </View>
        </View>

        <View style={styles.streakCard}>
          <Text style={styles.streakLabel}>MEJOR RACHA</Text>
          <Text style={styles.streakValue}>🔥 {maxStreak}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.mainBtn} 
            onPress={() => navigation.replace('Game', { fandomId, difficulty })}
          >
            <Text style={styles.mainBtnText}>REINTENTAR</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={() => navigation.replace('Home')}
          >
            <Text style={styles.secondaryBtnText}>VOLVER AL INICIO</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 25,
    alignItems: 'center',
  },
  resultCard: {
    backgroundColor: colors.surface,
    width: '100%',
    borderRadius: 30,
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  icon: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary,
  },
  streakCard: {
    width: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  streakLabel: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  streakValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  mainBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mainBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
});
