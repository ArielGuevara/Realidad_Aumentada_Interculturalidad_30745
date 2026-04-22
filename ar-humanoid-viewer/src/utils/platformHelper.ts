import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';

// Lee un asset como texto — funciona en ambas plataformas
export async function readAssetAsText(localUri: string): Promise<string> {
  if (isWeb) {
    const response = await fetch(localUri);
    return await response.text();
  } else {
    const FileSystem = require('expo-file-system/legacy');
    return await FileSystem.readAsStringAsync(localUri);
  }
}

// Escribe un archivo — solo nativo
export async function writeFile(path: string, content: string): Promise<void> {
  if (isWeb) return; // No aplica en web
  const FileSystem = require('expo-file-system/legacy');
  await FileSystem.writeAsStringAsync(path, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

// Lee archivo como base64
export async function readAsBase64(uri: string): Promise<string> {
  if (isWeb) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Quita el prefijo data:...;base64,
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    const FileSystem = require('expo-file-system/legacy');
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}