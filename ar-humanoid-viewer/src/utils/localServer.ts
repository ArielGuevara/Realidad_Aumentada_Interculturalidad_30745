import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

let serverUrl: string | null = null;

export async function startLocalServer(): Promise<string> {
  if (serverUrl) return serverUrl;

  // Copia archivos al directorio de documentos
  const threeAsset = Asset.fromModule(require('../assets/three.cjs.txt'));
  const gltfAsset = Asset.fromModule(require('../assets/GLTFLoader.js.txt'));
  await Promise.all([threeAsset.downloadAsync(), gltfAsset.downloadAsync()]);

  const destDir = FileSystem.documentDirectory + 'www/';
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });

  const threeCode = await FileSystem.readAsStringAsync(threeAsset.localUri!);
  const gltfCode = await FileSystem.readAsStringAsync(gltfAsset.localUri!);

  await FileSystem.writeAsStringAsync(destDir + 'three.js', threeCode);
  await FileSystem.writeAsStringAsync(destDir + 'GLTFLoader.js', gltfCode);

  return destDir;
}