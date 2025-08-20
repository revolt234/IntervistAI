// file: components/LiveIndicator.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LiveIndicatorProps {
  isListening: boolean;
  recognizedText: string;
}

const LiveIndicator: React.FC<LiveIndicatorProps> = ({ isListening, recognizedText }) => {
  return (
    <View style={styles.container}>
      {isListening ? (
        <>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.text}>In ascolto...</Text>
        </>
      ) : (
        <Text style={styles.text}>Parla per rispondere</Text>
      )}
      {recognizedText ? <Text style={styles.recognizedText}>"{recognizedText}"</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#d32f2f', // Rosso per indicare che sta registrando
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    color: '#fff',
    marginLeft: 10,
    fontWeight: 'bold',
  },
  recognizedText: {
    color: '#ffcdd2',
    marginLeft: 15,
    fontStyle: 'italic',
  },
});

export default LiveIndicator;