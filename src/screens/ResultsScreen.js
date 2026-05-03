import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, SafeAreaView,
} from 'react-native';
import { colors } from '../theme';

export default function ResultsScreen({ route, navigation }) {
  const { score, correct, total, maxStreak, fandomId, fandomName, theme } = route.params;
  const pct = correct / total;

  let icon, title, sub;
  if (pct === 1)       { icon = '🏆'; title = '¡Perfecto!';     sub = '¡Eres un fan legendario!'; }
  else if (pct >= 0.8) { icon = '🌟'; title = '¡Increíble!';    sub = 'Casi perfecto, ¡muy bien!'; }
  else if (pct >= 0.5) { icon = '🎵'; title = '¡Buen intento!'; sub = 'Conoces bien las canciones.'; }
  else                 { icon = '🎧'; title = '¡A practicar!';  sub = 'Sigue escuchando para mejorar.'; }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Tarjeta principal */}
        <View style={styles.resultCard}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{sub}</Text>
          {fandomName ? <Text style={styles.fandomTag}>{fandomName}</Text> : null}
        </View>

        {/* Stats */}
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

        {/* Racha */}
        <View style={styles.streakCard}>
          <Text style={styles.streakLabel}>MEJOR RACHA</Text>
          <Text style={styles.streakValue}>🔥 {maxStreak}</Text>
        </View>

        {/* Acciones */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.mainBtn}
            onPress={() => navigation.replace('Game', { fandomId, theme, fandomName })}
          >
            <Text style={styles.mainBtnText}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.replace('Home')}
          >
            <Text style={styles.secondaryBtnText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content:   { padding: 28, paddingTop: 24, alignItems: 'center', gap: 16 },

  resultCard: {
    backgroundColor: colors.white,
    width: '100%', borderRadius: 24,
    padding: 36, alignItems: 'center', gap: 8,
    borderWidth: 2, borderColor: colors.creamDeep,
    elevation: 4,
  },
  icon:      { fontSize: 72, marginBottom: 4 },
  title:     { fontSize: 30, fontWeight: '700', color: colors.textDark, letterSpacing: -0.5 },
  subtitle:  { fontSize: 15, color: colors.textSoft, textAlign: 'center' },
  fandomTag: {
    marginTop: 4,
    fontSize: 12, letterSpacing: 1.5, fontWeight: '500',
    color: colors.purple,
    backgroundColor: colors.purplePale,
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },

  statsRow: { flexDirection: 'row', gap: 12, width: '100%' },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 18, padding: 20,
    alignItems: 'center', gap: 6,
    borderWidth: 2, borderColor: colors.creamDeep,
  },
  statLabel: { fontSize: 11, letterSpacing: 2, color: colors.textSoft, fontWeight: '500' },
  statValue: { fontSize: 26, fontWeight: '700', color: colors.purple },

  streakCard: {
    width: '100%',
    backgroundColor: colors.purplePale,
    borderRadius: 18, padding: 20,
    alignItems: 'center', gap: 4,
    borderWidth: 2, borderColor: colors.purple,
  },
  streakLabel: { fontSize: 11, letterSpacing: 2, color: colors.purple, fontWeight: '500' },
  streakValue: { fontSize: 30, fontWeight: '700', color: colors.purple },

  actions: { width: '100%', gap: 12 },
  mainBtn: {
    backgroundColor: colors.purple,
    paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', elevation: 5,
  },
  mainBtnText: { color: colors.cream, fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
  secondaryBtn: {
    backgroundColor: colors.white,
    paddingVertical: 18, borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2, borderColor: colors.creamDeep,
  },
  secondaryBtnText: { color: colors.textSoft, fontSize: 16, fontWeight: '500' },
});
