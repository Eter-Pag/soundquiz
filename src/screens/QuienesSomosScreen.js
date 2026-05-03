import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const TEAM = [
  { emoji: '🎵', name: 'Eter Kpop',      role: 'Comunidad y contenido', desc: 'La comunidad que inspiró este proyecto. Fans del kpop unidos por la música.' },
  { emoji: '🎨', name: 'Dedika Studio',  role: 'Diseño y creatividad',   desc: 'Responsables del diseño visual, identidad y experiencia del juego.' },
  { emoji: '💎', name: 'Gema Studios',   role: 'Desarrollo y tecnología', desc: 'El equipo técnico detrás del desarrollo de SoundQuiz.' },
];

export default function QuienesSomosScreen({ navigation }) {
  const { theme: t } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.bg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: t.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: t.accent }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>Quiénes somos</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: t.bg2, borderColor: t.border }]}>
          <Text style={styles.heroEmoji}>💜</Text>
          <Text style={[styles.heroTitle, { color: t.text }]}>SoundQuiz</Text>
          <Text style={[styles.heroSub, { color: t.textSub }]}>
            Un proyecto de fans, hecho con amor para la comunidad kpop. Sin fines de lucro.
          </Text>
        </View>

        {/* Equipo */}
        <Text style={[styles.sectionLabel, { color: t.textSub }]}>EL EQUIPO</Text>
        {TEAM.map((m, i) => (
          <View key={i} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={styles.cardEmoji}>{m.emoji}</Text>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardName, { color: t.text }]}>{m.name}</Text>
              <Text style={[styles.cardRole, { color: t.accent }]}>{m.role}</Text>
              <Text style={[styles.cardDesc, { color: t.textSub }]}>{m.desc}</Text>
            </View>
          </View>
        ))}

        {/* Nota final */}
        <View style={[styles.note, { backgroundColor: t.bg2, borderColor: t.border }]}>
          <Text style={[styles.noteText, { color: t.textSub }]}>
            Los anuncios que ves en la app nos ayudan a costear los servidores y mantener el juego gratuito para toda la comunidad. ¡Gracias por tu apoyo! 🙌
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow:   { fontSize: 32, fontWeight: '300', lineHeight: 36 },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  content: { padding: 20, gap: 16, paddingBottom: 48 },

  hero: {
    borderRadius: 20, padding: 28, alignItems: 'center',
    gap: 8, borderWidth: 1,
  },
  heroEmoji: { fontSize: 48 },
  heroTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  heroSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, paddingLeft: 4 },

  card: {
    flexDirection: 'row', gap: 14, padding: 18,
    borderRadius: 16, borderWidth: 1,
  },
  cardEmoji: { fontSize: 32, marginTop: 2 },
  cardInfo:  { flex: 1, gap: 2 },
  cardName:  { fontSize: 16, fontWeight: '800' },
  cardRole:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  cardDesc:  { fontSize: 12, lineHeight: 18, marginTop: 4 },

  note: { borderRadius: 16, padding: 18, borderWidth: 1 },
  noteText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
