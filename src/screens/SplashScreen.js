import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ImageBackground,
  Animated, StyleSheet, StatusBar,
} from 'react-native';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system/legacy';
import { getCachedAudio, AUDIO_CACHE_DIR } from '../utils/audioCache';
import { fetchFandoms, fetchSongs } from '../firebase/firestore';

const MSGS_FETCH = [
  'Preparando canciones...',
  'Afinando los instrumentos...',
  'Cargando la playlist...',
];

const MSGS_DOWNLOAD = [
  'Descargando canciones...',
  'Trayendo musica del servidor...',
  'Guardando en tu dispositivo...',
  'Un momento, vale la pena...',
  'Ya casi estan todas...',
];

export default function SplashScreen({ navigation }) {
  const [message, setMessage] = useState('Iniciando...');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim  = useRef(new Animated.Value(1)).current;
  const msgTimer     = useRef(null);
  const isCancelled  = useRef(false);

  const animateTo = (pct, ms = 400) => {
    Animated.timing(progressAnim, {
      toValue: pct, duration: ms, useNativeDriver: false,
    }).start();
  };

  const rotateMessages = (pool) => {
    clearInterval(msgTimer.current);
    let idx = 0;
    setMessage(pool[0]);
    msgTimer.current = setInterval(() => {
      idx = (idx + 1) % pool.length;
      setMessage(pool[idx]);
    }, 2200);
  };

  const goHome = () => {
    clearInterval(msgTimer.current);
    setMessage('!Todo listo!');
    animateTo(100, 300);
    setTimeout(() => {
      Animated.timing(opacityAnim, {
        toValue: 0, duration: 500, useNativeDriver: true,
      }).start(() => {
        if (!isCancelled.current) navigation.replace('Home');
      });
    }, 800);
  };

  useEffect(() => {
    isCancelled.current = false;

    const run = async () => {

      // 1. OTA update (solo produccion)
      if (!__DEV__) {
        try {
          setMessage('Buscando actualizaciones...');
          animateTo(5, 300);
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable && !isCancelled.current) {
            setMessage('Descargando actualizacion...');
            animateTo(10, 200);
            await Updates.fetchUpdateAsync();
            if (!isCancelled.current) {
              setMessage('Actualizacion lista! Reiniciando...');
              animateTo(55, 400);
              await new Promise(r => setTimeout(r, 800));
              await Updates.reloadAsync();
              return;
            }
          }
        } catch (_) {}
      }

      if (isCancelled.current) return;

      // 2. Traer fandoms usando fetchFandoms (misma funcion que HomeScreen)
      animateTo(10, 300);
      rotateMessages(MSGS_FETCH);

      const fandoms = await fetchFandoms();
      console.log('[Splash] fandoms:', fandoms?.length ?? 'error');

      if (isCancelled.current) return;

      // Si no hay fandoms validos, entrar igual (HomeScreen muestra el error)
      if (!fandoms || fandoms.length === 0) {
        console.warn('[Splash] Sin fandoms jugables, entrando a Home');
        animateTo(100, 600);
        await new Promise(r => setTimeout(r, 700));
        goHome();
        return;
      }

      // 3. Tomar el primer fandom jugable y sus canciones (igual que HomeScreen)
      const firstFandom = fandoms[0];
      console.log('[Splash] primer fandom:', firstFandom.id, firstFandom.name);

      animateTo(18, 300);
      const allSongs = await fetchSongs(firstFandom.id);
      const songs = allSongs.slice(0, 10);
      console.log('[Splash] canciones a cachear:', songs.length);

      if (isCancelled.current) return;

      if (songs.length === 0) {
        animateTo(100, 600);
        await new Promise(r => setTimeout(r, 700));
        goHome();
        return;
      }

      // 4. Verificar cuales ya estan en cache
      const missing = [];
      let checked = 0;
      for (const song of songs) {
        if (isCancelled.current) return;
        const path = AUDIO_CACHE_DIR + song.id + '.mp3';
        try {
          const info = await FileSystem.getInfoAsync(path);
          if (info.exists && info.size > 0) {
            console.log('[Splash] cache OK:', song.id);
          } else {
            missing.push(song);
          }
        } catch {
          missing.push(song);
        }
        checked++;
        animateTo(18 + Math.round((checked / songs.length) * 10), 150);
      }

      console.log('[Splash] faltan:', missing.length, '/ ya cacheadas:', songs.length - missing.length);

      if (isCancelled.current) return;

      // 5. Todas en cache -> entrar rapido
      if (missing.length === 0) {
        clearInterval(msgTimer.current);
        setMessage('Todo al dia!');
        animateTo(100, 500);
        await new Promise(r => setTimeout(r, 700));
        goHome();
        return;
      }

      // 6. Descargar las que faltan - bloquear hasta terminar las 10
      rotateMessages(MSGS_DOWNLOAD);
      let done = songs.length - missing.length;

      for (const song of missing) {
        if (isCancelled.current) return;
        console.log('[Splash] descargando:', song.title || song.id);
        try {
          await getCachedAudio(song);
          console.log('[Splash] OK:', song.title || song.id);
        } catch (e) {
          console.error('[Splash] fallo:', song.title, e?.message);
          // Fallo -> igual contamos para no bloquear infinito
        }
        done++;
        if (isCancelled.current) return;
        const pct = 28 + Math.round((done / songs.length) * 67);
        animateTo(pct, 350);
        console.log('[Splash] progreso:', done + '/' + songs.length);
      }

      if (isCancelled.current) return;
      console.log('[Splash] LISTO, entrando a Home');
      goHome();
    };

    run();

    return () => {
      isCancelled.current = true;
      clearInterval(msgTimer.current);
    };
  }, []);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.root, { opacity: opacityAnim }]}>
      <StatusBar hidden />
      <ImageBackground
        source={require('../../assets/splash_bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <View style={styles.bottom}>
          <Text style={styles.msg}>{message}</Text>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: barWidth }]} />
          </View>
        </View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bg:   { flex: 1, justifyContent: 'flex-end' },
  bottom: { paddingHorizontal: 30, paddingBottom: 60 },
  msg: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  track: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
});
