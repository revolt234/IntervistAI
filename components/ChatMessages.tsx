import React, { useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Modal
} from 'react-native';

interface ChatMessagesProps {
  chat: { role: 'user' | 'bot'; message: string }[];
  loading: boolean;
  evaluating: boolean;
  problemOptions: any[];
  onEvaluateSingleProblem: (problem: any) => void;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  chat,
  loading,
  evaluating,
  problemOptions,
  onEvaluateSingleProblem
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const [dropdownVisible, setDropdownVisible] = React.useState(false);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {chat
          .filter(msg => msg.message !== 'INIZIO_INTERVISTA_NASCOSTO')
          .map((msg, index) => (
            <View
              key={index}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? '#dcf8c6' : '#eee',
                padding: 10,
                marginVertical: 4,
                borderRadius: 8,
                maxWidth: '80%',
              }}
            >
              <Text>{msg.message}</Text>
            </View>
          ))}

        {(loading || evaluating) && (
          <View style={{ alignSelf: 'flex-start', padding: 10, backgroundColor: '#eee', borderRadius: 8 }}>
            <ActivityIndicator size="small" color="#0000ff" />
            <Text>{evaluating ? 'Generando report...' : 'Caricando...'}</Text>
          </View>
        )}
      </ScrollView>

      {chat.length > 0 && problemOptions.length > 0 && (
        <View style={{ paddingHorizontal: 10, marginBottom: 10 }}>
          <TouchableOpacity
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 5,
              padding: 12,
              backgroundColor: '#f5f5f5',
            }}
            onPress={() => setDropdownVisible(true)}
          >
            <Text style={{ color: '#333' }}>📋 Seleziona un fenomeno da valutare</Text>
          </TouchableOpacity>

          <Modal
            visible={dropdownVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDropdownVisible(false)}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
              activeOpacity={1}
              onPressOut={() => setDropdownVisible(false)}
            >
              <View
                style={{
                  marginTop: 100,
                  marginHorizontal: 20,
                  backgroundColor: 'white',
                  borderRadius: 8,
                  padding: 10,
                  maxHeight: 300,
                }}
              >
                <ScrollView>
                  {problemOptions.map((problem, index) => (
                    <TouchableOpacity
                      key={index}
                      style={{
                        padding: 12,
                        borderBottomWidth: 1,
                        borderColor: '#eee',
                      }}
                      onPress={() => {
                        setDropdownVisible(false);
                        onEvaluateSingleProblem(problem);
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{problem.fenomeno}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}
    </>
  );
};

export default ChatMessages;
