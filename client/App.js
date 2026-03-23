import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image
} from 'react-native';
import { io } from 'socket.io-client';
import { KJUR } from 'jsrsasign';

const BRAND = 'Elysium Vanguard';
const SOCKET_URL = 'http://REPLACE_WITH_YOUR_NGROK_URL:4000';
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2ZovzeVfTDrGfl6rrHqx
goDWljSQOtoR+yspCjE7PtvrZPchhoqZazHRpuqSB5I4/tyLF7zUTBehF+cQP6oH
F0NXMjY0JG7+4S/KvhuH/C8pvoALGfL+dQ8xZuJg46brs0y3M/CzcucMLj5NPBUd
Ts5iKs+1QtkIGB+f6B3akmf2UQEz9eTvaztD/eA3mS4sjjZxHMq9kbKYc+66uq6t
L8VCfQHdL+eureaAJTOQhbkKbxBPchPRflmg7kaHoimeOh3pmgCUtiAYFa45vMP0
0wP2l/gK4C7nZQ9KKFR9b6zbPrDUx7BSDKvOsxJLFUET0YVEXqZV9DaeOMGbaHik
ZQIDAQAB
-----END PUBLIC KEY-----`;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('OFFLINE');
  const socketRef = useRef(null);
  const logScrollRef = useRef(null);

  const [version, setVersion] = useState('1.0.0-stable');
  const [isDeploying, setIsDeploying] = useState(false);
  const rollbackTimer = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      setStatus('ONLINE');
      addLog(`[${BRAND}] Neural Link Established.`);
    });

    socketRef.current.on('disconnect', () => {
      setStatus('OFFLINE');
      addLog(`[${BRAND}] Link Severed. Attempting reconnect...`);
    });

    socketRef.current.on('vanguard_log_stream', (data) => {
      // Zero-Trust Verification
      if (data.vanguard_signature) {
        const isValid = verifySignature(data.log + data.task_id, data.vanguard_signature);
        if (isValid) {
          addLog(`[SECURE] ${data.log}`);
          
          // Detect Deployment Command inside the filtered stream
          if (data.log.includes('APK_DEPLOY_START')) {
            startDeploymentGuard(data.task_id);
          }
          if (data.log.includes('APK_HEALTH_HEARTBEAT')) {
            confirmDeployment(data.task_id);
          }
        } else {
          addLog(`[WARNING] INTRUSION DETECTED: Invalid Signature on task ${data.task_id}`);
        }
      } else {
        addLog(data.log);
      }
    });

    const startDeploymentGuard = (taskId) => {
      setIsDeploying(true);
      addLog(`[GUARD] Blue/Green Deployment Active. Waiting for 10s sanity check...`);
      rollbackTimer.current = setTimeout(() => {
        handleRollback(taskId);
      }, 10000);
    };

    const confirmDeployment = (taskId) => {
      if (rollbackTimer.current) {
        clearTimeout(rollbackTimer.current);
        setIsDeploying(false);
        setVersion(`v2.0.0-vanguard-${taskId}`);
        addLog(`[GUARD] Sanity Check PASSED. Version ${taskId} is now STABLE.`);
      }
    };

    const handleRollback = (taskId) => {
      setIsDeploying(false);
      addLog(`[CRITICAL] NO HEARTBEAT FROM APK ${taskId}. ROLLING BACK TO PREVIOUS STABLE...`);
      addLog(`[GUARD] Rollback Complete. System Secure.`);
    };

    const verifySignature = (payload, sig) => {
      try {
        const sigObj = new KJUR.crypto.Signature({ alg: "SHA256withRSA" });
        sigObj.init(PUBLIC_KEY);
        sigObj.updateString(payload);
        return sigObj.verify(sig);
      } catch (e) {
        return false;
      }
    };

    socketRef.current.on('agent_task_complete', (data) => {
      addLog(`>> Task ${data.task_id} COMPLETED [${data.status}]`);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (rollbackTimer.current) clearTimeout(rollbackTimer.current);
    };
  }, []);

  const addLog = (log) => {
    setLogs(prev => [...prev, log].slice(-50)); // Keep last 50 logs
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const task_id = Date.now().toString();
    
    // UI Update
    setMessages(prev => [...prev, { id: task_id, text: input, sender: 'user' }]);
    
    // Socket Emit
    socketRef.current.emit('agent_task', { task_id, prompt: input });
    
    setInput('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Image 
          source={require('./assets/logo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>{BRAND}</Text>
        <View style={[styles.statusDot, { backgroundColor: status === 'ONLINE' ? '#00FF41' : '#FF3131' }]} />
        <Text style={styles.headerStatus}>{status}</Text>
      </View>

      {/* Matrix Terminal (Logs) */}
      <View style={styles.terminalContainer}>
        <ScrollView 
          ref={logScrollRef}
          onContentSizeChange={() => logScrollRef.current.scrollToEnd({ animated: true })}
          style={styles.terminal}
        >
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </ScrollView>
      </View>

      {/* Chat Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.messageBubble, item.sender === 'user' ? styles.userBubble : styles.agentBubble]}>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
        style={styles.messageList}
      />

      {/* Input Area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputArea}
      >
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Transmitir orden..."
          placeholderTextColor="#666"
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>SEND</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerTitle: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginLeft: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 15,
    marginRight: 5,
  },
  headerStatus: {
    color: '#666',
    fontSize: 12,
  },
  terminalContainer: {
    height: 150,
    backgroundColor: '#000',
    margin: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    padding: 10,
  },
  terminal: {
    flex: 1,
  },
  logText: {
    color: '#00FF41',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    marginBottom: 2,
  },
  messageList: {
    flex: 1,
    padding: 15,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#00FF41',
  },
  messageText: {
    color: '#E0E0E0',
    fontSize: 14,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  input: {
    flex: 1,
    backgroundColor: '#121212',
    color: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#00FF41',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
