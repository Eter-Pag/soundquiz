import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Animated,
} from 'react-native';
import { colors, getFandomTheme } from '../theme';
import { getInfinityRecord, getInfinityAllRecord, getEpicRecord } from '../utils/scores';

export default function InfinityResultsScreen({ route, navigation }) {
  const { streak, isNewRecord, fandomId, fandomName, theme: routeTheme, multiFandom, mode } = route.params;
  const theme = routeTheme ?? getFandomTheme('');

  const [record, setRecord] = useState(null);

  const scaleAnim = React.useRef(new Animated.Value(0.7)).current;
  const opacAnim  = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const load = async () => {
      let r;
      if (mode === 'epic') {
        r = await getEpicRecord();
      } else if (multiFandom) {
        r = await getInfinityAllRecord();
      } else {
        r = await getInfinityRecord(fandomId);
      }
      setRecord(r);
    };
    load();

    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const emoji = streak === 0 ? '😬' : streak < 5 ? '🎵' : streak < 10 ? '🔥' : streak < 20 ? '💥' : '👑';

  return (
    <View style={[styles.container, { backgroundColor: theme.bg ?? colors.cream }]}>
      <StatusBar barStyle="dark-content" />

      <Animated.View style={[styles.card, { opacity: opacAnim, transform: [{ scale: scaleAnim }] }]}>

        {/* Emoji grande */}
        <Text style={styles.emoji}>{emoji}</Text>

        {/* Modo */}
        <Text style={styles.modeLabel}>
          {mode === 'epic' ? 'EPIC MODE' : multiFandom ? 'INFINITY FANDOMS' : `INFINITY · ${fandomName?.toUpperCase()}`}
        </Text>

        {/* Racha */}
        <Text style={styles.streakLabel}>RACHA</Text>
        <Text style={[styles.streakNum, { color: theme.accent ?? colors.purple }]}>{streak}</Text>

        {/* Nuevo récord */}
        {isNewRecord && streak > 0 && (
          <View style={styles.recordBadge}>
            <Text style={styles.recordText}>🏆 ¡Nuevo récord!</Text>
          </View>
        )}

        {/* Récord guardado */}
        {record !== null && (
          <Text style={styles.prevRecord}>
            {isNewRecord && streak > 0
              ? `Racha anterior superada`
              : `Mejor racha: ${record}`}
          </Text>
        )}

        {/* Mensaje motivacional */}
        <Text style={styles.message}>
          {streak === 0
            ? 'Ni una... ¡a practicar!'
            : streak < 5
            ? '¡Buen intento, sigue practicando!'
            : streak < 10
            ? '¡Vas bien, casi lo logras!'
            : streak < 20
            ? '¡Impresionante racha!'
            : '¡Eres una leyenda del fandom!'}
        </Text>
      </Animated.View>

      {/* Botones */}
      <View style={styles.btns}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.accent ?? colors.purple }]}
          onPress={() => navigation.replace('Infinity', route.params)}
          activeOpacity={0.88}
        >
          <Text style={styles.btnPrimaryText}>🔄 Intentar de nuevo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.88}
        >
          <Text style={styles.btnSecondaryText}>← Inicio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 24 },

  card: {
    width: '100%', backgroundColor: colors.white,
    borderRadius: 28, padding: 32,
    alignItems: 'center', gap: 10,
    elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12,
  },

  emoji:       { fontSize: 64, marginBottom: 4 },
  modeLabel:   { fontSize: 10, letterSpacing: 2.5, color: colors.textSoft, fontWeight: '700' },
  streakLabel: { fontSize: 11, letterSpacing: 2, color: colors.textSoft, fontWeight: '500', marginTop: 8 },
  streakNum:   { fontSize: 80, fontWeight: '900', letterSpacing: -4, lineHeight: 84 },

  recordBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: '#F59E0B',
  },
  recordText:  { fontSize: 13, color: '#B45309', fontWeight: '700' },
  prevRecord:  { fontSize: 12, color: colors.textSoft },
  message:     { fontSize: 13, color: colors.textSoft, textAlign: 'center', marginTop: 4, lineHeight: 20 },

  btns:         { width: '100%', gap: 10 },
  btn:          { borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  btnPrimary:   { },
  btnPrimaryText:   { fontSize: 15, fontWeight: '700', color: colors.white, letterSpacing: 0.3 },
  btnSecondary:     { backgroundColor: colors.creamDark, borderWidth: 1.5, borderColor: colors.creamDeep },
  btnSecondaryText: { fontSize: 14, fontWeight: '600', color: colors.textSoft },
});
