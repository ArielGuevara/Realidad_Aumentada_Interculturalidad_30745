import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Asset } from 'expo-asset';

export default function ThreeViewer() {
  const webviewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);
  // Estados de animaciones
  const [animations, setAnimations] = React.useState<{index: number, name: string}[]>([]);
  const [currentAnim, setCurrentAnim] = React.useState<number | null>(null);
  const [isPaused, setIsPaused] = React.useState(false);
  const [speed, setSpeed] = React.useState(1.0);
  const [showAnimPanel, setShowAnimPanel] = React.useState(false);
  const [bones, setBones] = React.useState<string[]>([]);

  useEffect(() => {
    prepareViewer();
  }, []);

  const prepareViewer = async () => {
    try {
      setPreparing(true);
      console.log('Preparando visor...');

      const threeAsset = Asset.fromModule(require('../assets/three.cjs.txt'));
      const gltfAsset = Asset.fromModule(require('../assets/GLTFLoader.js.txt'));
      const bgUtilsAsset = Asset.fromModule(require('../assets/BufferGeometryUtils.js.txt'));

      await Promise.all([
        threeAsset.downloadAsync(),
        gltfAsset.downloadAsync(),
        bgUtilsAsset.downloadAsync(),
      ]);

      const [threeCode, gltfCode, bgUtilsCode] = await Promise.all([
        FileSystem.readAsStringAsync(threeAsset.localUri!),
        FileSystem.readAsStringAsync(gltfAsset.localUri!),
        FileSystem.readAsStringAsync(bgUtilsAsset.localUri!),
      ]);

      console.log('Archivos cargados');

      // Parchea BufferGeometryUtils
      let patchedBgUtils = bgUtilsCode
        .replace(/import\s*\{([^}]*)\}\s*from\s*['"]three['"]\s*;?/g, (_, imp) =>
          imp.split(',').map((s: string) => {
            s = s.trim();
            const p = s.split(/\s+as\s+/);
            return p.length === 2
              ? `var ${p[1].trim()} = THREE["${p[0].trim()}"];`
              : `var ${s} = THREE["${s}"];`;
          }).join('\n')
        )
        .replace(/export\s*\{([^}]*)\}\s*;?/g, (_, names) =>
          names.split(',').map((s: string) => {
            s = s.trim();
            const p = s.split(/\s+as\s+/);
            const localName = p[0].trim();
            const exportName = p.length === 2 ? p[1].trim() : localName;
            return `window.${exportName} = ${localName};`;
          }).join('\n')
        )
        .replace(/export\s+default\s+/g, 'window._BGD=')
        .replace(/export\s+(class|function|const|let|var)\s+(\w+)/g, 'window.$2=$1 $2');

      // Parchea GLTFLoader
      let patchedGltf = gltfCode
        .replace(/import\s*\{([^}]*)\}\s*from\s*['"]three['"]\s*;?/g, (_, imp) =>
          imp.split(',').map((s: string) => {
            s = s.trim();
            const p = s.split(/\s+as\s+/);
            return p.length === 2
              ? `var ${p[1].trim()} = THREE["${p[0].trim()}"];`
              : `var ${s} = THREE["${s}"];`;
          }).join('\n')
        )
        // Reemplaza el import de BufferGeometryUtils por acceso a window
        .replace(
          /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*BufferGeometryUtils[^'"]*['"]\s*;?/g,
          (_, imp) => imp.split(',').map((s: string) => {
            s = s.trim();
            const p = s.split(/\s+as\s+/);
            const localName = p[0].trim();
            const alias = p.length === 2 ? p[1].trim() : localName;
            return `var ${alias} = window.${localName};`;
          }).join('\n')
        )
        .replace(/export\s*\{([^}]*)\}\s*;?/g, (_, names) =>
          names.split(',').map((s: string) => {
            s = s.trim();
            const p = s.split(/\s+as\s+/);
            const localName = p[0].trim();
            const exportName = p.length === 2 ? p[1].trim() : localName;
            return `window.${exportName} = ${localName};`;
          }).join('\n')
        )
        .replace(/export\s+default\s+/g, 'window._GD=')
        .replace(/export\s+(class|function|const|let|var)\s+(\w+)/g, 'window.$2=$1 $2')
        .replace('class GLTFLoader extends Loader', 'var GLTFLoader = class GLTFLoader extends Loader');

      // Verifica imports restantes
      const remainingImports = patchedGltf.match(/import\s*[\s\S]*?from\s*['"][^'"]+['"]/g) || [];
      console.log('Imports sin resolver en GLTF:', remainingImports);
      const remainingBgImports = patchedBgUtils.match(/import\s*[\s\S]*?from\s*['"][^'"]+['"]/g) || [];
      console.log('Imports sin resolver en BgUtils:', remainingBgImports);

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; overflow: hidden; width: 100vw; height: 100vh; }
    canvas { display: block; width: 100vw; height: 100vh; }
    #status {
      position: fixed; top: 10px; left: 10px; right: 10px;
      color: #fff; font-size: 12px; font-family: monospace;
      background: rgba(0,0,0,0.7); padding: 8px; border-radius: 6px;
      z-index: 999;
    }
  </style>
