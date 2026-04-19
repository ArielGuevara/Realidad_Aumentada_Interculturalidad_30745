import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export default function SettingsScreen() {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [highQuality, setHighQuality] = useState(true);

  const clearCache = async () => {
    Alert.alert('Limpiar caché', '¿Eliminar todos los modelos guardados?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpiar', style: 'destructive',
        onPress: async () => {
          try {
            const modelsDir = FileSystem.documentDirectory + 'models/';
            const exists = await FileSystem.getInfoAsync(modelsDir);
            if (exists.exists) await FileSystem.deleteAsync(modelsDir);
            const meta = FileSystem.documentDirectory + 'models_meta.json';
            const metaExists = await FileSystem.getInfoAsync(meta);
            if (metaExists.exists) await FileSystem.deleteAsync(meta);
            Alert.alert('✅', 'Caché limpiado correctamente');
          } catch (e) {
            Alert.alert('Error', 'No se pudo limpiar el caché');
          }
        }
      }
    ]);
  };

  const SettingRow = ({ label, value, onValueChange, description }: any) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDesc}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#333', true: '#6c63ff' }}
        thumbColor={value ? '#fff' : '#888'}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Configuración</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>VISUALIZACIÓN</Text>
        <SettingRow label="Auto-rotación" value={autoRotate} onValueChange={setAutoRotate} description="Rota el modelo automáticamente" />
        <SettingRow label="Mostrar grid" value={showGrid} onValueChange={setShowGrid} description="Muestra la cuadrícula de referencia" />
        <SettingRow label="Alta calidad" value={highQuality} onValueChange={setHighQuality} description="Mayor resolución de renderizado" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ALMACENAMIENTO</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={clearCache}>
          <Text style={styles.dangerBtnText}>🗑️ Limpiar caché de modelos</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACERCA DE</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>AR Humanoid Viewer</Text>
          <Text style={styles.aboutVersion}>Versión 1.0.0</Text>
          <Text style={styles.aboutDesc}>
            Aplicación para visualizar modelos 3D humanoides con realidad aumentada. 
            Soporta archivos GLB y GLTF con animaciones.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#16213e' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { color: '#6c63ff', fontSize: 11, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 },
  settingRow: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  settingInfo: { flex: 1 },
  settingLabel: { color: '#fff', fontSize: 15 },
  settingDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  dangerBtn: { backgroundColor: 'rgba(255,80,80,0.15)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,80,80,0.3)', alignItems: 'center' },
  dangerBtnText: { color: '#ff5050', fontSize: 15, fontWeight: '600' },
  aboutCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 16 },
  aboutTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  aboutVersion: { color: '#6c63ff', fontSize: 13, marginTop: 4 },
  aboutDesc: { color: '#888', fontSize: 13, marginTop: 8, lineHeight: 20 },
});