import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar,
} from 'react-native';
import { colors } from '../theme';

export default function ResultsScreen({ route, navigation }) {
  const { score, correct, total, maxStreak, fandomId, difficulty } = route.params;
  const pct = correct / total;

  let icon, title, sub;
  if (pct === 1)       { icon = '🏆'; title = '¡Perfecto!';        sub = 'Conoces cada canción al dedillo.'; }
  else if (pct >= 0.8) { icon = '🌟'; title = '¡Excelente fan!';   sub = 'Casi perfecto, impresionante.'; }
  else if (pct >= 0.5) { icon = '🎵'; title = '¡Buen trabajo!';    sub = 'Sigues aprendiendo las canciones.'; }
  else                 { icon = '🎧'; title = 'Sigue escuchando';  sub = 'La práctica hace al maestro.'; }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>

      {/* Score card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreNum}>{score}</Text>
          <Text style={styles.scoreLabel}>PUNTOS</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreItem}>
          <Text style={styles.scoreNum}>{correct}/{total}</Text>
          <Text style={styles.scoreLabel}>CORRECTAS</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreItem}>
          <Text style={styles.scoreNum}>{maxStreak}</Text>
          <Text style={styles.scoreLabel}>RACHA MÁX</Text>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => navigation.replace('Game', { fandomId, difficulty })}
        activeOpacity={0.85}
      >
        <Text style={styles.btnPrimaryText}>Jugar de nuevo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnSecondary}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}
      >
        <Text style={styles.btnSecondaryText}>Cambiar fandom</Text>
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
    paddingTop: 80,
    alignItems: 'center',
    gap: 20,
  },
  icon: {
    fontSize: 72,
  },
  title: {
    fontSize: 38,
    fontWeight: '600',
    color: colors.purple,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: colors.textSoft,
    fontWeight: '300',
    textAlign: 'center',
  },
  scoreCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.creamDeep,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    elevation: 4,
  },
  scoreItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  scoreNum: {
    fontSize: 38,
    fontWeight: '600',
    color: colors.purple,
    lineHeight: 42,
  },
  scoreLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textSoft,
    fontWeight: '500',
  },
  scoreDivider: {
    width: 1,
    height: 48,
    backgroundColor: colors.creamDeep,
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: colors.purple,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 6,
    marginTop: 8,
  },
  btnPrimaryText: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '500',
  },
  btnSecondary: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.purpleLight,
  },
  btnSecondaryText: {
    color: colors.purple,
    fontSize: 15,
    fontWeight: '500',
  },
});