</head>
<body>
  <div id="status">Iniciando...</div>
  <script>
  (function(){
    var module = { exports: {} };
    var exports = module.exports;
    ${threeCode}
    window.THREE = module.exports;
  })();
  </script>
  <script>
  (function(){
    var THREE = window.THREE;
    ${patchedBgUtils}
  })();
  </script>
  <script>
  (function(){
    var THREE = window.THREE;
    var GLTFLoader;
    ${patchedGltf}
    window.GLTFLoader = window.GLTFLoader || GLTFLoader;
  })();
  </script>
  <script>
  (function(){
    function postToRN(data) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
    function setStatus(msg, color) {
      var el = document.getElementById('status');
      el.style.color = color || '#fff';
      el.style.display = 'block';
      el.textContent = msg;
    }

    // Variables globales de escena
    var THREE = window.THREE;
    window.mixer = null;
    window.clock = new THREE.Clock();
    window.animations = [];
    window.currentAction = null;
    window.currentModel = null;
    window.animSpeed = 1.0;

    try {
      if (!window.THREE || !window.THREE.Scene) throw new Error('THREE no cargado');
      if (!window.GLTFLoader) throw new Error('GLTFLoader no cargado');

      window.scn = new THREE.Scene();
      window.scn.background = new THREE.Color(0x1a1a2e);
      window.cam = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
      window.cam.position.set(0, 1.5, 4);
      window.rnd = new THREE.WebGLRenderer({ antialias: true });
      window.rnd.setSize(window.innerWidth, window.innerHeight);
      window.rnd.setPixelRatio(window.devicePixelRatio);
      window.rnd.shadowMap.enabled = true;
      document.body.appendChild(window.rnd.domElement);

      window.scn.add(new THREE.AmbientLight(0xffffff, 0.6));
      var dl = new THREE.DirectionalLight(0xffffff, 1.0);
      dl.position.set(5, 10, 5);
      dl.castShadow = true;
      window.scn.add(dl);
      window.scn.add(new THREE.GridHelper(10, 10, 0x444466, 0x333355));

      window.addEventListener('resize', function() {
        window.cam.aspect = window.innerWidth/window.innerHeight;
        window.cam.updateProjectionMatrix();
        window.rnd.setSize(window.innerWidth, window.innerHeight);
      });

      (function animate() {
        requestAnimationFrame(animate);
        var delta = window.clock.getDelta();
        if (window.mixer) window.mixer.update(delta);
        if (window.currentModel && !window.mixer) window.currentModel.rotation.y += 0.005;
        window.rnd.render(window.scn, window.cam);
      })();

      setStatus('Listo - Carga un modelo GLB');
      setTimeout(function() { document.getElementById('status').style.display='none'; }, 3000);
      postToRN({ type: 'SCENE_READY' });

    } catch(e) {
      setStatus('ERROR: ' + e.message, '#ff4444');
      postToRN({ type: 'ERROR', msg: e.message });
    }

    // Carga modelo desde base64
    window.loadModel = function(base64, name) {
      try {
        setStatus('Cargando: ' + name);
        document.getElementById('status').style.display = 'block';

        // Limpia modelo anterior
        if (window.currentModel) {
          window.scn.remove(window.currentModel);
          window.currentModel = null;
        }
        if (window.mixer) {
          window.mixer.stopAllAction();
          window.mixer = null;
        }
        window.animations = [];
        window.currentAction = null;

        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        var loader = new window.GLTFLoader();
        loader.parse(bytes.buffer, '', function(gltf) {
          window.currentModel = gltf.scene;

          // Escala y centra
          var box = new THREE.Box3().setFromObject(window.currentModel);
          var center = box.getCenter(new THREE.Vector3());
          var size = box.getSize(new THREE.Vector3());
          var maxDim = Math.max(size.x, size.y, size.z);
          var scale = 2.0 / maxDim;
          window.currentModel.scale.setScalar(scale);
          window.currentModel.position.sub(center.multiplyScalar(scale));
          window.currentModel.position.y = 0;
          window.scn.add(window.currentModel);

          // Configura animaciones
          window.animations = gltf.animations || [];
          if (window.animations.length > 0) {
            window.mixer = new THREE.AnimationMixer(window.currentModel);
            var animNames = window.animations.map(function(a, i) {
              return { index: i, name: a.name || ('Animacion ' + i) };
            });
            postToRN({ type: 'ANIMATIONS_READY', animations: animNames });
            setStatus('Modelo listo - ' + window.animations.length + ' animaciones');
          } else {
            postToRN({ type: 'ANIMATIONS_READY', animations: [] });
            setStatus('Modelo listo - Sin animaciones');
          }
          setTimeout(function() { document.getElementById('status').style.display='none'; }, 2000);
          postToRN({ type: 'MODEL_LOADED', name: name });

        }, function(err) {
          setStatus('ERROR GLTF: ' + (err.message||err), '#ff4444');
        });
      } catch(e) {
        setStatus('ERROR modelo: ' + e.message, '#ff4444');
      }
    };

    // Reproduce una animacion por indice
    window.playAnimation = function(index, speed) {
      if (!window.mixer || !window.animations[index]) return;
      if (window.currentAction) {
        window.currentAction.fadeOut(0.3);
      }
      var clip = window.animations[index];
      window.currentAction = window.mixer.clipAction(clip);
      window.currentAction.setEffectiveTimeScale(speed || 1.0);
      window.currentAction.reset().fadeIn(0.3).play();
      setStatus('Reproduciendo: ' + (clip.name || 'Animacion ' + index));
      setTimeout(function() { document.getElementById('status').style.display='none'; }, 2000);
    };

    // Pausa la animacion actual
    window.pauseAnimation = function() {
      if (window.currentAction) {
        window.currentAction.paused = !window.currentAction.paused;
        setStatus(window.currentAction.paused ? 'Pausado' : 'Reproduciendo');
        setTimeout(function() { document.getElementById('status').style.display='none'; }, 1500);
      }
    };

    // Detiene la animacion
    window.stopAnimation = function() {
      if (window.currentAction) {
        window.currentAction.stop();
        window.currentAction = null;
      }
      if (window.mixer) window.mixer.stopAllAction();
      setStatus('Detenido');
      setTimeout(function() { document.getElementById('status').style.display='none'; }, 1500);
    };

    // Cambia velocidad
    window.setAnimSpeed = function(speed) {
      window.animSpeed = speed;
      if (window.currentAction) {
        window.currentAction.setEffectiveTimeScale(speed);
      }
    };

    // Mueve un hueso especifico
    window.setBoneRotation = function(boneName, x, y, z) {
      if (!window.currentModel) return;
      window.currentModel.traverse(function(obj) {
        if (obj.isBone && obj.name === boneName) {
          obj.rotation.x = x;
          obj.rotation.y = y;
          obj.rotation.z = z;
        }
      });
    };

    // Lista los huesos del modelo
    window.listBones = function() {
      var bones = [];
      if (window.currentModel) {
        window.currentModel.traverse(function(obj) {
          if (obj.isBone) bones.push(obj.name);
        });
      }
      postToRN({ type: 'BONES_LIST', bones: bones });
    };

  })();
  </script>
