import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, ActivityIndicator,
  Modal, TextInput, Animated, Linking,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFandomTheme, INFINITY_ALL_THEME, EPIC_THEME } from '../theme';
import { fetchFandoms, fetchSongs, checkAdminPassword } from '../firebase/firestore';
import { prefetchSongs } from '../utils/audioCache';
import { getUnlockedFandoms, unlockFandom, getUnlockedInfinityFandoms, unlockInfinityFandom } from '../utils/unlockedFandoms';
import { getRandomAd } from '../utils/adManager';
import { getInfinityRecord, getInfinityAllRecord, getEpicRecord } from '../utils/scores';
import { useTheme } from '../context/ThemeContext';
import SideMenu from '../components/SideMenu';

const STORAGE_KEY = 'soundquiz_admin_remembered';

// ── Componente interno de video (necesita hooks propios) ──────────
function AdVideoPlayer({ uri, style, onProgress, onFinish }) {
  const player = useVideoPlayer(uri, p => { p.play(); });
  const hasStartedRef = useRef(false);
  const finishedRef   = useRef(false);

  const triggerFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setTimeout(() => onFinish?.(), 0);
  }, [onFinish]);

  useEvent(player, 'timeUpdate', () => {
    const current  = player.currentTime ?? 0;
    const duration = player.duration    ?? 0;
    if (duration > 0 && current > 0.5) {
      hasStartedRef.current = true;
    }
    if (duration > 0 && hasStartedRef.current) {
      const ratio = current / duration;
      setTimeout(() => onProgress?.(ratio), 0);
      if (ratio >= 0.95) triggerFinish();
    }
  });

  useEvent(player, 'playToEnd', () => {
    if (hasStartedRef.current) triggerFinish();
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

export default function HomeScreen({ navigation }) {
  const { theme: t } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [fandoms,        setFandoms]        = useState([]);
  const [selectedFandom, setSelectedFandom] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [fetchError,     setFetchError]     = useState(false);
  const [cacheStatus,    setCacheStatus]    = useState({});
  const [cacheCount,     setCacheCount]     = useState({}); // { [fandomId]: number } canciones cacheadas
  const [unlockedIds,    setUnlockedIds]    = useState([]);

  // Modal admin
  const [tapCount,   setTapCount]   = useState(0);
  const [showModal,  setShowModal]  = useState(false);
  const [password,   setPassword]   = useState('');
  const [pwError,    setPwError]    = useState(false);
  const [pwChecking, setPwChecking] = useState(false);
  const tapTimer = useRef(null);

  // Modal desbloqueo con video
  const [lockModal,     setLockModal]     = useState(false);
  const [pendingFandom, setPendingFandom] = useState(null);
  const [currentAd,     setCurrentAd]     = useState(null);
  const [adLoading,     setAdLoading]     = useState(false);
  const [adError,       setAdError]       = useState(false);
  const [videoFinished, setVideoFinished] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0); // 0-1
  const videoProgressRef = useRef(0);

  const [infinityRecords, setInfinityRecords] = useState({});
  const [activeTab, setActiveTab] = useState('normal');

  // Desbloqueados en Infinity (independiente de Normal)
  const [unlockedInfinityIds, setUnlockedInfinityIds] = useState([]);

  // Fallback timer anuncios
  const [adFallbackProgress,         setAdFallbackProgress]         = useState(0); // 0-1
  const [infinityAdFallbackProgress,  setInfinityAdFallbackProgress] = useState(0);
  const adFallbackTimer         = useRef(null);
  const infinityAdFallbackTimer = useRef(null);
  const FALLBACK_SECS = 15;

  // Modal desbloqueo Infinity
  const [infinityLockModal,     setInfinityLockModal]     = useState(false);
  const [pendingInfinityFandom, setPendingInfinityFandom] = useState(null);
  const [infinityAd,            setInfinityAd]            = useState(null);
  const [infinityAdLoading,     setInfinityAdLoading]     = useState(false);
  const [infinityAdError,       setInfinityAdError]       = useState(false);
  const [infinityVideoFinished, setInfinityVideoFinished] = useState(false);
  const [infinityVideoProgress, setInfinityVideoProgress] = useState(0);
  const infinityVideoProgressRef = useRef(0);

  const insets = useSafeAreaInsets();
  const listAnim = useRef(new Animated.Value(0)).current;
  const prefetchCancelled = useRef(false);

  useEffect(() => {
    prefetchCancelled.current = false;
    loadFandoms();
    return () => { prefetchCancelled.current = true; };
  }, []);

  // ── Fallback timer Normal ───────────────────────────────────────
  useEffect(() => {
    if (lockModal && !videoFinished) {
      setAdFallbackProgress(0);
      const interval = 100;
      const steps = (FALLBACK_SECS * 1000) / interval;
      let step = 0;
      adFallbackTimer.current = setInterval(() => {
        step++;
        const p = step / steps;
        setAdFallbackProgress(p);
        if (p >= 1) {
          clearInterval(adFallbackTimer.current);
          handleVideoFinish();
        }
      }, interval);
    } else {
      clearInterval(adFallbackTimer.current);
    }
    return () => clearInterval(adFallbackTimer.current);
  }, [lockModal]);

  // ── Fallback timer Infinity ─────────────────────────────────────
  useEffect(() => {
    if (infinityLockModal && !infinityVideoFinished) {
      setInfinityAdFallbackProgress(0);
      const interval = 100;
      const steps = (FALLBACK_SECS * 1000) / interval;
      let step = 0;
      infinityAdFallbackTimer.current = setInterval(() => {
        step++;
        const p = step / steps;
        setInfinityAdFallbackProgress(p);
        if (p >= 1) {
          clearInterval(infinityAdFallbackTimer.current);
          handleInfinityVideoFinish();
        }
      }, interval);
    } else {
      clearInterval(infinityAdFallbackTimer.current);
    }
    return () => clearInterval(infinityAdFallbackTimer.current);
  }, [infinityLockModal]);

  const loadFandoms = async () => {
    setLoading(true);
    setFetchError(false);
    const [data, unlocked, unlockedInfinity] = await Promise.all([
      fetchFandoms(),
      getUnlockedFandoms(),
      getUnlockedInfinityFandoms(),
    ]);
    setUnlockedIds(unlocked);
    setUnlockedInfinityIds(unlockedInfinity);

    if (data === null) {
      setFetchError('network');
    } else if (data?.error) {
      setFetchError(data.code ?? 'unknown');
    } else {
      setFandoms(data);
      if (data.length > 0) {
        const firstId = data[0].id;
        setSelectedFandom(firstId);
        prefetchFandom(firstId);
      }
      // Cargar récords infinity de cada fandom
      const records = {};
      for (const f of data) {
        records[f.id] = await getInfinityRecord(f.id);
      }
      records['__all__'] = await getInfinityAllRecord();
      records['__epic__']  = await getEpicRecord();
      setInfinityRecords(records);
      Animated.spring(listAnim, {
        toValue: 1, useNativeDriver: true,
        tension: 60, friction: 10,
      }).start();
    }
    setLoading(false);
  };

  const prefetchFandom = async (fandomId) => {
    setCacheStatus(prev => {
      if (prev[fandomId] === 'downloading' || prev[fandomId] === 'ready') return prev;
      return { ...prev, [fandomId]: 'downloading' };
    });
    try {
      const songs = await fetchSongs(fandomId);
      if (prefetchCancelled.current) return;
      await prefetchSongs(songs, (downloaded) => {
        if (prefetchCancelled.current) return;
        setCacheCount(prev => ({ ...prev, [fandomId]: downloaded }));
      });
      if (prefetchCancelled.current) return;
      setCacheStatus(prev => ({ ...prev, [fandomId]: 'ready' }));
    } catch (e) {
      setCacheStatus(prev => ({ ...prev, [fandomId]: 'idle' }));
    }
  };

  // ── Admin secret tap ──────────────────────────────────────────
  const handleSecretTap = async () => {
    const remembered = await AsyncStorage.getItem(STORAGE_KEY);
    if (remembered === 'true') { navigation.navigate('Admin'); return; }
    const next = tapCount + 1;
    setTapCount(next);
    clearTimeout(tapTimer.current);
    if (next >= 3) {
      setTapCount(0);
      setPassword('');
      setPwError(false);
      setShowModal(true);
    } else {
      tapTimer.current = setTimeout(() => setTapCount(0), 400);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password || pwChecking) return;
    setPwChecking(true);
    setPwError(false);
    const ok = await checkAdminPassword(password);
    if (ok) {
      setShowModal(false);
      setPassword('');
      setPwChecking(false);
      navigation.navigate('Admin');
    } else {
      setPwError(true);
      setPassword('');
      setPwChecking(false);
    }
  };

  // ── Selección de fandom ───────────────────────────────────────
  const handleSelectFandom = async (fandomId, index) => {
    const unlocked = index === 0 || unlockedIds.includes(fandomId);
    if (!unlocked) {
      setAdLoading(true);
      setAdError(false);
      setVideoFinished(false);
      setVideoProgress(0);
      setPendingFandom({ id: fandomId, index });
      setLockModal(true);

      const ad = await getRandomAd();
      if (!ad) {
        setAdError(true);
      } else {
        setCurrentAd(ad);
      }
      setAdLoading(false);
      return;
    }
    setSelectedFandom(fandomId);
    if (!cacheStatus[fandomId] || cacheStatus[fandomId] === 'idle') {
      prefetchFandom(fandomId);
    }
  };

  const handleVideoProgress = (ratio) => {
    videoProgressRef.current = ratio;
    setVideoProgress(ratio);
  };
  const handleVideoFinish = async () => {
    setVideoFinished(true);
    if (pendingFandom) {
      await unlockFandom(pendingFandom.id);
      setUnlockedIds(prev => [...prev, pendingFandom.id]);
      setSelectedFandom(pendingFandom.id);
      prefetchFandom(pendingFandom.id);
    }
  };

  const closeLockModal = () => {
    setLockModal(false);
    setPendingFandom(null);
    setCurrentAd(null);
    setVideoFinished(false);
    setVideoProgress(0);
    videoProgressRef.current = 0;
  };

  // ── Handlers modal Infinity ─────────────────────────────────────────
  const handleInfinityCardPress = async (fandom, index) => {
    const isUnlocked = unlockedInfinityIds.includes(fandom.id);
    if (isUnlocked) {
      navigation.navigate('Infinity', {
        fandomId:    fandom.id,
        fandomName:  fandom.name,
        theme:       getFandomTheme(fandom.name),
        multiFandom: false,
      });
      return;
    }
    // Pedir anuncio para desbloquear en Infinity
    setInfinityAdLoading(true);
    setInfinityAdError(false);
    setInfinityVideoFinished(false);
    setInfinityVideoProgress(0);
    infinityVideoProgressRef.current = 0;
    setPendingInfinityFandom({ id: fandom.id, index, name: fandom.name, theme: getFandomTheme(fandom.name) });
    setInfinityLockModal(true);
    const ad = await getRandomAd();
    if (!ad) { setInfinityAdError(true); } else { setInfinityAd(ad); }
    setInfinityAdLoading(false);
  };

  const handleInfinityVideoProgress = (ratio) => {
    infinityVideoProgressRef.current = ratio;
    setInfinityVideoProgress(ratio);
  };

  const handleInfinityVideoFinish = async () => {
    setInfinityVideoFinished(true);
    if (pendingInfinityFandom) {
      await unlockInfinityFandom(pendingInfinityFandom.id);
      setUnlockedInfinityIds(prev => [...prev, pendingInfinityFandom.id]);
    }
  };

  const closeInfinityLockModal = () => {
    setInfinityLockModal(false);
    setPendingInfinityFandom(null);
    setInfinityAd(null);
    setInfinityVideoFinished(false);
    setInfinityVideoProgress(0);
    infinityVideoProgressRef.current = 0;
  };

  const handleStart = (fandomId, fandomName) => {
    const fandom = fandoms.find(f => f.id === (fandomId ?? selectedFandom));
    const theme  = getFandomTheme(fandom?.name ?? fandomName ?? '');
    navigation.navigate('Game', { fandomId: fandom?.id ?? fandomId, theme });
  };

  const selectedFandomObj = fandoms.find(f => f.id === selectedFandom);
  const selectedCached     = selectedFandom ? (cacheCount[selectedFandom] ?? 0) : 0;
  const selectedStatus     = selectedFandom ? (cacheStatus[selectedFandom] ?? 'idle') : 'idle';
  const readyToPlay        = selectedStatus === 'ready' || selectedCached >= 10;

  // ── LOADING ───────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.stateWrap}>
        <StatusBar barStyle={t.statusBar} backgroundColor={t.bg} />
        <ActivityIndicator size="large" color="#C44DE8" />
        <Text style={styles.stateText}>Cargando fandoms...</Text>
      </View>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────
  if (fetchError) {
    const isPermission = fetchError === 'permission';
    return (
      <View style={styles.stateWrap}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAFAF7" />
        <Text style={styles.stateEmoji}>{isPermission ? '🔒' : '📡'}</Text>
        <Text style={styles.stateTitle}>
          {isPermission ? 'Acceso restringido' : 'Sin conexión'}
        </Text>
        <Text style={styles.stateSub}>
          {isPermission
            ? 'No tienes permiso para acceder al contenido.'
            : 'No se pudo conectar con el servidor.'}
        </Text>
        {!isPermission && (
          <TouchableOpacity style={styles.retryBtn} onPress={loadFandoms}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── UI PRINCIPAL ──────────────────────────────────────────────
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF7" />

      <View style={[styles.container, { backgroundColor: t.bg }]}>

        {/* HEADER */}
        <View style={[styles.header, { backgroundColor: t.bg, paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={[styles.eyebrow, { color: t.textSub }]}>SOUNDQUIZ</Text>
            <Text style={[styles.heroTitle, { color: t.text }]}>
              Adivina{`\n`}la{' '}
              <Text style={[styles.heroTitleAccent, { color: t.accent }]}>canción</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={[styles.hamburger, { backgroundColor: t.bg2, borderColor: t.border }]}
            activeOpacity={0.7}
          >
            <View style={[styles.hamburgerLine, { backgroundColor: t.text }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: t.text }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: t.text }]} />
          </TouchableOpacity>
        </View>

        {/* TABS */}
        <View style={[styles.tabs, { backgroundColor: t.tabBg }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'normal' && [styles.tabActive, { backgroundColor: t.tabActive }]]}
            onPress={() => setActiveTab('normal')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: t.textSub }, activeTab === 'normal' && { color: t.text }]}>Normal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'infinity' && [styles.tabActive, { backgroundColor: t.tabActive }]]}
            onPress={() => setActiveTab('infinity')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: t.textSub }, activeTab === 'infinity' && { color: t.text }]}>∞ Infinity</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        {/* LISTA DE FANDOMS */}
        {fandoms.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🎵</Text>
            <Text style={styles.emptyText}>No hay fandoms aún.{`\n`}¡Sube canciones desde el panel Admin!</Text>
          </View>
        ) : (
          <Animated.ScrollView
            style={[styles.list, { opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }] }]}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'normal' ? (
              /* ── TAB NORMAL ── */
              fandoms.map((f, i) => {
                const isUnlocked = i === 0 || unlockedIds.includes(f.id);
                const isSelected = selectedFandom === f.id;
                const status     = cacheStatus[f.id] || 'idle';
                const num        = String(i + 1).padStart(2, '0');
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.row, { borderBottomColor: t.divider, backgroundColor: t.bg }, !isUnlocked && styles.rowLocked]}
                    onPress={() => isUnlocked ? handleStart(f.id, f.name) : handleSelectFandom(f.id, i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.rowNum, { color: t.textMuted }, isSelected && { color: t.accent }]}>{num}</Text>
                    <Text style={[styles.rowEmoji, !isUnlocked && styles.rowEmojiLocked]}>
                      {isUnlocked ? f.emoji : '🔒'}
                    </Text>
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowName, { color: t.text }, !isUnlocked && { color: t.textSub }]}>{f.name}</Text>
                      <View style={styles.rowMeta}>
                        {!isUnlocked && (
                          <Text style={[styles.rowUnlockHint, { color: t.text, fontWeight: '700' }]}>Ver video para desbloquear</Text>
                        )}
                      </View>
                    </View>
                    {!isUnlocked ? (
                      <Text style={[styles.lockArrow, { color: t.accent }]}>›</Text>
                    ) : (
                      <View style={styles.rowActions}>
                        {status === 'idle' ? (
                          <View style={[styles.downloadBadge, { backgroundColor: t.bg2, borderColor: t.border }]}><Text style={styles.downloadBadgeText}>⬇</Text></View>
                        ) : status === 'downloading' ? (
                          <View style={[styles.downloadBadge, styles.downloadBadgeBusy, { backgroundColor: t.bg2, borderColor: t.border }]}><ActivityIndicator size={9} color="#C44DE8" /></View>
                        ) : (
                          <View style={[styles.downloadBadge, styles.downloadBadgeDone]}><Text style={styles.downloadBadgeDoneText}>✓</Text></View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              /* ── TAB INFINITY ── */
              <View style={styles.infinitySection}>

                {/* EPIC MODE — siempre arriba, bloqueado hasta 5+ fandoms */}
                {(() => {
                  const epicUnlocked = unlockedIds.length + 1 >= 5;
                  return (
                    <TouchableOpacity
                      style={[styles.infinityCard, { backgroundColor: '#0D0D0D', opacity: epicUnlocked ? 1 : 0.75 }]}
                      onPress={() => {
                        if (!epicUnlocked) return;
                        navigation.navigate('Infinity', {
                          fandomId: null, fandomName: 'Epic Mode',
                          theme: EPIC_THEME, multiFandom: true, mode: 'epic',
                        });
                      }}
                      activeOpacity={epicUnlocked ? 0.85 : 1}
                    >
                      <View style={styles.infinityCardLeft}>
                        <Text style={styles.infinityCardEmoji}>{epicUnlocked ? '👑' : '🔒'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.infinityCardTitle, { color: '#F59E0B' }]}>EPIC MODE</Text>
                          {epicUnlocked
                            ? <Text style={styles.infinityCardSub}>Todos los fandoms · máxima dificultad</Text>
                            : <Text style={[styles.infinityCardSub, { color: '#F59E0B99' }]}>Desbloquea 5 fandoms para activar</Text>
                          }
                        </View>
                      </View>
                      <View style={styles.infinityCardRight}>
                        {epicUnlocked && infinityRecords['__epic__'] > 0 && (
                          <View style={styles.infinityCardRecord}>
                            <Text style={[styles.infinityCardRecordNum, { color: '#F59E0B' }]}>{infinityRecords['__epic__']}</Text>
                            <Text style={[styles.infinityCardRecordLabel, { color: 'rgba(245,158,11,0.6)' }]}>RACHA</Text>
                          </View>
                        )}
                        {!epicUnlocked && (
                          <View style={styles.epicLockBadge}>
                            <Text style={styles.epicLockBadgeText}>5 fandoms</Text>
                          </View>
                        )}
                        <View style={[styles.infinityCardBadge, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: epicUnlocked ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.2)' }]}>
                          <Text style={[styles.infinityCardBadgeText, { color: epicUnlocked ? '#F59E0B' : 'rgba(245,158,11,0.4)' }]}>∞</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {/* Infinity Fandoms — solo si 5+ desbloqueados, tema ROJO */}
                {unlockedIds.length + 1 >= 5 && (
                  <TouchableOpacity
                    style={[styles.infinityCard, { backgroundColor: '#DC2626' }]}
                    onPress={() => navigation.navigate('Infinity', {
                      fandomId: null, fandomName: 'Infinity Fandoms',
                      theme: INFINITY_ALL_THEME, multiFandom: true, mode: 'infinityAll',
                    })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.infinityCardLeft}>
                      <Text style={styles.infinityCardEmoji}>🌍</Text>
                      <View>
                        <Text style={styles.infinityCardTitle}>INFINITY FANDOMS</Text>
                        <Text style={styles.infinityCardSub}>Todos los fandoms mezclados</Text>
                      </View>
                    </View>
                    <View style={styles.infinityCardRight}>
                      {infinityRecords['__all__'] > 0 && (
                        <View style={styles.infinityCardRecord}>
                          <Text style={styles.infinityCardRecordNum}>{infinityRecords['__all__']}</Text>
                          <Text style={styles.infinityCardRecordLabel}>RACHA</Text>
                        </View>
                      )}
                      <View style={[styles.infinityCardBadge, { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.4)' }]}>
                        <Text style={[styles.infinityCardBadgeText, { color: '#fff' }]}>∞</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Fandoms individuales */}
                {fandoms.map((f, i) => {
                  const isUnlocked = unlockedInfinityIds.includes(f.id);
                  return (
                    <TouchableOpacity
                      key={f.id + '_inf'}
                      style={[styles.infinityCard, !isUnlocked && { opacity: 0.7 }]}
                      onPress={() => handleInfinityCardPress(f, i)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.infinityCardLeft}>
                        <Text style={styles.infinityCardEmoji}>{isUnlocked ? f.emoji : '🔒'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.infinityCardTitle}>{f.name}</Text>
                          {isUnlocked
                            ? <Text style={styles.infinityCardSub}>Sin límite · 1 error = fin</Text>
                            : <Text style={[styles.infinityCardSub, { color: '#fff', fontWeight: '700' }]}>Ver anuncio para desbloquear</Text>
                          }
                        </View>
                      </View>
                      <View style={styles.infinityCardRight}>
                        {isUnlocked && infinityRecords[f.id] > 0 && (
                          <View style={styles.infinityCardRecord}>
                            <Text style={styles.infinityCardRecordNum}>{infinityRecords[f.id]}</Text>
                            <Text style={styles.infinityCardRecordLabel}>RACHA</Text>
                          </View>
                        )}
                        <View style={[styles.infinityCardBadge, !isUnlocked && { backgroundColor: 'rgba(196,77,232,0.08)', borderColor: 'rgba(196,77,232,0.2)' }]}>
                          <Text style={[styles.infinityCardBadgeText, !isUnlocked && { color: 'rgba(196,77,232,0.35)' }]}>∞</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Infinity Fandoms — solo si 5+ desbloqueados, tema ROJO — YA ESTÁ ARRIBA */}

                <TouchableOpacity onPress={handleSecretTap} activeOpacity={1} style={styles.disclaimer}>
                  <Text style={[styles.disclaimerText, { color: t.textMuted }]}>
                    Proyecto de fans, hecho para fans · Sin fines de lucro{`\n`}La compra de productos en nuestros anuncios nos ayuda a mantener los servidores del juego activos.{`\n`}El equipo de Dedika Studio, Gema Studios y Eter Kpop te agradece 💜
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'normal' && (
              <TouchableOpacity onPress={handleSecretTap} activeOpacity={1} style={styles.disclaimer}>
                <Text style={[styles.disclaimerText, { color: t.textMuted }]}>
                  Proyecto de fans, hecho para fans · Sin fines de lucro{`\n`}La compra de productos en nuestros anuncios nos ayuda a mantener los servidores del juego activos.{`\n`}El equipo de Dedika Studio, Gema Studios y Eter Kpop te agradece 💜
                </Text>
              </TouchableOpacity>
            )}
          </Animated.ScrollView>
        )}
      </View>

      {/* MODAL ADMIN */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalEmoji}>🔒</Text>
            <Text style={styles.modalTitle}>Acceso Admin</Text>
            <TextInput
              style={[styles.modalInput, pwError && styles.modalInputError]}
              placeholder="Contraseña"
              placeholderTextColor="#A89F8C"
              secureTextEntry
              value={password}
              onChangeText={t => { setPassword(t); setPwError(false); }}
              autoFocus
              editable={!pwChecking}
              onSubmitEditing={handlePasswordSubmit}
            />
            {pwError && <Text style={styles.modalError}>Contraseña incorrecta</Text>}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setShowModal(false); setPassword(''); setPwError(false); }}
                disabled={pwChecking}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, pwChecking && { opacity: 0.6 }]}
                onPress={handlePasswordSubmit}
                disabled={pwChecking}
              >
                {pwChecking
                  ? <ActivityIndicator color="#FAFAF7" size="small" />
                  : <Text style={styles.modalConfirmText}>Entrar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DESBLOQUEO CON VIDEO — pantalla completa */}
      <Modal visible={lockModal} transparent={false} animationType="slide" onRequestClose={() => { if (videoFinished) closeLockModal(); }} statusBarTranslucent>
        <View style={[styles.videoScreen, { paddingTop: insets.top }]}>

          {/* Barra superior: título + X */}
          <View style={styles.videoTopBar}>
            <Text style={styles.videoTopTitle}>
              {videoFinished ? '🎉 ¡Normal desbloqueado!' : '🎬 Mira el anuncio completo'}
            </Text>
            {videoFinished && (
              <TouchableOpacity onPress={closeLockModal} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Barra fallback 15s */}
          {!videoFinished && (
            <View style={styles.fallbackBar}>
              <View style={[styles.fallbackFill, { width: `${adFallbackProgress * 100}%` }]} />
              <Text style={styles.fallbackText}>
                {Math.ceil(FALLBACK_SECS * (1 - adFallbackProgress))}s
              </Text>
            </View>
          )}

          {/* ZONA CENTRAL: video o estados de carga/error */}
          {adLoading ? (
            <View style={styles.adCenterWrap}>
              <ActivityIndicator size="large" color="#C44DE8" />
              <Text style={styles.adLoadingText}>Cargando video...</Text>
            </View>
          ) : adError ? (
            <View style={styles.adCenterWrap}>
              <Text style={styles.adErrorEmoji}>📡</Text>
              <Text style={styles.adErrorText}>No hay anuncios disponibles en este momento.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={closeLockModal}>
                <Text style={styles.retryText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          ) : currentAd ? (
            <AdVideoPlayer
              uri={currentAd.videoUrl}
              style={styles.videoFull}
              onProgress={handleVideoProgress}
              onFinish={handleVideoFinish}
            />
          ) : null}

          {/* ZONA INFERIOR: progreso + info del producto — siempre visible cuando hay anuncio */}
          {currentAd && !adLoading && !adError && (
            <View style={[styles.videoBottomPanel, { paddingBottom: insets.bottom + 24 }]}>
              {/* Barra de progreso */}
              <View style={styles.videoProgressTrack}>
                <View style={[styles.videoProgressFill, { width: `${videoProgress * 100}%` }]} />
              </View>

              <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {currentAd.productTitle}
                </Text>
                <TouchableOpacity
                  style={styles.productBtn}
                  onPress={() => Linking.openURL(currentAd.productUrl)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.productBtnText}>
                    {'🛍 Ver producto en Mercado Libre'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>
      </Modal>
      {/* MODAL DESBLOQUEO INFINITY CON VIDEO */}
      <Modal visible={infinityLockModal} transparent={false} animationType="slide" onRequestClose={() => { if (infinityVideoFinished) closeInfinityLockModal(); }} statusBarTranslucent>
        <View style={[styles.videoScreen, { paddingTop: insets.top }]}>
          <View style={styles.videoTopBar}>
            <Text style={styles.videoTopTitle}>
              {infinityVideoFinished ? '🎉 ¡Infinity desbloqueado!' : '🎥 Mira el anuncio completo'}
            </Text>
            {infinityVideoFinished && (
              <TouchableOpacity onPress={closeInfinityLockModal} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Barra fallback 15s */}
          {!infinityVideoFinished && (
            <View style={styles.fallbackBar}>
              <View style={[styles.fallbackFill, { width: `${infinityAdFallbackProgress * 100}%` }]} />
              <Text style={styles.fallbackText}>
                {Math.ceil(FALLBACK_SECS * (1 - infinityAdFallbackProgress))}s
              </Text>
            </View>
          )}

          {infinityAdLoading ? (
            <View style={styles.adCenterWrap}>
              <ActivityIndicator size="large" color="#C44DE8" />
              <Text style={styles.adLoadingText}>Cargando video...</Text>
            </View>
          ) : infinityAdError ? (
            <View style={styles.adCenterWrap}>
              <Text style={styles.adErrorEmoji}>📡</Text>
              <Text style={styles.adErrorText}>No hay anuncios disponibles en este momento.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={closeInfinityLockModal}>
                <Text style={styles.retryText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          ) : infinityAd ? (
            <AdVideoPlayer
              uri={infinityAd.videoUrl}
              style={styles.videoFull}
              onProgress={handleInfinityVideoProgress}
              onFinish={handleInfinityVideoFinish}
            />
          ) : null}

          {infinityAd && !infinityAdLoading && !infinityAdError && (
            <View style={[styles.videoBottomPanel, { paddingBottom: insets.bottom + 24 }]}>
              <View style={styles.videoProgressTrack}>
                <View style={[styles.videoProgressFill, { width: `${infinityVideoProgress * 100}%` }]} />
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={2}>{infinityAd.productTitle}</Text>
                <TouchableOpacity style={styles.productBtn} onPress={() => Linking.openURL(infinityAd.productUrl)} activeOpacity={0.8}>
                  <Text style={styles.productBtnText}>{'🛍 Ver producto en Mercado Libre'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
      <SideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} navigation={navigation} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF7' },

  stateWrap:  { flex: 1, backgroundColor: '#FAFAF7', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  stateEmoji: { fontSize: 48 },
  stateTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a14', textAlign: 'center' },
  stateSub:   { fontSize: 13, color: '#A89F8C', textAlign: 'center', lineHeight: 20 },
  stateText:  { fontSize: 14, color: '#A89F8C' },
  retryBtn:   { marginTop: 8, backgroundColor: '#1a1a14', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  retryText:  { color: '#FAFAF7', fontSize: 14, fontWeight: '600' },

  header: {
    paddingHorizontal: 24, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  hamburger: {
    width: 46, height: 46, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: 2,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  hamburgerLine: {
    width: 20, height: 2, borderRadius: 2,
  },
  eyebrow:         { fontSize: 9, letterSpacing: 3, color: '#A89F8C', fontWeight: '600', marginBottom: 6 },
  heroTitle:       { fontSize: 36, fontWeight: '900', color: '#1a1a14', letterSpacing: -2, lineHeight: 38 },
  heroTitleAccent: { color: '#C44DE8' },

  tabs: {
    flexDirection: 'row', marginHorizontal: 24, marginBottom: 12,
    backgroundColor: '#F0EDE6', borderRadius: 12, padding: 3, gap: 3,
  },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
  },
  tabActive: { backgroundColor: '#FAFAF7', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  tabText:       { fontSize: 13, fontWeight: '600', color: '#A89F8C' },
  tabTextActive: { color: '#1a1a14' },

  divider: { height: 1, backgroundColor: '#E8E5DE', marginHorizontal: 24 },

  list: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 16, paddingHorizontal: 24,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE6',
  },
  rowSelected:    { backgroundColor: '#FAF5FF' },
  rowLocked:      { opacity: 0.75 },
  rowNum:         { fontSize: 13, fontWeight: '900', color: '#D4C8E0', width: 22, flexShrink: 0 },
  rowNumSelected: { color: '#C44DE8' },
  rowEmoji:       { fontSize: 26, flexShrink: 0 },
  rowEmojiLocked: { opacity: 0.5 },
  rowInfo:        { flex: 1 },
  rowName:        { fontSize: 15, fontWeight: '700', color: '#2a2420', letterSpacing: -0.3 },
  rowNameSelected:{ color: '#7C3AED' },
  rowNameLocked:  { color: '#A89F8C' },
  rowMeta:        { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  rowSongs:       { fontSize: 11, color: '#A89F8C', fontWeight: '400' },
  rowWarning:     { fontSize: 11, color: '#E07830', fontWeight: '500' },
  rowUnlockHint:  { fontSize: 11, color: '#C44DE8', fontWeight: '500' },
  lockArrow:      { fontSize: 18, color: '#C44DE8', fontWeight: '700' },
  downloadBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F3E8FF',
    borderWidth: 1.5, borderColor: '#E9D5FF',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  downloadBadgeBusy: {
    backgroundColor: '#F5F3FF',
    borderColor: '#C4B5FD',
  },
  downloadBadgeDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  downloadBadgeText:     { fontSize: 13 },
  downloadBadgeDoneText: { fontSize: 13, color: '#10B981', fontWeight: '700' },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyText:  { fontSize: 14, color: '#A89F8C', textAlign: 'center', lineHeight: 22 },

  footer:       { padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: '#E8E5DE', backgroundColor: '#FAFAF7', gap: 10 },
  footerSub:    { fontSize: 11, color: '#A89F8C', textAlign: 'center', letterSpacing: 0.2 },
  footerFandom: { color: '#7C3AED', fontWeight: '700' },
  startBtn:         { backgroundColor: '#1a1a14', borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  startBtnDisabled: { opacity: 0.35 },
  startBtnText:     { color: '#FAFAF7', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  rowInfinityRecord: { fontSize: 11, color: '#C44DE8', fontWeight: '600' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // ── Infinity Mode section ──
  infinitySection: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, gap: 10 },
  infinitySectionLabel: {
    fontSize: 10, letterSpacing: 3, color: '#A89F8C',
    fontWeight: '700', marginBottom: 4, paddingHorizontal: 4,
  },
  infinityCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1a1a14',
    borderRadius: 18, padding: 18,
  },
  infinityCardLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  infinityCardEmoji: { fontSize: 30 },
  infinityCardTitle: { fontSize: 15, fontWeight: '800', color: '#FAFAF7', letterSpacing: -0.3 },
  infinityCardSub:   { fontSize: 11, color: 'rgba(250,250,247,0.45)', marginTop: 2 },
  infinityCardRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infinityCardRecord: { alignItems: 'center' },
  infinityCardRecordNum:   { fontSize: 20, fontWeight: '900', color: '#F59E0B', lineHeight: 22 },
  infinityCardRecordLabel: { fontSize: 8,  fontWeight: '700', color: 'rgba(245,158,11,0.6)', letterSpacing: 1.5 },
  infinityCardBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(196,77,232,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(196,77,232,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  infinityCardBadgeText: { fontSize: 22, color: '#C44DE8', fontWeight: '900', lineHeight: 26 },

  epicLockBadge: {
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  epicLockBadgeText: {
    fontSize: 10, fontWeight: '700',
    color: 'rgba(245,158,11,0.5)',
    letterSpacing: 0.5,
  },

  // Infinity Fandoms global button
  infinityAllBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#1a1a14',
    borderRadius: 16, padding: 16,
  },
  infinityAllLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infinityAllIcon:   { fontSize: 24 },
  infinityAllTitle:  { fontSize: 12, fontWeight: '800', color: '#FAFAF7', letterSpacing: 1.5 },
  infinityAllSub:    { fontSize: 11, color: 'rgba(250,250,247,0.55)', marginTop: 1 },
  infinityAllRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infinityAllRecord: { fontSize: 13, color: '#F59E0B', fontWeight: '700' },
  infinityAllArrow:  { fontSize: 20, color: '#FAFAF7', fontWeight: '700' },

  disclaimer:     { padding: 28, alignItems: 'center' },
  disclaimerText: { fontSize: 10, color: '#C8C3BA', textAlign: 'center', lineHeight: 16, letterSpacing: 0.3 },

  // Modal admin
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalBox:     { width: 300, backgroundColor: '#FAFAF7', borderRadius: 20, padding: 28, alignItems: 'center', gap: 14 },
  modalEmoji:   { fontSize: 32 },
  modalTitle:   { fontSize: 17, fontWeight: '700', color: '#1a1a14' },
  modalInput: {
    width: '100%', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8E5DE',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 16, color: '#1a1a14', textAlign: 'center', letterSpacing: 4,
  },
  modalInputError: { borderColor: '#EF4444' },
  modalError:      { fontSize: 12, color: '#EF4444' },
  modalBtns:       { flexDirection: 'row', gap: 10, width: '100%' },
  modalCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E8E5DE', alignItems: 'center',
  },
  modalCancelText:  { fontSize: 14, color: '#A89F8C', fontWeight: '600' },
  modalConfirm: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#1a1a14', alignItems: 'center',
  },
  modalConfirmText: { fontSize: 14, color: '#FAFAF7', fontWeight: '600' },

  // Pantalla completa de video
  videoScreen: {
    flex: 1, backgroundColor: '#000',
    flexDirection: 'column',
  },
  videoTopBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#000',
  },
  videoTopTitle:   { fontSize: 15, fontWeight: '700', color: '#FAFAF7', flex: 1 },
  closeBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginLeft: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  closeBtnText:    { fontSize: 16, color: '#FAFAF7', fontWeight: '800' },

  videoFull: { flex: 1, width: '100%', backgroundColor: '#000' },

  videoBottomPanel: {
    backgroundColor: '#FAFAF7',
  },
  videoProgressTrack: { height: 5, backgroundColor: '#E8E5DE', width: '100%' },
  videoProgressFill:  { height: '100%', backgroundColor: '#C44DE8' },

  productInfo:  { padding: 20, gap: 12 },
  productTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a14', lineHeight: 22 },
  productBtn: {
    backgroundColor: '#FFE600', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  productBtnText:       { fontSize: 14, fontWeight: '700', color: '#1a1a14' },

  adCenterWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  adLoadingText: { fontSize: 13, color: '#A89F8C' },
  adErrorEmoji:  { fontSize: 48 },
  adErrorText:   { fontSize: 13, color: '#A89F8C', textAlign: 'center', paddingHorizontal: 32 },

  fallbackBar: {
    height: 28, backgroundColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, gap: 8,
  },
  fallbackFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(196,77,232,0.35)',
  },
  fallbackText: {
    fontSize: 11, color: 'rgba(255,255,255,0.5)',
    fontWeight: '600', letterSpacing: 0.5,
    marginLeft: 'auto',
  },
});
