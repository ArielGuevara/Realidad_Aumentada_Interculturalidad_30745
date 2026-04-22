import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, Animated
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { fetchModelById, downloadModelToFile, ModelData } from '../utils/modelDatabase';

type Props = {
  navigation: any;
};

export default function QRScannerScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const scanLineAnim = React.useRef(new Animated.Value(0)).current;
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    requestPermission();
    startScanAnimation();
  }, []);

  const startScanAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  };

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanned || loading) return;
    setScanned(true);
    setError(null);
    setLoading(true);
    setLoadingMsg('Buscando modelo...');

    try {
      // Busca el modelo en la base de datos
      const model = await fetchModelById(data.trim());
      if (!model) {
        setError(`No se encontró ningún modelo con ID: "${data}"`);
        setLoading(false);
        return;
      }

      setModelInfo(model);
      setShowPreview(true);
      setLoading(false);

    } catch (e) {
      setError('Error al buscar el modelo. Verifica tu conexión.');
      setLoading(false);
    }
  };

  const loadModelInAR = async () => {
    if (!modelInfo) return;
    setShowPreview(false);
    setLoading(true);
    setLoadingMsg('Descargando modelo... 0%');
    setDownloadProgress(0);

    try {
      // Descarga el modelo al filesystem local
      const localUri = await downloadModelToFile(
        modelInfo.url,
        modelInfo.id,
        (progress) => {
          setDownloadProgress(progress);
          setLoadingMsg(`Descargando modelo... ${progress}%`);
        }
      );

      setLoadingMsg('Abriendo en AR...');
      setLoading(false);

      // Navega al AR con la URI local
      navigation.navigate('Main', {
        screen: 'AR',
        params: {
          modelUri: localUri,
          modelName: modelInfo.name,
          timestamp: Date.now(),
        },
      });

    } catch (e) {
      console.error('Error descargando modelo:', e);
      setError('Error al descargar el modelo. Verifica tu conexión.');
      setLoading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.permissionText}>Se necesita acceso a la cámara</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Permitir Cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  return (
    <View style={styles.container}>
      {/* Cámara */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Overlay oscuro con ventana de escaneo */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View style={styles.scanWindow}>
            {/* Esquinas del marco */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {/* Línea de escaneo animada */}
            {!scanned && (
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
              />
            )}
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Escanear QR</Text>
      </View>

      {/* Instrucción */}
      <View style={styles.instruction}>
        <Text style={styles.instructionText}>
          {scanned ? '✅ QR detectado' : 'Apunta al código QR del modelo'}
        </Text>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setScanned(false); setError(null); }}
          >
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={styles.loadingText}>{loadingMsg}</Text>
          {downloadProgress > 0 && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${downloadProgress}%` as any }]} />
            </View>
          )}
        </View>
      )}

      {/* Modal de preview del modelo */}
      <Modal visible={showPreview} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🤖</Text>
            <Text style={styles.modalTitle}>{modelInfo?.name}</Text>
            <Text style={styles.modalDesc}>{modelInfo?.description}</Text>
            <Text style={styles.modalAuthor}>👤 {modelInfo?.author}</Text>
            <Text style={styles.modalId}>ID: {modelInfo?.id}</Text>

            <TouchableOpacity style={styles.loadBtn} onPress={loadModelInAR}>
              <Text style={styles.loadBtnText}>📷 Ver en AR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowPreview(false); setScanned(false); }}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute', top: 50, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
  },
  backBtn: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  backBtnText: { color: '#fff', fontSize: 14 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 16 },
  overlay: { ...StyleSheet.absoluteFillObject },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  middleRow: { flexDirection: 'row', height: 250 },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanWindow: { width: 250, height: 250, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#6c63ff', borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { width: '90%', height: 2, backgroundColor: '#6c63ff', opacity: 0.8 },
  instruction: {
    position: 'absolute', bottom: 180, left: 0, right: 0, alignItems: 'center',
  },
  instructionText: { color: '#fff', fontSize: 15, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  errorBox: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    backgroundColor: 'rgba(255,50,50,0.9)', borderRadius: 12, padding: 16, alignItems: 'center',
  },
  errorText: { color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 10 },
  retryBtn: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  retryBtnText: { color: '#ff3232', fontWeight: 'bold' },
  loadingBox: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    backgroundColor: 'rgba(16,16,40,0.95)', borderRadius: 12, padding: 20, alignItems: 'center',
  },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },
  permissionText: { color: '#fff', fontSize: 16, marginBottom: 20 },
  permBtn: { backgroundColor: '#6c63ff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30 },
  permBtnText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#16213e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center' },
  modalEmoji: { fontSize: 50, marginBottom: 12 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  modalDesc: { color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  modalAuthor: { color: '#888', fontSize: 12, marginBottom: 4 },
  modalId: { color: '#6c63ff', fontSize: 12, marginBottom: 24 },
  loadBtn: { backgroundColor: '#6c63ff', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 30, marginBottom: 12, width: '100%', alignItems: 'center' },
  loadBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { color: '#888', fontSize: 14 },
  progressBar: {
    width: '100%', height: 6, backgroundColor: '#2a2a4e',
    borderRadius: 3, marginTop: 10, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#6c63ff', borderRadius: 3,
  },
});