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

  const handleStart = () => {
    navigation.navigate('Game', {
      fandomId: selectedFandom
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.title}>SOUND<Text style={styles.titleAccent}>QUIZ</Text></Text>
            <View style={styles.logoUnderline} />
          </View>
          <Text style={styles.subtitle}>¿Qué tan bueno es tu oído?</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECCIONA TU GRUPO</Text>
          <View style={styles.fandomGrid}>
            {FANDOMS.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.fandomCard,
                  selectedFandom === f.id && styles.fandomCardSelected
                ]}
                onPress={() => setSelectedFandom(f.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.emojiCircle, selectedFandom === f.id && styles.emojiCircleSelected]}>
                  <Text style={styles.fandomEmoji}>{f.emoji}</Text>
                </View>
                <Text style={[
                  styles.fandomName,
                  selectedFandom === f.id && styles.fandomNameSelected
                ]}>{f.name}</Text>
                {selectedFandom === f.id && <View style={styles.activeDot} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>🎵 Ronda de 10 canciones aleatorias</Text>
        </View>

        <TouchableOpacity 
          style={styles.startBtn} 
          onPress={handleStart}
          activeOpacity={0.9}
        >
          <Text style={styles.startBtnText}>¡A JUGAR!</Text>
          <Text style={styles.startBtnSub}>Toca para comenzar el desafío</Text>
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
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 50,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  titleAccent: {
    color: colors.primary,
  },
  logoUnderline: {
    width: 60,
    height: 6,
    backgroundColor: colors.secondary,
    borderRadius: 3,
    marginTop: -5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textTertiary,
    marginBottom: 20,
    letterSpacing: 2,
    textAlign: 'center',
  },
  fandomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  fandomCard: {
    width: (width - 70) / 2,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 25,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  fandomCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
  },
  emojiCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  emojiCircleSelected: {
    backgroundColor: colors.primaryLight,
  },
  fandomEmoji: {
    fontSize: 36,
  },
  fandomName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  fandomNameSelected: {
    color: colors.primary,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 10,
  },
  infoBox: {
    backgroundColor: colors.primaryLight,
    padding: 15,
    borderRadius: 15,
    marginBottom: 30,
    alignItems: 'center',
  },
  infoText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  startBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 22,
    borderRadius: 25,
    alignItems: 'center',
    elevation: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  startBtnSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
