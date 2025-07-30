import React from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';

interface ChatInputProps {
  input: string;
  onChangeInput: (text: string) => void;
  onSend: () => void;
  loading: boolean;
  evaluating: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  onChangeInput,
  onSend,
  loading,
  evaluating,
}) => {
  const disabled = loading || evaluating;

  return (
    <View style={[styles.inputContainer, disabled && styles.disabled]}>
      <TextInput
        value={input}
        onChangeText={onChangeInput}
        placeholder="Scrivi un messaggio..."
        style={styles.input}
        multiline
        editable // sempre true, per permettere all’utente di scrivere anche se l’input è vuoto
      />
      <Button
        title="Invia"
        onPress={onSend}
        disabled={disabled || !input.trim()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
    marginRight: 8,
    borderColor: '#ccc',
  },
});

export default ChatInput;
