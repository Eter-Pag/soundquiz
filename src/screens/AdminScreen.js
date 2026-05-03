import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, StatusBar,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { Video } from 'expo-av';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, setDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { storage, db } from '../firebase/config';
import { colors } from '../theme';
import { deleteSong, fetchSongs, fetchAds, deleteAd } from '../firebase/firestore';

const STORAGE_KEY = 'soundquiz_admin_remembered';

export default function AdminScreen({ navigation }) {
  const [fandoms,    setFandoms]    = useState([]);
  const [fandomId,   setFandomId]   = useState(null);
  const [title,      setTitle]      = useState('');

  const [audioFile,  setAudioFile]  = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [remembered, setRemembered] = useState(false);

  // Lista de canciones
  const [songs,        setSongs]        = useState([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [deletingId,   setDeletingId]   = useState(null);

  // ── Modal nuevo fandom ──
  const [showNewFandom,  setShowNewFandom]  = useState(false);
  const [newFandomName,  setNewFandomName]  = useState('');
  const [newFandomEmoji, setNewFandomEmoji] = useState('');
  const [savingFandom,   setSavingFandom]   = useState(false);

  // ── Modal editar canción ──
  const [editSong,      setEditSong]      = useState(null); // song object | null
  const [editTitle,     setEditTitle]     = useState('');

  const [savingEdit,    setSavingEdit]    = useState(false);

  // ── Vista previa de audio ──
  const [previewSound,   setPreviewSound]   = useState(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Anuncios de afiliado ──
  const [ads,           setAds]           = useState([]);
  const [loadingAds,    setLoadingAds]    = useState(false);
  const [deletingAdId,  setDeletingAdId]  = useState(null);
  const [adVideoFile,   setAdVideoFile]   = useState(null);
  const [adProductUrl,  setAdProductUrl]  = useState('');
  const [adProductTitle,setAdProductTitle]= useState('');
  const [uploadingAd,   setUploadingAd]   = useState(false);
  const [adProgress,    setAdProgress]    = useState(0);

  const soundRef = useRef(null);

  useEffect(() => {
    loadFandoms();
    loadAds();
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val === 'true') setRemembered(true);
    });
    // Limpiar audio al desmontar
    return () => { stopPreview(); };
  }, []);

  const loadAds = async () => {
    setLoadingAds(true);
    const list = await fetchAds();
    setAds(list);
    setLoadingAds(false);
  };

  useEffect(() => {
    if (!fandomId) return;
    setLoadingSongs(true);
    fetchSongs(fandomId).then(list => {
      setSongs(list.sort((a, b) => (a.title || '').localeCompare(b.title || '')));
      setLoadingSongs(false);
    });
  }, [fandomId]);

  // ── Detener preview al cambiar de fandom ──
  useEffect(() => { stopPreview(); }, [fandomId]);

  // ── Audio preview ────────────────────────────────────────────

  const stopPreview = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPreviewPlaying(false);
    setPreviewSound(null);
  };

  const togglePreview = async () => {
    if (!audioFile) return;

    // Si ya está sonando → parar
    if (previewPlaying) { await stopPreview(); return; }

    setPreviewLoading(true);
    try {
      await stopPreview();
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioFile.uri },
        { positionMillis: 0 }
      );
      soundRef.current = sound;
      setPreviewSound(sound);
      await sound.playAsync();
      setPreviewPlaying(true);

      // Auto-parar cuando termina
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) {
          setPreviewPlaying(false);
          soundRef.current = null;
          setPreviewSound(null);
        }
      });
    } catch (e) {
      Alert.alert('Error', 'No se pudo reproducir el audio: ' + e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Fandoms ──────────────────────────────────────────────────

  const loadFandoms = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'fandoms'));
      const songSnap = await getDocs(collection(db, 'songs'));
      const counts   = {};
      songSnap.docs.forEach(d => {
        const fid = d.data().fandomId;
        counts[fid] = (counts[fid] || 0) + 1;
      });
      const list = snapshot.docs.map(d => ({
        id: d.id, ...d.data(),
        songCount: counts[d.id] || 0,
      }));
      setFandoms(list);
      if (list.length > 0 && !fandomId) setFandomId(list[0].id);
    } catch (e) {
      console.error('Error cargando fandoms:', e);
    }
  };

  const toggleRemember = async () => {
    const next = !remembered;
    setRemembered(next);
    if (next) await AsyncStorage.setItem(STORAGE_KEY, 'true');
    else      await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const handleCreateFandom = async () => {
    const name  = newFandomName.trim();
    const emoji = newFandomEmoji.trim() || '🎵';
    if (!name) { Alert.alert('Falta el nombre', 'Escribe el nombre del fandom.'); return; }
    setSavingFandom(true);
    try {
      const id = name.toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(db, 'fandoms', id), { id, name, emoji }, { merge: true });
      setShowNewFandom(false);
      setNewFandomName('');
      setNewFandomEmoji('');
      await loadFandoms();
      setFandomId(id);
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear el fandom: ' + e.message);
    } finally {
      setSavingFandom(false);
    }
  };

  // ── Subir canción ─────────────────────────────────────────────

  const pickAudio = async () => {
    try {
      await stopPreview();
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) setAudioFile(result.assets[0]);
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  const handleUpload = async () => {
    if (!title || !audioFile) {
      Alert.alert('Faltan datos', 'Completa el título y selecciona un audio.');
      return;
    }
    await stopPreview();
    setUploading(true);
    setProgress(0);
    try {
      const fandom     = fandoms.find(f => f.id === fandomId);
      const fileName   = `audio/${fandomId}/${Date.now()}_${audioFile.name}`;
      const storageRef = ref(storage, fileName);
      const response   = await fetch(audioFile.uri);
      const blob       = await response.blob();

      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, blob);
        task.on('state_changed',
          snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject, resolve
        );
      });

      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'songs'), {
        title,
        fandomId,
        isClip:      true,
        audioUrl:    downloadURL,
        storagePath: fileName,
        createdAt:   new Date(),
      });

      await setDoc(doc(db, 'fandoms', fandomId), {
        id: fandom.id, name: fandom.name, emoji: fandom.emoji,
      }, { merge: true });

      Alert.alert('✅ ¡Listo!', `"${title}" subida correctamente.`);
      setTitle('');
      setAudioFile(null);

      await loadFandoms();
      const updated = await fetchSongs(fandomId);
      setSongs(updated.sort((a, b) => (a.title || '').localeCompare(b.title || '')));

    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo subir la canción: ' + e.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  // ── Reemplazar audio (migrar canción legacy a clip) ──────────────────────

  const [replacingSong, setReplacingSong] = useState(null); // song object | null
  const [replaceFile,   setReplaceFile]   = useState(null);
  const [replacingId,   setReplacingId]   = useState(null);

  const openReplaceModal = (song) => {
    setReplacingSong(song);
    setReplaceFile(null);
  };

  const pickReplaceAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) setReplaceFile(result.assets[0]);
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  const handleReplaceAudio = async () => {
    if (!replaceFile) {
      Alert.alert('Falta el audio', 'Selecciona el nuevo clip de 20s.');
      return;
    }
    setReplacingId(replacingSong.id);
    try {
      // Subir nuevo archivo
      const fileName   = `audio/${replacingSong.fandomId}/${Date.now()}_${replaceFile.name}`;
      const storageRef = ref(storage, fileName);
      const response   = await fetch(replaceFile.uri);
      const blob       = await response.blob();

      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, blob);
        task.on('state_changed', null, reject, resolve);
      });

      const downloadURL = await getDownloadURL(storageRef);

      // Borrar archivo viejo de Storage
      if (replacingSong.storagePath) {
        await deleteObject(ref(storage, replacingSong.storagePath)).catch(() => {});
      }

      // Actualizar Firestore
      await updateDoc(doc(db, 'songs', replacingSong.id), {
        audioUrl:    downloadURL,
        storagePath: fileName,
        isClip:      true,
        playStart:   null,
        playEnd:     null,
      });

      // Actualizar lista local
      setSongs(prev => prev.map(s =>
        s.id === replacingSong.id
          ? { ...s, audioUrl: downloadURL, storagePath: fileName, isClip: true, playStart: null, playEnd: null }
          : s
      ));

      Alert.alert('✅ ¡Listo!', `Audio de "${replacingSong.title}" reemplazado.`);
      setReplacingSong(null);
      setReplaceFile(null);
    } catch (e) {
      Alert.alert('Error', 'No se pudo reemplazar: ' + e.message);
    } finally {
      setReplacingId(null);
    }
  };

  // ── Eliminar canción ─────────────────────────────────────────

  const handleDeleteSong = (song) => {
    Alert.alert(
      'Eliminar canción',
      `¿Seguro que quieres eliminar "${song.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            setDeletingId(song.id);
            try {
              await deleteSong(song.id);
              if (song.storagePath) {
                await deleteObject(ref(storage, song.storagePath)).catch(() => {});
              }
              setSongs(prev => prev.filter(s => s.id !== song.id));
              setFandoms(prev => prev.map(f =>
                f.id === fandomId ? { ...f, songCount: Math.max(0, (f.songCount || 1) - 1) } : f
              ));
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar: ' + e.message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  // ── Editar canción ───────────────────────────────────────────

  const openEditModal = (song) => {
    setEditSong(song);
    setEditTitle(song.title);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Falta el título', 'El título no puede estar vacío.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'songs', editSong.id), {
        title: editTitle.trim(),
      });
      setSongs(prev => prev.map(s =>
        s.id === editSong.id
          ? { ...s, title: editTitle.trim() }
          : s
      ).sort((a, b) => a.title.localeCompare(b.title)));
      setEditSong(null);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar: ' + e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Subir anuncio de afiliado ──────────────────────────────────────────────

  const pickAdVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) setAdVideoFile(result.assets[0]);
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el video.');
    }
  };

  const handleUploadAd = async () => {
    if (!adVideoFile || !adProductUrl.trim() || !adProductTitle.trim()) {
      Alert.alert('Faltan datos', 'Completa el título, el video y el link del producto.');
      return;
    }
    setUploadingAd(true);
    setAdProgress(0);
    try {
      const fileName   = `ads/${Date.now()}_${adVideoFile.name}`;
      const storageRef = ref(storage, fileName);
      const response   = await fetch(adVideoFile.uri);
      const blob       = await response.blob();

      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, blob);
        task.on('state_changed',
          snap => setAdProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject, resolve
        );
      });

      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'ads'), {
        videoUrl:     downloadURL,
        storagePath:  fileName,
        productUrl:   adProductUrl.trim(),
        productTitle: adProductTitle.trim(),
        createdAt:    new Date(),
      });

      Alert.alert('✅ ¡Listo!', 'Anuncio subido correctamente.');
      setAdVideoFile(null);
      setAdProductUrl('');
      setAdProductTitle('');
      await loadAds();
    } catch (e) {
      Alert.alert('Error', 'No se pudo subir el anuncio: ' + e.message);
    } finally {
      setUploadingAd(false);
      setAdProgress(0);
    }
  };

  const handleDeleteAd = (ad) => {
    Alert.alert(
      'Eliminar anuncio',
      `¿Seguro que quieres eliminar "${ad.productTitle}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            setDeletingAdId(ad.id);
            try {
              await deleteAd(ad.id);
              if (ad.storagePath) {
                await deleteObject(ref(storage, ad.storagePath)).catch(() => {});
              }
              setAds(prev => prev.filter(a => a.id !== ad.id));
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar: ' + e.message);
            } finally {
              setDeletingAdId(null);
            }
          },
        },
      ]
    );
  };

  // ── Helpers UI ───────────────────────────────────────────────

  const currentFandom  = fandoms.find(f => f.id === fandomId);
  const songCount      = currentFandom?.songCount ?? songs.length;
  const songsNeeded    = Math.max(0, 10 - songCount);
  const progressToTen  = Math.min(1, songCount / 10);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin</Text>
        </View>

        <Text style={styles.pageTitle}>Subir canción</Text>
        <Text style={styles.pageSub}>Los cambios se reflejan en la app al instante</Text>

        {/* Recordar acceso */}
        <TouchableOpacity style={styles.rememberRow} onPress={toggleRemember} activeOpacity={0.7}>
          <View style={[styles.checkbox, remembered && styles.checkboxActive]}>
            {remembered && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>Recordar acceso en este dispositivo</Text>
        </TouchableOpacity>

        {/* ── Fandom selector ── */}
        <View style={styles.field}>
          <Text style={styles.label}>FANDOM</Text>
          <View style={styles.row}>
            {fandoms.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, fandomId === f.id && styles.chipActive]}
                onPress={() => setFandomId(f.id)}
              >
                <Text style={styles.chipEmoji}>{f.emoji}</Text>
                <View>
                  <Text style={[styles.chipText, fandomId === f.id && styles.chipTextActive]}>
                    {f.name}
                  </Text>
                  <Text style={[styles.chipCount, fandomId === f.id && styles.chipCountActive]}>
                    {f.songCount} {f.songCount === 1 ? 'canción' : 'canciones'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.chipNew} onPress={() => setShowNewFandom(true)}>
              <Text style={styles.chipNewText}>+ Nuevo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Indicador de progreso hacia 10 canciones ── */}
        {currentFandom && (
          <View style={styles.progressCard}>
            <View style={styles.progressCardHeader}>
              <Text style={styles.progressCardEmoji}>{currentFandom.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressCardTitle}>{currentFandom.name}</Text>
                <Text style={styles.progressCardSub}>
                  {songCount >= 10
                    ? '✅ Fandom habilitado para jugar'
                    : `Faltan ${songsNeeded} canción${songsNeeded !== 1 ? 'es' : ''} para habilitarse`}
                </Text>
              </View>
              <Text style={[
                styles.progressCardCount,
                songCount >= 10 ? styles.progressCardCountDone : styles.progressCardCountPending,
              ]}>
                {songCount}/10
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFillTrack,
                { width: `${progressToTen * 100}%` },
                songCount >= 10 && styles.progressFillDone,
              ]} />
            </View>
          </View>
        )}

        {/* ── Título ── */}
        <View style={styles.field}>
          <Text style={styles.label}>TÍTULO</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Dynamite"
            placeholderTextColor={colors.textSoft}
          />
        </View>

        {/* ── Audio picker + preview ── */}
        <View style={styles.field}>
          <Text style={styles.label}>ARCHIVO DE AUDIO</Text>
          <TouchableOpacity style={styles.filePicker} onPress={pickAudio}>
            <Text style={styles.filePickerIcon}>🎵</Text>
            <Text style={styles.filePickerText} numberOfLines={1}>
              {audioFile ? audioFile.name : 'Toca para seleccionar un .mp3'}
            </Text>
          </TouchableOpacity>

          {/* Botón de preview — aparece solo cuando hay archivo */}
          {audioFile && (
            <TouchableOpacity
              style={[styles.previewBtn, previewPlaying && styles.previewBtnActive]}
              onPress={togglePreview}
              disabled={previewLoading}
              activeOpacity={0.8}
            >
              {previewLoading
                ? <ActivityIndicator size="small" color={colors.purple} />
                : <Text style={styles.previewBtnIcon}>{previewPlaying ? '⏹' : '▶'}</Text>
              }
              <Text style={[styles.previewBtnText, previewPlaying && styles.previewBtnTextActive]}>
                {previewPlaying ? 'Detener preview' : '▶ Escuchar clip'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Progreso upload ── */}
        {uploading && (
          <View style={styles.uploadProgressWrap}>
            <View style={styles.uploadProgressBar}>
              <View style={[styles.uploadProgressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.uploadProgressText}>{progress}% subido...</Text>
          </View>
        )}

        {/* ── Botón subir ── */}
        <TouchableOpacity
          style={[styles.btnUpload, uploading && styles.btnDisabled]}
          onPress={handleUpload}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading
            ? <ActivityIndicator color={colors.cream} />
            : <Text style={styles.btnUploadText}>⬆ Subir canción</Text>
          }
        </TouchableOpacity>

        {/* ── Lista de canciones ── */}
        <View style={styles.songListSection}>
          <Text style={styles.label}>
            CANCIONES {currentFandom ? `— ${currentFandom.emoji} ${currentFandom.name}` : ''}
          </Text>

          {loadingSongs ? (
            <ActivityIndicator color={colors.purple} style={{ marginTop: 12 }} />
          ) : songs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No hay canciones en este fandom todavía.</Text>
            </View>
          ) : (
            songs.map(song => (
              <View key={song.id} style={styles.songRow}>
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                  <Text style={styles.songMeta}>
                    {song.isClip ? '✂️ clip 20s' : `▶ ${song.playStart ?? 10}s – ${song.playEnd ?? 170}s`}
                  </Text>
                </View>
                {/* Reemplazar audio — solo en canciones legacy */}
                {!song.isClip && (
                  <TouchableOpacity
                    style={styles.replaceBtn}
                    onPress={() => openReplaceModal(song)}
                    disabled={replacingId === song.id}
                  >
                    {replacingId === song.id
                      ? <ActivityIndicator size="small" color={colors.purple} />
                      : <Text style={styles.replaceBtnText}>🔄</Text>
                    }
                  </TouchableOpacity>
                )}
                {/* Editar */}
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEditModal(song)}
                >
                  <Text style={styles.editBtnText}>✏️</Text>
                </TouchableOpacity>
                {/* Eliminar */}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteSong(song)}
                  disabled={deletingId === song.id}
                >
                  {deletingId === song.id
                    ? <ActivityIndicator size="small" color={colors.wrong} />
                    : <Text style={styles.deleteBtnText}>🗑</Text>
                  }
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ── Sección anuncios de afiliado ── */}
        <View style={styles.adSection}>
          <Text style={styles.adSectionTitle}>Anuncios de afiliado</Text>
          <Text style={styles.adSectionSub}>Los usuarios ven un video aleatorio para desbloquear fandoms</Text>

          {/* Formulario subir anuncio */}
          <View style={styles.field}>
            <Text style={styles.label}>TÍTULO DEL PRODUCTO</Text>
            <TextInput
              style={styles.input}
              value={adProductTitle}
              onChangeText={setAdProductTitle}
              placeholder="Ej: Audífonos Bluetooth XM5"
              placeholderTextColor={colors.textSoft}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>LINK DE AFILIADO (Mercado Libre)</Text>
            <TextInput
              style={styles.input}
              value={adProductUrl}
              onChangeText={setAdProductUrl}
              placeholder="https://mercadolibre.com/..."
              placeholderTextColor={colors.textSoft}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>VIDEO DEL PRODUCTO</Text>
            <TouchableOpacity style={styles.filePicker} onPress={pickAdVideo}>
              <Text style={styles.filePickerIcon}>🎬</Text>
              <Text style={styles.filePickerText} numberOfLines={1}>
                {adVideoFile ? adVideoFile.name : 'Toca para seleccionar un video (.mp4)'}
              </Text>
            </TouchableOpacity>
          </View>

          {uploadingAd && (
            <View style={styles.uploadProgressWrap}>
              <View style={styles.uploadProgressBar}>
                <View style={[styles.uploadProgressFill, { width: `${adProgress}%` }]} />
              </View>
              <Text style={styles.uploadProgressText}>{adProgress}% subido...</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btnUpload, uploadingAd && styles.btnDisabled]}
            onPress={handleUploadAd}
            disabled={uploadingAd}
            activeOpacity={0.85}
          >
            {uploadingAd
              ? <ActivityIndicator color={colors.cream} />
              : <Text style={styles.btnUploadText}>⬆ Subir anuncio</Text>
            }
          </TouchableOpacity>

          {/* Lista de anuncios */}
          <Text style={[styles.label, { marginTop: 8 }]}>ANUNCIOS ACTIVOS ({ads.length})</Text>
          {loadingAds ? (
            <ActivityIndicator color={colors.purple} style={{ marginTop: 12 }} />
          ) : ads.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No hay anuncios todavía.</Text>
            </View>
          ) : (
            ads.map(ad => (
              <View key={ad.id} style={styles.adRow}>
                <Text style={styles.adEmoji}>🎬</Text>
                <View style={styles.adInfo}>
                  <Text style={styles.adTitle} numberOfLines={1}>{ad.productTitle}</Text>
                  <Text style={styles.adUrl} numberOfLines={1}>{ad.productUrl}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteAd(ad)}
                  disabled={deletingAdId === ad.id}
                >
                  {deletingAdId === ad.id
                    ? <ActivityIndicator size="small" color={colors.wrong} />
                    : <Text style={styles.deleteBtnText}>🗑</Text>
                  }
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ── Cerrar sesión ── */}
        {remembered && (
          <TouchableOpacity
            style={styles.btnLogout}
            onPress={async () => {
              await AsyncStorage.removeItem(STORAGE_KEY);
              setRemembered(false);
              navigation.goBack();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.btnLogoutText}>🔓 Cerrar sesión guardada</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal nuevo fandom ── */}
      <Modal visible={showNewFandom} transparent animationType="fade" onRequestClose={() => setShowNewFandom(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nuevo fandom</Text>
            <View style={styles.modalEmojiRow}>
              <TextInput
                style={[styles.input, styles.emojiInput]}
                value={newFandomEmoji}
                onChangeText={setNewFandomEmoji}
                placeholder="🎵"
                placeholderTextColor={colors.textSoft}
                maxLength={2}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newFandomName}
                onChangeText={setNewFandomName}
                placeholder="Nombre del fandom"
                placeholderTextColor={colors.textSoft}
                autoFocus
                onSubmitEditing={handleCreateFandom}
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setShowNewFandom(false); setNewFandomName(''); setNewFandomEmoji(''); }}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, savingFandom && { opacity: 0.6 }]}
                onPress={handleCreateFandom}
                disabled={savingFandom}
              >
                {savingFandom
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.modalConfirmText}>Crear</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal reemplazar audio ── */}
      <Modal visible={!!replacingSong} transparent animationType="fade" onRequestClose={() => setReplacingSong(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reemplazar audio</Text>
            <Text style={styles.modalSub}>"{replacingSong?.title}"</Text>
            <Text style={styles.modalHint}>Sube el clip ya recortado de 20 segundos</Text>

            <TouchableOpacity style={styles.filePicker} onPress={pickReplaceAudio}>
              <Text style={styles.filePickerIcon}>🎵</Text>
              <Text style={styles.filePickerText} numberOfLines={1}>
                {replaceFile ? replaceFile.name : 'Toca para seleccionar el clip .mp3'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setReplacingSong(null); setReplaceFile(null); }}
                disabled={!!replacingId}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !!replacingId && { opacity: 0.6 }]}
                onPress={handleReplaceAudio}
                disabled={!!replacingId}
              >
                {replacingId
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.modalConfirmText}>⬆ Subir clip</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal editar canción ── */}
      <Modal visible={!!editSong} transparent animationType="fade" onRequestClose={() => setEditSong(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Editar canción</Text>

            <View style={styles.field}>
              <Text style={styles.label}>TÍTULO</Text>
              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Título de la canción"
                placeholderTextColor={colors.textSoft}
                autoFocus
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditSong(null)}
                disabled={savingEdit}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, savingEdit && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.modalConfirmText}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.cream },
  content:    { padding: 24, paddingTop: 52, gap: 20 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  backBtn:    { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.creamDark },
  backText:   { fontSize: 13, color: colors.textSoft, fontWeight: '500' },
  headerTitle:{ fontSize: 13, color: colors.textSoft, fontWeight: '500' },
  pageTitle:  { fontSize: 32, fontWeight: '600', color: colors.purple, letterSpacing: -0.5 },
  pageSub:    { fontSize: 13, color: colors.textSoft, fontWeight: '300', marginTop: -12 },

  field:          { gap: 10 },
  label:          { fontSize: 11, letterSpacing: 2, color: colors.textSoft, fontWeight: '500' },
  input: {
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.creamDeep,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: colors.textDark,
  },
  row:            { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 2,
    borderColor: colors.creamDeep, backgroundColor: colors.white,
  },
  chipActive:      { borderColor: colors.purple, backgroundColor: colors.purplePale },
  chipEmoji:       { fontSize: 18 },
  chipText:        { fontSize: 13, color: colors.textSoft, fontWeight: '500' },
  chipTextActive:  { color: colors.purple },
  chipCount:       { fontSize: 11, color: colors.textSoft, fontWeight: '300' },
  chipCountActive: { color: colors.purple },
  chipNew: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 2,
    borderColor: colors.purple, backgroundColor: colors.purplePale,
  },
  chipNewText: { fontSize: 13, color: colors.purple, fontWeight: '600' },

  // Indicador progreso 10 canciones
  progressCard: {
    backgroundColor: colors.white, borderRadius: 14,
    borderWidth: 2, borderColor: colors.creamDeep, padding: 14, gap: 10,
  },
  progressCardHeader:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressCardEmoji:        { fontSize: 24 },
  progressCardTitle:        { fontSize: 14, fontWeight: '600', color: colors.textDark },
  progressCardSub:          { fontSize: 12, color: colors.textSoft, marginTop: 1 },
  progressCardCount:        { fontSize: 18, fontWeight: '700' },
  progressCardCountPending: { color: colors.textSoft },
  progressCardCountDone:    { color: colors.correct },
  progressTrack: {
    height: 6, backgroundColor: colors.creamDeep,
    borderRadius: 3, overflow: 'hidden',
  },
  progressFillTrack: {
    height: '100%', backgroundColor: colors.purple, borderRadius: 3,
  },
  progressFillDone: { backgroundColor: colors.correct },

  inputHalfWrap:  { flex: 1, gap: 6 },
  inputHalfLabel: { fontSize: 12, color: colors.textSoft },
  inputHalf:      { textAlign: 'center' },

  filePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderWidth: 2,
    borderColor: colors.creamDeep, borderRadius: 12,
    borderStyle: 'dashed', padding: 18,
  },
  filePickerIcon: { fontSize: 24 },
  filePickerText: { fontSize: 13, color: colors.textSoft, flex: 1 },

  // Preview button
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 2, borderColor: colors.purple,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: colors.purplePale,
  },
  previewBtnActive:    { backgroundColor: colors.purple },
  previewBtnIcon:      { fontSize: 14, color: colors.purple },
  previewBtnText:      { fontSize: 13, color: colors.purple, fontWeight: '500' },
  previewBtnTextActive:{ color: colors.cream },

  // Upload progress
  uploadProgressWrap: { gap: 8 },
  uploadProgressBar:  { height: 6, backgroundColor: colors.creamDeep, borderRadius: 3, overflow: 'hidden' },
  uploadProgressFill: { height: '100%', backgroundColor: colors.purple, borderRadius: 3 },
  uploadProgressText: { fontSize: 12, color: colors.textSoft, textAlign: 'center' },

  btnUpload:    { backgroundColor: colors.purple, borderRadius: 16, paddingVertical: 18, alignItems: 'center', elevation: 6, marginTop: 4 },
  btnDisabled:  { opacity: 0.6 },
  btnUploadText:{ color: colors.cream, fontSize: 16, fontWeight: '500' },

  // Lista canciones
  songListSection: { gap: 12 },
  emptyBox: {
    backgroundColor: colors.white, borderRadius: 12,
    borderWidth: 2, borderColor: colors.creamDeep,
    padding: 20, alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: colors.textSoft },
  songRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: 12,
    borderWidth: 2, borderColor: colors.creamDeep,
    paddingHorizontal: 16, paddingVertical: 14, gap: 8,
  },
  songInfo:  { flex: 1, gap: 2 },
  songTitle: { fontSize: 14, fontWeight: '500', color: colors.textDark },
  songMeta:  { fontSize: 11, color: colors.textSoft },
  replaceBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EEF0FF',
    alignItems: 'center', justifyContent: 'center',
  },
  replaceBtnText: { fontSize: 15 },
  modalSub:  { fontSize: 14, fontWeight: '600', color: colors.textDark, marginTop: -8 },
  modalHint: { fontSize: 12, color: colors.textSoft, marginTop: -4 },
  editBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.purplePale,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtnText: { fontSize: 15 },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.wrongBg,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 16 },

  // Recordar / logout
  rememberRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.creamDeep, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { borderColor: colors.purple, backgroundColor: colors.purple },
  checkmark:      { fontSize: 13, color: colors.cream, fontWeight: '700' },
  rememberText:   { fontSize: 13, color: colors.textSoft, fontWeight: '400' },
  btnLogout: {
    borderWidth: 2, borderColor: colors.wrong,
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  btnLogoutText: { color: colors.wrong, fontSize: 14, fontWeight: '500' },

  // Anuncios
  adSection: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.creamDeep,
    padding: 16,
    gap: 14,
  },
  adSectionTitle: { fontSize: 18, fontWeight: '700', color: colors.purple },
  adSectionSub:   { fontSize: 12, color: colors.textSoft, marginTop: -8 },
  adRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cream, borderRadius: 12,
    borderWidth: 2, borderColor: colors.creamDeep,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  adEmoji: { fontSize: 22 },
  adInfo:  { flex: 1, gap: 2 },
  adTitle: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  adUrl:   { fontSize: 11, color: colors.textSoft },

  // Modales
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalBox:      { width: 320, backgroundColor: colors.white, borderRadius: 20, padding: 24, gap: 16, elevation: 20 },
  modalTitle:    { fontSize: 18, fontWeight: '600', color: colors.textDark },
  modalEmojiRow: { flexDirection: 'row', gap: 10 },
  emojiInput:    { width: 56, textAlign: 'center', fontSize: 20, paddingHorizontal: 8 },
  modalBtns:     { flexDirection: 'row', gap: 10 },
  modalCancel:   { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: colors.creamDeep, alignItems: 'center' },
  modalCancelText:  { fontSize: 14, color: colors.textSoft, fontWeight: '500' },
  modalConfirm:     { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.purple, alignItems: 'center' },
  modalConfirmText: { fontSize: 14, color: colors.white, fontWeight: '500' },
});
