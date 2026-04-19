import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ThreeViewer from '../components/ThreeViewer';

export default function ViewerScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🤖 AR Humanoid Viewer</Text>
        <Text style={styles.subtitle}>Visor 3D activo</Text>
      </View>
      <ThreeViewer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#16213e',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    color: '#6c63ff',
    marginTop: 2,
  },
});