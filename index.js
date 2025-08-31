/**
 * @format
 */

import React from 'react'; // 👈 1. Aggiungi questo import
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import { SpeechRecognitionRootView } from 'react-native-voicebox-speech-rec'; // 👈 2. Aggiungi questo import

// 👇 3. Crea un nuovo componente "Root" che avvolge la tua App con il Provider
const Root = () => (
  <SpeechRecognitionRootView>
    <App />
  </SpeechRecognitionRootView>
);

// 👇 4. Registra il nuovo componente "Root" invece del vecchio "App"
AppRegistry.registerComponent(appName, () => Root);