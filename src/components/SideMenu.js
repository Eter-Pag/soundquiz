import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Animated, Linking, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function SideMenu({ visible, onClose, navigation }) {
  const { theme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(320)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const t = theme;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0,   useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(fadeAnim,  { toValue: 1,   useNativeDriver: true, duration: 200 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 320, useNativeDriver: true, duration: 220 }),
        Animated.timing(fadeAnim,  { toValue: 0,   useNativeDriver: true, duration: 180 }),
      ]).start();
    }
  }, [visible]);

  const isDark = t.mode === 'dark';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Overlay oscuro */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Panel deslizante */}
      <Animated.View style={[
        styles.panel,
        {
          backgroundColor: t.bg,
          transform: [{ translateX: slideAnim }],
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          borderLeftColor: t.border,
        }
      ]}>
        {/* Header */}
        <View style={styles.menuHeader}>
          <View>
            <Text style={[styles.menuTitle, { color: t.accent }]}>SOUNDQUIZ</Text>
            <Text style={[styles.menuSub, { color: t.textSub }]}>by Eter Kpop</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: t.bg2, borderColor: t.border }]}>
            <Text style={[styles.closeBtnText, { color: t.text }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        {/* Items */}
        <View style={styles.menuItems}>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: t.divider }]}
            onPress={() => { onClose(); Linking.openURL('https://eterkpop.com'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuItemIcon}>🌐</Text>
            <View style={styles.menuItemInfo}>
              <Text style={[styles.menuItemTitle, { color: t.text }]}>Eter Web</Text>
              <Text style={[styles.menuItemSub, { color: t.textSub }]}>Visita nuestra página oficial</Text>
            </View>
            <Text style={[styles.menuItemArrow, { color: t.textSub }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: t.divider }]}
            onPress={() => { onClose(); navigation.navigate('QuienesSomos'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuItemIcon}>💜</Text>
            <View style={styles.menuItemInfo}>
              <Text style={[styles.menuItemTitle, { color: t.text }]}>Quiénes somos</Text>
              <Text style={[styles.menuItemSub, { color: t.textSub }]}>Conoce al equipo</Text>
            </View>
            <Text style={[styles.menuItemArrow, { color: t.textSub }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: t.divider }]}
            onPress={() => { onClose(); navigation.navigate('Configuracion'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuItemIcon}>⚙️</Text>
            <View style={styles.menuItemInfo}>
              <Text style={[styles.menuItemTitle, { color: t.text }]}>Configuración</Text>
              <Text style={[styles.menuItemSub, { color: t.textSub }]}>Ajustes del juego</Text>
            </View>
            <Text style={[styles.menuItemArrow, { color: t.textSub }]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        {/* Toggle modo oscuro */}
        <View style={[styles.themeRow, { backgroundColor: t.bg2, borderColor: t.border }]}>
          <Text style={styles.themeIcon}>{isDark ? '🌙' : '☀️'}</Text>
          <View style={styles.themeInfo}>
            <Text style={[styles.themeTitle, { color: t.text }]}>
              {isDark ? 'Modo oscuro' : 'Modo claro'}
            </Text>
            <Text style={[styles.themeSub, { color: t.textSub }]}>
              {isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(val) => toggleTheme(val ? 'dark' : 'light')}
            trackColor={{ false: '#E8E5DE', true: '#7C3AED' }}
            thumbColor={isDark ? '#C44DE8' : '#FAFAF7'}
          />
        </View>

        <Text style={[styles.menuFooter, { color: t.textMuted }]}>
          Dedika Studio · Gema Studios · Eter Kpop
        </Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 300, borderLeftWidth: 1,
    paddingHorizontal: 24, gap: 16,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 20,
  },
  menuHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuTitle:    { fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  menuSub:      { fontSize: 11, marginTop: 2 },
  closeBtn:     { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '700' },
  divider:      { height: 1 },
  menuItems:    { gap: 0 },
  menuItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1 },
  menuItemIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  menuItemInfo: { flex: 1 },
  menuItemTitle:{ fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  menuItemSub:  { fontSize: 11, marginTop: 2 },
  menuItemArrow:{ fontSize: 20, fontWeight: '300' },
  themeRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  themeIcon:    { fontSize: 22, width: 32, textAlign: 'center' },
  themeInfo:    { flex: 1 },
  themeTitle:   { fontSize: 15, fontWeight: '700' },
  themeSub:     { fontSize: 11, marginTop: 2 },
  menuFooter:   { fontSize: 10, textAlign: 'center', letterSpacing: 0.5, marginTop: 'auto' },
});
