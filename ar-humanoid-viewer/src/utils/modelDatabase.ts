import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const DB_URL = 'https://raw.githubusercontent.com/ArielGuevara/ar-models-db/main/models.json';

export interface ModelData {
  id: string;
  name: string;
  description: string;
  url: string;
  thumbnail: string;
  author: string;
}

export async function fetchModelById(id: string): Promise<ModelData | null> {
  try {
    console.log('Buscando modelo con ID:', id);
    const response = await fetch(DB_URL);
    if (!response.ok) throw new Error('No se pudo obtener la base de datos');
    const data = await response.json();
    const model = data.models.find((m: ModelData) => m.id === id);
    if (!model) {
      console.log('Modelo no encontrado para ID:', id);
      return null;
    }
    console.log('Modelo encontrado:', model.name);
    return model;
  } catch (e) {
    console.error('Error buscando modelo:', e);
    return null;
  }
}

// Descarga el modelo y lo guarda en el filesystem local
// Retorna la URI local del archivo
export async function downloadModelToFile(
  url: string,
  name: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Use downloadModelAsBase64 en web');
  }

  const destDir = FileSystem.documentDirectory + 'models/';
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_') + '.glb';
  const destPath = destDir + safeName;

  // Verifica si ya está descargado
  const exists = await FileSystem.getInfoAsync(destPath);
  if (exists.exists) {
    console.log('Modelo ya existe en cache:', destPath);
    return destPath;
  }

  console.log('Descargando a:', destPath);

  // Descarga con progreso
  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    destPath,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      onProgress?.(Math.round(progress * 100));
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) throw new Error('Descarga fallida');
  console.log('Modelo descargado en:', result.uri);
  return result.uri;
}

// Para web — descarga como base64
export async function downloadModelAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo descargar el modelo');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}