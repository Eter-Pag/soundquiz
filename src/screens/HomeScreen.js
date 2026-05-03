import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, ActivityIndicator,
  Modal, TextInput, Animated, Linking,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFandomTheme } from '../theme';
import { fetchFandoms, fetchSongs, checkAdminPassword } from '../firebase/firestore';
import { prefetchSongs } from '../utils/audioCache';
import { getUnlockedFandoms, unlockFandom } from '../utils/unlockedFandoms';
import { getRandomAd } from '../utils/adManager';

const STORAGE_KEY = 'soundquiz_admin_remembered';

// ── Componente interno de video (necesita hooks propios) ──────────
function AdVideoPlayer({ uri, style, onProgress, onFinish }) {
  const player = useVideoPlayer(uri, p => { p.play(); });

  useEvent(player, 'timeUpdate', () => {
    const current  = player.currentTime ?? 0;
    const duration = player.duration    ?? 0;
    if (duration > 0) {
      const ratio = current / duration;
      setTimeout(() => onProgress?.(ratio), 0);
    }
  });

  useEvent(player, 'playToEnd', () => {
    setTimeout(() => onFinish?.(), 0);
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

  const insets = useSafeAreaInsets();
  const listAnim = useRef(new Animated.Value(0)).current;
  const prefetchCancelled = useRef(false);

  useEffect(() => {
    prefetchCancelled.current = false;
    loadFandoms();
    return () => { prefetchCancelled.current = true; };
  }, []);

  const loadFandoms = async () => {
    setLoading(true);
    setFetchError(false);
    const [data, unlocked] = await Promise.all([
      fetchFandoms(),
      getUnlockedFandoms(),
    ]);
    setUnlockedIds(unlocked);

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
    // Si el progreso llega al 95% o más lo consideramos terminado
    // (por si playToEnd no dispara correctamente)
    if (ratio >= 0.95 && !videoFinished) {
      handleVideoFinish();
    }
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

  const handleStart = () => {
    if (!selectedFandom) return;
    const fandom = fandoms.find(f => f.id === selectedFandom);
    const theme  = getFandomTheme(fandom?.name ?? '');
    navigation.navigate('Game', { fandomId: selectedFandom, theme });
  };

  const selectedFandomObj = fandoms.find(f => f.id === selectedFandom);
  const selectedCached     = selectedFandom ? (cacheCount[selectedFandom] ?? 0) : 0;
  const selectedStatus     = selectedFandom ? (cacheStatus[selectedFandom] ?? 'idle') : 'idle';
  const readyToPlay        = selectedStatus === 'ready' || selectedCached >= 10;

  // ── LOADING ───────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.stateWrap}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAFAF7" />
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

      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SOUNDQUIZ</Text>
            <Text style={styles.heroTitle}>
              Adivina{`\n`}la{' '}
              <Text style={styles.heroTitleAccent}>canción</Text>
            </Text>
            <Text style={styles.heroSub}>Selecciona tu fandom y comienza</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* LISTA DE FANDOMS */}
        {fandoms.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🎵</Text>
            <Text style={styles.emptyText}>No hay fandoms aún.{`\n`}¡Sube canciones desde el panel Admin!</Text>
          </View>
        ) : (
          <Animated.ScrollView
            style={[
              styles.list,
              {
                opacity: listAnim,
                transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {fandoms.map((f, i) => {
              const isUnlocked = i === 0 || unlockedIds.includes(f.id);
              const isSelected = selectedFandom === f.id;
              const hasEnough  = f.songCount >= 10;
              const status     = cacheStatus[f.id] || 'idle';
              const num        = String(i + 1).padStart(2, '0');

              return (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.row,
                    isSelected && styles.rowSelected,
                    !isUnlocked && styles.rowLocked,
                  ]}
                  onPress={() => handleSelectFandom(f.id, i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rowNum, isSelected && styles.rowNumSelected]}>{num}</Text>
                  <Text style={[styles.rowEmoji, !isUnlocked && styles.rowEmojiLocked]}>
                    {isUnlocked ? f.emoji : '🔒'}
                  </Text>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, isSelected && styles.rowNameSelected, !isUnlocked && styles.rowNameLocked]}>
                      {f.name}
                    </Text>
                    <View style={styles.rowMeta}>
                      {isUnlocked ? (
                        <>
                          <Text style={styles.rowSongs}>
                            {f.songCount} {f.songCount === 1 ? 'canción' : 'canciones'}
                          </Text>
                          {!hasEnough && <Text style={styles.rowWarning}> · pocas canciones</Text>}
                        </>
                      ) : (
                        <Text style={styles.rowUnlockHint}>Ver video para desbloquear</Text>
                      )}
                    </View>
                  </View>
                  {/* Indicador de estado de caché / candado */}
                  {!isUnlocked ? (
                    <Text style={styles.lockArrow}>›</Text>
                  ) : status === 'idle' ? (
                    <View style={styles.downloadBadge}>
                      <Text style={styles.downloadBadgeText}>⬇</Text>
                    </View>
                  ) : status === 'downloading' ? (
                    <View style={[styles.downloadBadge, styles.downloadBadgeBusy]}>
                      <ActivityIndicator size={9} color="#C44DE8" />
                    </View>
                  ) : (
                    <View style={[styles.downloadBadge, styles.downloadBadgeDone]}>
                      <Text style={styles.downloadBadgeDoneText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity onPress={handleSecretTap} activeOpacity={1} style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                Proyecto de fans · sin fines de lucro · los anuncios costean los servidores
              </Text>
            </TouchableOpacity>
          </Animated.ScrollView>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          {selectedFandomObj && (
            <Text style={styles.footerSub}>
              {readyToPlay
                ? <>Jugando con <Text style={styles.footerFandom}>{selectedFandomObj.name}</Text>{' · 10 preguntas'}</>
                : <>⏬ Descargando <Text style={styles.footerFandom}>{selectedFandomObj.name}</Text>{`… ${selectedCached}/10`}</>
              }
            </Text>
          )}
          <TouchableOpacity
            style={[styles.startBtn, (!selectedFandom || !readyToPlay) && styles.startBtnDisabled]}
            onPress={handleStart}
            activeOpacity={0.88}
            disabled={!selectedFandom || !readyToPlay}
          >
            <Text style={styles.startBtnText}>
              {!readyToPlay && selectedStatus === 'downloading' ? `Descargando ${selectedCached}/10...` : 'Comenzar'}
            </Text>
          </TouchableOpacity>
        </View>
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
      <Modal visible={lockModal} transparent={false} animationType="slide" onRequestClose={closeLockModal} statusBarTranslucent>
        <View style={[styles.videoScreen, { paddingTop: insets.top }]}>

          {/* Barra superior: título + X siempre visible */}
          <View style={styles.videoTopBar}>
            <Text style={styles.videoTopTitle}>
              {videoFinished ? '🎉 ¡Desbloqueado!' : '🎬 Mira el anuncio completo'}
            </Text>
            {videoFinished && (
              <TouchableOpacity onPress={closeLockModal} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

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

  header:          { paddingTop: 64, paddingHorizontal: 24, paddingBottom: 20 },
  eyebrow:         { fontSize: 9, letterSpacing: 3, color: '#A89F8C', fontWeight: '600', marginBottom: 8 },
  heroTitle:       { fontSize: 48, fontWeight: '900', color: '#1a1a14', letterSpacing: -2.5, lineHeight: 50, marginBottom: 10 },
  heroTitleAccent: { color: '#C44DE8' },
  heroSub:         { fontSize: 12, color: '#A89F8C', fontWeight: '400', letterSpacing: 0.2 },

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
});
