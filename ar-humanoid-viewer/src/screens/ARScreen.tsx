import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text,
  ActivityIndicator, PanResponder, Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Asset } from 'expo-asset';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ARScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [animations, setAnimations] = useState<{index: number, name: string}[]>([]);
  const [currentAnim, setCurrentAnim] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [showControls, setShowControls] = useState(true);
  const webviewRef = useRef<WebView>(null);

  // Posición y escala del modelo AR
  const modelPos = useRef({ x: 0, y: 0, scale: 1.0 });

  useEffect(() => {
    requestPermission();
    prepareViewer();
  }, []);

  const prepareViewer = async () => {
    try {
      setPreparing(true);
      const threeAsset = Asset.fromModule(require('../assets/three.cjs.txt'));
      const gltfAsset = Asset.fromModule(require('../assets/GLTFLoader.js.txt'));
      const bgUtilsAsset = Asset.fromModule(require('../assets/BufferGeometryUtils.js.txt'));
      await Promise.all([threeAsset.downloadAsync(), gltfAsset.downloadAsync(), bgUtilsAsset.downloadAsync()]);
      const [threeCode, gltfCode, bgUtilsCode] = await Promise.all([
        FileSystem.readAsStringAsync(threeAsset.localUri!),
        FileSystem.readAsStringAsync(gltfAsset.localUri!),
        FileSystem.readAsStringAsync(bgUtilsAsset.localUri!),
      ]);

      let patchedBgUtils = bgUtilsCode
        .replace(/import\s*\{([^}]*)\}\s*from\s*['"]three['"]\s*;?/g, (_, imp) =>
          imp.split(',').map((s: string) => {
            s = s.trim(); const p = s.split(/\s+as\s+/);
            return p.length === 2 ? `var ${p[1].trim()} = THREE["${p[0].trim()}"];` : `var ${s} = THREE["${s}"];`;
          }).join('\n'))
        .replace(/export\s*\{([^}]*)\}\s*;?/g, (_, names) =>
          names.split(',').map((s: string) => {
            s = s.trim(); const p = s.split(/\s+as\s+/);
            const local = p[0].trim(); const exp = p.length === 2 ? p[1].trim() : local;
            return `window.${exp} = ${local};`;
          }).join('\n'))
        .replace(/export\s+default\s+/g, 'window._BGD=')
        .replace(/export\s+(class|function|const|let|var)\s+(\w+)/g, 'window.$2=$1 $2');

      let patchedGltf = gltfCode
        .replace(/import\s*\{([^}]*)\}\s*from\s*['"]three['"]\s*;?/g, (_, imp) =>
          imp.split(',').map((s: string) => {
            s = s.trim(); const p = s.split(/\s+as\s+/);
            return p.length === 2 ? `var ${p[1].trim()} = THREE["${p[0].trim()}"];` : `var ${s} = THREE["${s}"];`;
          }).join('\n'))
        .replace(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*BufferGeometryUtils[^'"]*['"]\s*;?/g, (_, imp) =>
          imp.split(',').map((s: string) => {
            s = s.trim(); const p = s.split(/\s+as\s+/);
            const local = p[0].trim(); const alias = p.length === 2 ? p[1].trim() : local;
            return `var ${alias} = window.${local};`;
          }).join('\n'))
        .replace(/export\s*\{([^}]*)\}\s*;?/g, (_, names) =>
          names.split(',').map((s: string) => {
            s = s.trim(); const p = s.split(/\s+as\s+/);
            const local = p[0].trim(); const exp = p.length === 2 ? p[1].trim() : local;
            return `window.${exp} = ${local};`;
          }).join('\n'))
        .replace(/export\s+default\s+/g, 'window._GD=')
        .replace(/export\s+(class|function|const|let|var)\s+(\w+)/g, 'window.$2=$1 $2')
        .replace('class GLTFLoader extends Loader', 'var GLTFLoader = class GLTFLoader extends Loader');

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent !important; overflow: hidden; width: 100vw; height: 100vh; }
    canvas { display: block; width: 100vw; height: 100vh; background: transparent !important; }
    #status {
      position: fixed; top: 10px; left: 10px; right: 10px;
      color: #fff; font-size: 12px; font-family: monospace;
      background: rgba(0,0,0,0.6); padding: 6px; border-radius: 6px;
      z-index: 999;
    }
  </style>
