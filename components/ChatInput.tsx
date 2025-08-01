import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface ChatInputProps {
  input: string;
  onChangeInput: (text: string) => void;
  onSend: () => void;
  onImport: () => void;
  loading: boolean;
  evaluating: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  onChangeInput,
  onSend,
  onImport,
  loading,
  evaluating,
}) => {
  const disabled = loading || evaluating;
  const isInputEmpty = !input.trim();

  return (
    <View style={[styles.inputContainer, disabled && styles.disabled]}>
      <TextInput
        key={Platform.OS === 'android' ? 'android-input' : 'default-input'} // 👈 Fix per Android crash
        value={input}
        onChangeText={onChangeInput}
        placeholder="Scrivi un messaggio..."
        style={styles.input}
        multiline
        editable={!disabled}
      />

      <TouchableOpacity
        onPress={onImport}
        style={styles.iconButton}
        disabled={disabled}
      >
        <MaterialCommunityIcons name="plus-circle-outline" size={28} color="#007AFF" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onSend}
        style={styles.iconButton}
        disabled={disabled || isInputEmpty}
      >
        <MaterialCommunityIcons
          name="send-circle"
          size={28}
          color={isInputEmpty ? '#a9a9a9' : '#007AFF'}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  disabled: {
    backgroundColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    marginRight: 10,
    maxHeight: 120,
  },
  iconButton: {
    padding: 5,
  },
});

export default ChatInput;
