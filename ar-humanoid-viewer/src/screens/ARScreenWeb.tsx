import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';

export default function ARScreenWeb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [animations, setAnimations] = useState<{index: number, name: string}[]>([]);
  const [currentAnim, setCurrentAnim] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    initScene();
    return () => {
      if (sceneRef.current?.animFrame) {
        cancelAnimationFrame(sceneRef.current.animFrame);
      }
    };
  }, []);

  const initScene = async () => {
    try {
      // Carga Three.js dinámicamente en web
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

      const canvas = canvasRef.current!;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x1a1a2e, 1);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
      camera.position.set(0, 1.5, 4);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dl = new THREE.DirectionalLight(0xffffff, 1.0);
      dl.position.set(5, 10, 5);
      scene.add(dl);
      scene.add(new THREE.GridHelper(10, 10, 0x444466, 0x333355));

      const clock = new THREE.Clock();
      let mixer: any = null;
      let currentModel: any = null;
      let currentAction: any = null;

      const animate = () => {
        if (!sceneRef.current) return;
        sceneRef.current.animFrame = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);
        renderer.render(scene, camera);
      };

      // Primero asigna sceneRef, luego inicia el loop
      sceneRef.current = {
        THREE, GLTFLoader, scene, camera, renderer, clock,
        getMixer: () => mixer,
        setMixer: (m: any) => { mixer = m; },
        getCurrentModel: () => currentModel,
        setCurrentModel: (m: any) => { currentModel = m; },
        getCurrentAction: () => currentAction,
        setCurrentAction: (a: any) => { currentAction = a; },
        animList: [] as any[],
        initialScale: 1,
        animFrame: 0,
      };

      animate(); // Inicia después de asignar sceneRef

      window.addEventListener('resize', () => {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      });

      sceneRef.current = {
        THREE, GLTFLoader, scene, camera, renderer, clock,
        getMixer: () => mixer,
        setMixer: (m: any) => { mixer = m; },
        getCurrentModel: () => currentModel,
        setCurrentModel: (m: any) => { currentModel = m; },
        getCurrentAction: () => currentAction,
        setCurrentAction: (a: any) => { currentAction = a; },
        animList: [] as any[],
      };

    } catch (e) {
      console.error('Error iniciando escena web:', e);
    }
  };

  const pickModel = async () => {
    try {
      // En web usamos input file
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.glb,.gltf';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true);

        const arrayBuffer = await file.arrayBuffer();
        const sc = sceneRef.current;
        if (!sc) return;

        const { THREE, GLTFLoader, scene } = sc;

        // Elimina modelo anterior
        if (sc.getCurrentModel()) {
          scene.remove(sc.getCurrentModel());
          sc.setCurrentModel(null);
        }
        if (sc.getMixer()) {
          sc.getMixer().stopAllAction();
          sc.setMixer(null);
        }

        const loader = new GLTFLoader();
        loader.parse(arrayBuffer, '', (gltf: any) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.0 / maxDim;
          model.scale.setScalar(scale);
          model.position.sub(center.multiplyScalar(scale));
          model.position.y = 0;
          scene.add(model);
          sc.initialScale = scale;
          sc.setCurrentModel(model);

          const animList = gltf.animations || [];
          sc.animList = animList;

          if (animList.length > 0) {
            const newMixer = new THREE.AnimationMixer(model);
            sc.setMixer(newMixer);
            setAnimations(animList.map((a: any, i: number) => ({
              index: i,
              name: a.name || `Anim ${i}`,
            })));
          } else {
            setAnimations([]);
          }

          setModelLoaded(true);
          setLoading(false);
        }, (err: any) => {
          console.error('Error GLTF:', err);
          setLoading(false);
        });
      };
      input.click();
    } catch (e) {
      console.error('Error modelo:', e);
      setLoading(false);
    }
  };

  const playAnimation = (index: number) => {
    const sc = sceneRef.current;
    if (!sc?.getMixer() || !sc.animList[index]) return;
    if (sc.getCurrentAction()) sc.getCurrentAction().fadeOut(0.3);
    const clip = sc.animList[index];
    const action = sc.getMixer().clipAction(clip);
    action.setEffectiveTimeScale(speed);
    action.reset().fadeIn(0.3).play();
    sc.setCurrentAction(action);
    setCurrentAnim(index);
    setIsPaused(false);
  };

  const pauseAnimation = () => {
    const action = sceneRef.current?.getCurrentAction();
    if (action) {
      action.paused = !action.paused;
      setIsPaused(action.paused);
    }
  };

  const stopAnimation = () => {
    const sc = sceneRef.current;
    if (sc?.getCurrentAction()) { sc.getCurrentAction().stop(); sc.setCurrentAction(null); }
    if (sc?.getMixer()) sc.getMixer().stopAllAction();
    setCurrentAnim(null);
    setIsPaused(false);
  };

  const scaleModel = (factor: number) => {
    const sc = sceneRef.current;
    const model = sc?.getCurrentModel();
    if (model && sc?.initialScale) {
      const min = sc.initialScale * 0.3;
      const max = sc.initialScale * 3.0;
      const next = Math.max(min, Math.min(max, model.scale.x * factor));
      model.scale.setScalar(next);
    }
  };

  const rotateModel = (deg: number) => {
    const model = sceneRef.current?.getCurrentModel();
    if (model) model.rotation.y += deg * Math.PI / 180;
  };

  const resetModel = () => {
    const sc = sceneRef.current;
    const model = sc?.getCurrentModel();
    if (model && sc?.initialScale) {
      model.scale.setScalar(sc.initialScale);
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
    }
  };

  // Mouse drag para rotar en web
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: any) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: any) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    const model = sceneRef.current?.getCurrentModel();
    if (model) {
      model.rotation.y += dx * 0.01;
      model.rotation.x += dy * 0.01;
    }
  };
  const onMouseUp = () => { isDragging.current = false; };

  const onWheel = (e: any) => {
    e.preventDefault();
    scaleModel(e.deltaY < 0 ? 1.05 : 0.95);
  };

  return (
    <View style={styles.container}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' } as any}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      />

      {/* Botones de control */}
      {modelLoaded && (
        <View style={styles.scaleControls}>
          <TouchableOpacity style={styles.scaleBtn} onPress={() => scaleModel(1.1)}>
            <Text style={styles.scaleBtnText}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scaleBtn} onPress={() => scaleModel(0.9)}>
            <Text style={styles.scaleBtnText}>－</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scaleBtn} onPress={() => rotateModel(15)}>
            <Text style={styles.scaleBtnText}>↻</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.scaleBtn, { backgroundColor: 'rgba(255,100,100,0.8)' }]} onPress={resetModel}>
            <Text style={styles.scaleBtnText}>⟳</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Panel animaciones */}
      {animations.length > 0 && (
        <View style={styles.animPanel}>
          <Text style={styles.panelTitle}>🎬 Animaciones</Text>
          {animations.map((anim) => (
            <TouchableOpacity
              key={anim.index}
              style={[styles.animBtn, currentAnim === anim.index && styles.animBtnActive]}
              onPress={() => playAnimation(anim.index)}
            >
              <Text style={styles.animBtnText}>{anim.name}</Text>
            </TouchableOpacity>
          ))}
          {currentAnim !== null && (
            <View style={styles.ctrlRow}>
              <TouchableOpacity style={styles.ctrlBtn} onPress={pauseAnimation}>
                <Text style={styles.ctrlBtnText}>{isPaused ? '▶️' : '⏸️'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={stopAnimation}>
                <Text style={styles.ctrlBtnText}>⏹️</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.speedRow}>
            {[0.5, 1.0, 1.5, 2.0].map((s) => (
              <TouchableOpacity key={s}
                style={[styles.speedBtn, speed === s && styles.speedBtnActive]}
                onPress={() => {
                  setSpeed(s);
                  const action = sceneRef.current?.getCurrentAction();
                  if (action) action.setEffectiveTimeScale(s);
                }}>
                <Text style={styles.speedBtnText}>{s}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {modelLoaded && animations.length === 0 && (
        <View style={styles.noAnimPanel}>
          <Text style={styles.noAnimText}>📭 Sin animaciones</Text>
        </View>
      )}

      {modelLoaded && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>🖱️ Arrastrar: rotar  🖱️ Scroll: zoom</Text>
        </View>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.button} onPress={pickModel}>
          <Text style={styles.buttonText}>📂 Cargar GLB</Text>
        </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  animPanel: {
    position: 'absolute', top: 20, right: 10, width: 160,
    backgroundColor: 'rgba(16,16,40,0.95)', borderRadius: 12,
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
  scaleControls: { position: 'absolute', left: 10, top: '40%', gap: 8 },
  scaleBtn: { backgroundColor: 'rgba(108,99,255,0.8)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  scaleBtnText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  noAnimPanel: { position: 'absolute', top: 20, right: 10, backgroundColor: 'rgba(16,16,40,0.85)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)' },
  noAnimText: { color: '#888', fontSize: 11 },
  hint: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  hintText: { color: '#fff', fontSize: 12 },
  bottomBar: { position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  button: { backgroundColor: '#6c63ff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, elevation: 5 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
});