</head>
<body>
  <div id="status">Iniciando AR...</div>
  <script>
  (function(){
    var module = { exports: {} }; var exports = module.exports;
    ${threeCode}
    window.THREE = module.exports;
  })();
  </script>
  <script>
  (function(){ var THREE = window.THREE; ${patchedBgUtils} })();
  </script>
  <script>
  (function(){
    var THREE = window.THREE; var GLTFLoader;
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
      if (!el) return;
      el.style.color = color || '#fff';
      el.style.display = 'block';
      el.textContent = msg;
    }

    var THREE = window.THREE;
    window.mixer = null;
    window.clock = new THREE.Clock();
    window.animations = [];
    window.currentAction = null;
    window.currentModel = null;

    try {
      if (!window.THREE.Scene) throw new Error('THREE no cargado');
      if (!window.GLTFLoader) throw new Error('GLTFLoader no cargado');

      window.scn = new THREE.Scene();
      // Fondo transparente para AR
      window.cam = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
      window.cam.position.set(0, 0, 3);

      window.rnd = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      window.rnd.setSize(window.innerWidth, window.innerHeight);
      window.rnd.setPixelRatio(window.devicePixelRatio);
      window.rnd.setClearColor(0x000000, 0); // Transparente
      window.rnd.shadowMap.enabled = true;
      document.body.appendChild(window.rnd.domElement);

      window.scn.add(new THREE.AmbientLight(0xffffff, 0.8));
      var dl = new THREE.DirectionalLight(0xffffff, 1.0);
      dl.position.set(5, 10, 5);
      dl.castShadow = true;
      window.scn.add(dl);
      var dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
      dl2.position.set(-5, -5, -5);
      window.scn.add(dl2);

      window.addEventListener('resize', function() {
        window.cam.aspect = window.innerWidth/window.innerHeight;
        window.cam.updateProjectionMatrix();
        window.rnd.setSize(window.innerWidth, window.innerHeight);
      });

      (function animate() {
        requestAnimationFrame(animate);
        var delta = window.clock.getDelta();
        if (window.mixer) window.mixer.update(delta);
        window.rnd.render(window.scn, window.cam);
      })();

      setTimeout(function() { document.getElementById('status').style.display='none'; }, 2000);
      postToRN({ type: 'SCENE_READY' });

    } catch(e) {
      setStatus('ERROR: ' + e.message, '#ff4444');
      postToRN({ type: 'ERROR', msg: e.message });
    }

    window.loadModel = function(base64, name) {
      try {
        setStatus('Cargando: ' + name);
        document.getElementById('status').style.display = 'block';
        if (window.currentModel) { window.scn.remove(window.currentModel); window.currentModel = null; }
        if (window.mixer) { window.mixer.stopAllAction(); window.mixer = null; }

        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        var loader = new window.GLTFLoader();
        loader.parse(bytes.buffer, '', function(gltf) {
          window.currentModel = gltf.scene;
          var box = new THREE.Box3().setFromObject(window.currentModel);
          var center = box.getCenter(new THREE.Vector3());
          var size = box.getSize(new THREE.Vector3());
          var maxDim = Math.max(size.x, size.y, size.z);
          var scale = 1.5 / maxDim;
          window.currentModel.scale.setScalar(scale);
          window.currentModel.position.sub(center.multiplyScalar(scale));
          window.currentModel.position.y = -0.5;
          window.initialScale = scale;
          window.scn.add(window.currentModel);

          window.animations = gltf.animations || [];
          if (window.animations.length > 0) {
            window.mixer = new THREE.AnimationMixer(window.currentModel);
            var animNames = window.animations.map(function(a, i) {
              return { index: i, name: a.name || ('Anim ' + i) };
            });
            postToRN({ type: 'ANIMATIONS_READY', animations: animNames });
          } else {
            postToRN({ type: 'ANIMATIONS_READY', animations: [] });
          }
          setStatus('¡Modelo en AR!');
          setTimeout(function() { document.getElementById('status').style.display='none'; }, 2000);
          postToRN({ type: 'MODEL_LOADED', name: name });
        }, function(err) {
          setStatus('ERROR: ' + (err.message||err), '#ff4444');
        });
      } catch(e) {
        setStatus('ERROR: ' + e.message, '#ff4444');
      }
    };

    window.playAnimation = function(index, speed) {
      if (!window.mixer || !window.animations[index]) return;
      if (window.currentAction) window.currentAction.fadeOut(0.3);
      var clip = window.animations[index];
      window.currentAction = window.mixer.clipAction(clip);
      window.currentAction.setEffectiveTimeScale(speed || 1.0);
      window.currentAction.reset().fadeIn(0.3).play();
    };

    window.pauseAnimation = function() {
      if (window.currentAction) window.currentAction.paused = !window.currentAction.paused;
    };

    window.stopAnimation = function() {
      if (window.currentAction) { window.currentAction.stop(); window.currentAction = null; }
      if (window.mixer) window.mixer.stopAllAction();
    };

    window.setAnimSpeed = function(s) {
      if (window.currentAction) window.currentAction.setEffectiveTimeScale(s);
    };

    // Mueve el modelo en la escena AR
    window.moveModel = function(dx, dy) {
      if (window.currentModel) {
        window.currentModel.position.x += dx * 0.003;
        window.currentModel.position.y -= dy * 0.003;
      }
    };

    // Rota el modelo
    window.rotateModel = function(dy) {
      if (window.currentModel) window.currentModel.rotation.y += dy * 0.01;
    };

    // Escala el modelo
    window.scaleModel = function(factor) {
      if (!window.currentModel) return;
      var current = window.currentModel.scale.x;
      var next = current * factor;
      var min = window.initialScale * 0.3;
      var max = window.initialScale * 3.0;
      next = Math.max(min, Math.min(max, next));
      window.currentModel.scale.setScalar(next);
    };

    window.resetScale = function() {
      if (window.currentModel && window.initialScale) {
        window.currentModel.scale.setScalar(window.initialScale);
        window.currentModel.position.set(0, -0.5, 0);
      }
    };

  })();
  </script>
