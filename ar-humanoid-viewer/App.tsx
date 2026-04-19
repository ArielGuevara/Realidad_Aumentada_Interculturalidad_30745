import React from 'react';
import { StatusBar } from 'expo-status-bar';
import ARScreen from './src/screens/ARScreen';

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <ARScreen />
    </>
  );
}