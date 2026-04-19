import React from 'react';
import { StatusBar } from 'expo-status-bar';
import ViewerScreen from './src/screens/ViewerScreen';

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <ViewerScreen />
    </>
  );
}