</body>
</html>`;

      const dest = FileSystem.documentDirectory + 'viewer.html';
      await FileSystem.writeAsStringAsync(dest, html, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log('HTML escrito, tamaño:', html.length);
      setHtmlUri(dest);
      setPreparing(false);

    } catch (e) {
      console.error('Error preparando visor:', e);
      setPreparing(false);
    }
  };

  const handleWebViewMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      console.log('MSG:', msg.type);
      if (msg.type === 'ANIMATIONS_READY') {
        setAnimations(msg.animations);
        setShowAnimPanel(msg.animations.length > 0);
        setCurrentAnim(null);
        setIsPaused(false);
      } else if (msg.type === 'BONES_LIST') {
        setBones(msg.bones);
        console.log('Huesos:', msg.bones);
      } else if (msg.type === 'ERROR') {
        console.error('Error WebView:', msg.msg);
      }
    } catch (err) {
      console.error('parse error:', err);
    }
  };

  const pickModel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      console.log('Archivo:', file.name, 'tamaño:', file.size);
      setLoading(true);

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('Base64 length:', base64.length);

      const safeName = file.name.replace(/[`\\$'"]/g, '');

      // Divide en chunks de 50KB e inyecta uno por uno
      const CHUNK = 50000;
      const chunks: string[] = [];
      for (let i = 0; i < base64.length; i += CHUNK) {
        chunks.push(base64.slice(i, i + CHUNK));
      }
      console.log('Enviando modelo en', chunks.length, 'chunks');

      // Inicializa el buffer en el WebView
      webviewRef.current?.injectJavaScript(`
        window._mb = new Array(${chunks.length});
        window._mt = ${chunks.length};
        window._mr = 0;
        window._mn = '${safeName}';
        document.getElementById('status').style.display = 'block';
        document.getElementById('status').style.color = '#fff';
        document.getElementById('status').textContent = 'Recibiendo modelo...';
        true;
      `);

      // Envía cada chunk con delay
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const escaped = chunk.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        await new Promise<void>(resolve => {
          setTimeout(() => {
            webviewRef.current?.injectJavaScript(`
              window._mb[${i}] = \`${escaped}\`;
              window._mr++;
              document.getElementById('status').textContent = 'Recibiendo ' + window._mr + '/${chunks.length}...';
              if (window._mr === window._mt) {
                document.getElementById('status').textContent = 'Procesando modelo...';
                window.loadModel(window._mb.join(''), window._mn);
                window._mb = null;
              }
              true;
            `);
            resolve();
          }, i * 50);
        });
      }

      setLoading(false);
    } catch (e) {
      console.error('Error modelo:', e);
      setLoading(false);
    }
  };

  if (preparing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6c63ff" />
        <Text style={{ color: '#fff', marginTop: 16 }}>Preparando visor 3D...</Text>
      </View>
    );
  }

 return (
    <View style={styles.container}>
      {preparing ? (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={{ color: '#fff', marginTop: 16 }}>Preparando visor 3D...</Text>
        </View>
      ) : (
        <>
          {htmlUri && (
            <WebView
              ref={webviewRef}
              style={styles.webview}
              source={{ uri: 'file://' + htmlUri.replace('file://', '') }}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              allowFileAccessFromFileURLs={true}
              scrollEnabled={false}
              bounces={false}
              onError={(e) => console.error('WebView error:', e.nativeEvent)}
              onMessage={handleWebViewMessage}
            />
          )}

          {/* Panel de animaciones */}
          {showAnimPanel && (
            <View style={styles.animPanel}>
              <Text style={styles.panelTitle}>🎬 Animaciones</Text>

              {/* Lista de animaciones */}
              <View style={styles.animList}>
                {animations.map((anim) => (
                  <TouchableOpacity
                    key={anim.index}
                    style={[styles.animBtn, currentAnim === anim.index && styles.animBtnActive]}
                    onPress={() => {
                      setCurrentAnim(anim.index);
                      setIsPaused(false);
                      webviewRef.current?.injectJavaScript(
                        `window.playAnimation(${anim.index}, ${speed}); true;`
                      );
                    }}
                  >
                    <Text style={styles.animBtnText}>{anim.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Controles */}
              {currentAnim !== null && (
                <View style={styles.controls2}>
                  <TouchableOpacity
                    style={styles.ctrlBtn}
                    onPress={() => {
                      setIsPaused(!isPaused);
                      webviewRef.current?.injectJavaScript('window.pauseAnimation(); true;');
                    }}
                  >
                    <Text style={styles.ctrlBtnText}>{isPaused ? '▶️' : '⏸️'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.ctrlBtn}
                    onPress={() => {
                      setCurrentAnim(null);
                      setIsPaused(false);
                      webviewRef.current?.injectJavaScript('window.stopAnimation(); true;');
                    }}
                  >
                    <Text style={styles.ctrlBtnText}>⏹️</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Control de velocidad */}
              <View style={styles.speedRow}>
                <Text style={styles.speedLabel}>Velocidad: {speed.toFixed(1)}x</Text>
                <View style={styles.speedBtns}>
                  {[0.25, 0.5, 1.0, 1.5, 2.0].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.speedBtn, speed === s && styles.speedBtnActive]}
                      onPress={() => {
                        setSpeed(s);
                        webviewRef.current?.injectJavaScript(`window.setAnimSpeed(${s}); true;`);
                      }}
                    >
                      <Text style={styles.speedBtnText}>{s}x</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Botón listar huesos */}
              <TouchableOpacity
                style={styles.bonesBtn}
                onPress={() => {
                  webviewRef.current?.injectJavaScript('window.listBones(); true;');
                }}
              >
                <Text style={styles.bonesBtnText}>🦴 Ver huesos ({bones.length})</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botón cargar modelo */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.button} onPress={pickModel}>
              <Text style={styles.buttonText}>📂 Cargar modelo GLB</Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#6c63ff" />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  webview: { flex: 1 },
  animPanel: {
    position: 'absolute',
    top: 60,
    right: 10,
    width: 180,
    backgroundColor: 'rgba(16,16,40,0.95)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#6c63ff',
  },
  panelTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  animList: { marginBottom: 8 },
  animBtn: {
    backgroundColor: '#2a2a4e',
    padding: 7,
    borderRadius: 6,
    marginBottom: 4,
  },
  animBtnActive: { backgroundColor: '#6c63ff' },
  animBtnText: { color: '#fff', fontSize: 11, textAlign: 'center' },
  controls2: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  ctrlBtn: {
    backgroundColor: '#2a2a4e',
    padding: 8,
    borderRadius: 8,
    width: 44,
    alignItems: 'center',
  },
  ctrlBtnText: { fontSize: 18 },
  speedRow: { marginBottom: 8 },
  speedLabel: { color: '#aaa', fontSize: 11, marginBottom: 4 },
  speedBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  speedBtn: {
    backgroundColor: '#2a2a4e',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  speedBtnActive: { backgroundColor: '#6c63ff' },
  speedBtnText: { color: '#fff', fontSize: 10 },
  bonesBtn: {
    backgroundColor: '#2a2a4e',
    padding: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  bonesBtnText: { color: '#aaa', fontSize: 11 },
  bottomBar: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#6c63ff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 5,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});