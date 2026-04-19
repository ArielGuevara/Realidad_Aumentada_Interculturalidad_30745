import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, StatusBar
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width, height } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function WelcomeScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

      {/* Fondo con círculos decorativos */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Logo */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.logoEmoji}>🤖</Text>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>AR</Text>
          </View>
        </Animated.View>

        {/* Título */}
        <Text style={styles.title}>AR Humanoid</Text>
        <Text style={styles.subtitle}>Viewer</Text>
        <Text style={styles.description}>
          Carga, visualiza y anima modelos 3D humanoides con realidad aumentada
        </Text>

        {/* Features */}
        <View style={styles.features}>
          {[
            { icon: '📦', text: 'Modelos GLB/GLTF' },
            { icon: '🎬', text: 'Animaciones' },
            { icon: '📷', text: 'Realidad Aumentada' },
            { icon: '🦴', text: 'Control de huesos' },
          ].map((f, i) => (
            <View key={i} style={styles.featureItem}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Botón principal */}
        <TouchableOpacity
          style={styles.mainButton}
          onPress={() => navigation.replace('Main')}
          activeOpacity={0.8}
        >
          <Text style={styles.mainButtonText}>Comenzar →</Text>
        </TouchableOpacity>

        <Text style={styles.version}>v1.0.0</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a', justifyContent: 'center', alignItems: 'center' },
  circle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(108,99,255,0.15)', top: -50, right: -80 },
  circle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(108,99,255,0.1)', bottom: 100, left: -60 },
  circle3: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,99,200,0.08)', bottom: -30, right: 50 },
  content: { alignItems: 'center', paddingHorizontal: 30, width: '100%' },
  logoContainer: { width: 100, height: 100, backgroundColor: 'rgba(108,99,255,0.2)', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 2, borderColor: 'rgba(108,99,255,0.5)' },
  logoEmoji: { fontSize: 50 },
  logoBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#6c63ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  logoBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  title: { fontSize: 42, fontWeight: 'bold', color: '#ffffff', letterSpacing: 2 },
  subtitle: { fontSize: 42, fontWeight: 'bold', color: '#6c63ff', letterSpacing: 2, marginTop: -8 },
  description: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 16, marginBottom: 32, lineHeight: 22 },
  features: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 40 },
  featureItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(108,99,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', gap: 6 },
  featureIcon: { fontSize: 16 },
  featureText: { color: '#ccc', fontSize: 12 },
  mainButton: { backgroundColor: '#6c63ff', paddingHorizontal: 50, paddingVertical: 16, borderRadius: 30, elevation: 8, shadowColor: '#6c63ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  mainButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  version: { color: '#444', fontSize: 11, marginTop: 24 },
});