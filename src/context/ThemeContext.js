import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'soundquiz_theme';

export const ThemeContext = createContext();

export const LIGHT = {
  mode: 'light',
  bg:         '#FAFAF7',
  bg2:        '#F0EDE6',
  card:       '#FFFFFF',
  border:     '#E8E5DE',
  text:       '#1a1a14',
  textSub:    '#A89F8C',
  textMuted:  '#C8C3BA',
  accent:     '#C44DE8',
  accentDark: '#7C3AED',
  tabBg:      '#F0EDE6',
  tabActive:  '#FAFAF7',
  divider:    '#E8E5DE',
  statusBar:  'dark-content',
};

export const DARK = {
  mode: 'dark',
  bg:         '#0F0F0F',
  bg2:        '#1A1A1A',
  card:       '#1E1E1E',
  border:     '#2A2A2A',
  text:       '#F5F5F0',
  textSub:    '#6B6B6B',
  textMuted:  '#444444',
  accent:     '#C44DE8',
  accentDark: '#A855F7',
  tabBg:      '#1A1A1A',
  tabActive:  '#2A2A2A',
  divider:    '#2A2A2A',
  statusBar:  'light-content',
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(LIGHT);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'dark') setTheme(DARK);
    });
  }, []);

  const toggleTheme = async (mode) => {
    const next = mode === 'dark' ? DARK : LIGHT;
    setTheme(next);
    await AsyncStorage.setItem(THEME_KEY, next.mode);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