</body>
</html>`;

      const dest = FileSystem.documentDirectory + 'ar_viewer.html';
      await FileSystem.writeAsStringAsync(dest, html, { encoding: FileSystem.EncodingType.UTF8 });
      setHtmlUri(dest);
      setPreparing(false);
    } catch (e) {
      console.error('Error preparando AR:', e);
      setPreparing(false);
    }
  };

  const handleWebViewMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ANIMATIONS_READY') {
        setAnimations(msg.animations);
        setCurrentAnim(null);
      } else if (msg.type === 'MODEL_LOADED') {
        setModelLoaded(true);
      } else if (msg.type === 'ERROR') {
        console.error('AR Error:', msg.msg);
      }
    } catch (e) {}
  };

  const pickModel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setLoading(true);
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const safeName = file.name.replace(/[`\\$'"]/g, '');
      const CHUNK = 50000;
      const chunks: string[] = [];
      for (let i = 0; i < base64.length; i += CHUNK) chunks.push(base64.slice(i, i + CHUNK));

      webviewRef.current?.injectJavaScript(`
        window._mb = new Array(${chunks.length}); window._mt = ${chunks.length}; window._mr = 0; window._mn = '${safeName}'; true;
      `);
      for (let i = 0; i < chunks.length; i++) {
        const escaped = chunks[i].replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        await new Promise<void>(resolve => setTimeout(() => {
          webviewRef.current?.injectJavaScript(`
            window._mb[${i}] = \`${escaped}\`; window._mr++;
            if (window._mr === window._mt) { window.loadModel(window._mb.join(''), window._mn); window._mb = null; }
            true;
          `);
          resolve();
        }, i * 50));
      }
      setLoading(false);
    } catch (e) {
      console.error('Error modelo:', e);
      setLoading(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        webviewRef.current?.injectJavaScript(
          `window.moveModel(${gs.vx * 5}, ${gs.vy * 5}); true;`
        );
      },
    })
  ).current;

  if (!permission?.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff', marginBottom: 16, textAlign: 'center' }}>
          Se necesita acceso a la cámara para AR
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Permitir Cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (preparing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6c63ff" />
        <Text style={{ color: '#fff', marginTop: 16 }}>Preparando AR...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Cámara de fondo */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* WebView transparente encima */}
      {htmlUri && (
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
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
        </View>
      )}

      {/* Botones de escala */}
      {modelLoaded && (
        <View style={styles.scaleControls}>
          <TouchableOpacity style={styles.scaleBtn} onPress={() => webviewRef.current?.injectJavaScript('window.scaleModel(1.05); true;')}>
            <Text style={styles.scaleBtnText}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scaleBtn} onPress={() => webviewRef.current?.injectJavaScript('window.scaleModel(0.95); true;')}>
            <Text style={styles.scaleBtnText}>－</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scaleBtn} onPress={() => webviewRef.current?.injectJavaScript('window.rotateModel(10); true;')}>
            <Text style={styles.scaleBtnText}>↻</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.scaleBtn, { backgroundColor: 'rgba(255,100,100,0.8)' }]} onPress={() => webviewRef.current?.injectJavaScript('window.resetScale(); true;')}>
            <Text style={styles.scaleBtnText}>⟳</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Panel de animaciones */}
      {animations.length > 0 && showControls && (
        <View style={styles.animPanel}>
          <Text style={styles.panelTitle}>🎬 Animaciones</Text>
          {animations.map((anim) => (
            <TouchableOpacity
              key={anim.index}
              style={[styles.animBtn, currentAnim === anim.index && styles.animBtnActive]}
              onPress={() => {
                setCurrentAnim(anim.index);
                setIsPaused(false);
                webviewRef.current?.injectJavaScript(`window.playAnimation(${anim.index}, ${speed}); true;`);
              }}
            >
              <Text style={styles.animBtnText}>{anim.name}</Text>
            </TouchableOpacity>
          ))}
          {currentAnim !== null && (
            <View style={styles.ctrlRow}>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setIsPaused(!isPaused); webviewRef.current?.injectJavaScript('window.pauseAnimation(); true;'); }}>
                <Text style={styles.ctrlBtnText}>{isPaused ? '▶️' : '⏸️'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => { setCurrentAnim(null); webviewRef.current?.injectJavaScript('window.stopAnimation(); true;'); }}>
                <Text style={styles.ctrlBtnText}>⏹️</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.speedRow}>
            {[0.5, 1.0, 1.5, 2.0].map((s) => (
              <TouchableOpacity key={s} style={[styles.speedBtn, speed === s && styles.speedBtnActive]}
                onPress={() => { setSpeed(s); webviewRef.current?.injectJavaScript(`window.setAnimSpeed(${s}); true;`); }}>
                <Text style={styles.speedBtnText}>{s}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Barra inferior */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.button} onPress={pickModel}>
          <Text style={styles.buttonText}>📂 Cargar GLB</Text>
        </TouchableOpacity>
        {animations.length > 0 && (
          <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowControls(!showControls)}>
            <Text style={styles.buttonText}>{showControls ? '🙈' : '🎬'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={{ color: '#fff', marginTop: 8 }}>Cargando modelo...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  animPanel: {
    position: 'absolute', top: 60, right: 10, width: 160,
    backgroundColor: 'rgba(16,16,40,0.85)', borderRadius: 12,
    padding: 8, borderWidth: 1, borderColor: '#6c63ff',
  },
  panelTitle: { color: '#fff', fontWeight: 'bold', fontSize: 12, marginBottom: 6, textAlign: 'center' },
  animBtn: { backgroundColor: '#2a2a4e', padding: 6, borderRadius: 6, marginBottom: 3 },
  animBtnActive: { backgroundColor: '#6c63ff' },
  animBtnText: { color: '#fff', fontSize: 10, textAlign: 'center' },
  ctrlRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 4 },
  ctrlBtn: { backgroundColor: '#2a2a4e', padding: 6, borderRadius: 6, width: 36, alignItems: 'center' },
  ctrlBtnText: { fontSize: 14 },
  speedRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  speedBtn: { backgroundColor: '#2a2a4e', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 4 },
  speedBtnActive: { backgroundColor: '#6c63ff' },
  speedBtnText: { color: '#fff', fontSize: 9 },
  scaleControls: {
    position: 'absolute', left: 10, top: '40%',
    gap: 8,
  },
  scaleBtn: {
    backgroundColor: 'rgba(108,99,255,0.8)', width: 44, height: 44,
    borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
  scaleBtnText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  bottomBar: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 12,
  },
  button: {
    backgroundColor: '#6c63ff', paddingHorizontal: 20,
    paddingVertical: 12, borderRadius: 30, elevation: 5,
  },
  toggleBtn: {
    backgroundColor: 'rgba(108,99,255,0.7)', paddingHorizontal: 16,
    paddingVertical: 12, borderRadius: 30,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'center',
    alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)',
  },
});