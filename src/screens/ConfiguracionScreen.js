import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function ConfiguracionScreen({ navigation }) {
  const { theme: t, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = t.mode === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.bg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: t.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: t.accent }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>Configuración</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionLabel, { color: t.textSub }]}>APARIENCIA</Text>

        {/* Modo claro */}
        <TouchableOpacity
          style={[styles.option, {
            backgroundColor: !isDark ? t.accent : t.card,
            borderColor: !isDark ? t.accent : t.border,
          }]}
          onPress={() => toggleTheme('light')}
          activeOpacity={0.8}
        >
          <Text style={styles.optionIcon}>☀️</Text>
          <View style={styles.optionInfo}>
            <Text style={[styles.optionTitle, { color: !isDark ? '#fff' : t.text }]}>Modo claro</Text>
            <Text style={[styles.optionSub, { color: !isDark ? 'rgba(255,255,255,0.7)' : t.textSub }]}>Fondo blanco crema</Text>
          </View>
          {!isDark && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        {/* Modo oscuro */}
        <TouchableOpacity
          style={[styles.option, {
            backgroundColor: isDark ? t.accent : t.card,
            borderColor: isDark ? t.accent : t.border,
          }]}
          onPress={() => toggleTheme('dark')}
          activeOpacity={0.8}
        >
          <Text style={styles.optionIcon}>🌙</Text>
          <View style={styles.optionInfo}>
            <Text style={[styles.optionTitle, { color: isDark ? '#fff' : t.text }]}>Modo oscuro</Text>
            <Text style={[styles.optionSub, { color: isDark ? 'rgba(255,255,255,0.7)' : t.textSub }]}>Fondo negro profundo</Text>
          </View>
          {isDark && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
      </View>
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

  content: { padding: 20, gap: 12 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, paddingLeft: 4, marginBottom: 4 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: 16, borderWidth: 1.5,
  },
  optionIcon:  { fontSize: 24 },
  optionInfo:  { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionSub:   { fontSize: 12, marginTop: 2 },
  checkmark:   { fontSize: 18, color: '#fff', fontWeight: '700' },
});
