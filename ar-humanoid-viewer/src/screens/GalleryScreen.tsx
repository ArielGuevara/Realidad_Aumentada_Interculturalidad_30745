import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

interface ModelItem {
  id: string;
  name: string;
  size: string;
  date: string;
  uri: string;
}

type Props = {
  navigation: any;
};

export default function GalleryScreen({ navigation }: Props) {
  const [models, setModels] = useState<ModelItem[]>([]);

  useEffect(() => {
    loadSavedModels();
  }, []);

  const loadSavedModels = async () => {
    try {
      const metaPath = FileSystem.documentDirectory + 'models_meta.json';
      const exists = await FileSystem.getInfoAsync(metaPath);
      if (exists.exists) {
        const raw = await FileSystem.readAsStringAsync(metaPath);
        setModels(JSON.parse(raw));
      }
    } catch (e) {
      console.log('No hay modelos guardados');
    }
  };

  const saveModelMeta = async (newModels: ModelItem[]) => {
    const metaPath = FileSystem.documentDirectory + 'models_meta.json';
    await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(newModels));
  };

  const pickAndSaveModel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];

      // Copia el modelo al directorio de documentos
      const destDir = FileSystem.documentDirectory + 'models/';
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const dest = destDir + file.name;
      await FileSystem.copyAsync({ from: file.uri, to: dest });

      const info = await FileSystem.getInfoAsync(dest);
      const sizeKB = info.exists ? Math.round((info as any).size / 1024) : 0;

      const newModel: ModelItem = {
        id: Date.now().toString(),
        name: file.name,
        size: sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`,
        date: new Date().toLocaleDateString(),
        uri: dest,
      };

      const updated = [newModel, ...models];
      setModels(updated);
      await saveModelMeta(updated);

    } catch (e) {
      console.error('Error guardando modelo:', e);
    }
  };

  const deleteModel = (id: string) => {
    Alert.alert('Eliminar', '¿Eliminar este modelo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const updated = models.filter(m => m.id !== id);
          setModels(updated);
          await saveModelMeta(updated);
        }
      }
    ]);
  };

  const openInAR = (model: ModelItem) => {
    navigation.navigate('AR', {
      modelUri: model.uri,
      modelName: model.name,
      timestamp: Date.now(), // Fuerza re-render aunque sea el mismo modelo
    });
  }; 

  const renderModel = ({ item }: { item: ModelItem }) => (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Text style={styles.cardIconText}>🤖</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardMeta}>{item.size} • {item.date}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.arBtn} onPress={() => openInAR(item)}>
          <Text style={styles.arBtnText}>AR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteModel(item.id)}>
          <Text style={styles.deleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📁 Mis Modelos</Text>
        <Text style={styles.subtitle}>{models.length} modelos guardados</Text>
      </View>

      {models.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No hay modelos guardados</Text>
          <Text style={styles.emptySubtext}>Importa un archivo GLB o GLTF</Text>
        </View>
      ) : (
        <FlatList
          data={models}
          renderItem={renderModel}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={pickAndSaveModel}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#16213e' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#6c63ff', marginTop: 4 },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#16213e', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)' },
  cardIcon: { width: 50, height: 50, backgroundColor: 'rgba(108,99,255,0.2)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardIconText: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cardMeta: { color: '#888', fontSize: 12, marginTop: 3 },
  cardActions: { flexDirection: 'row', gap: 8 },
  arBtn: { backgroundColor: '#6c63ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  arBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  deleteBtn: { backgroundColor: 'rgba(255,80,80,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  deleteBtnText: { fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptySubtext: { color: '#888', fontSize: 14, marginTop: 8 },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, backgroundColor: '#6c63ff', borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
});