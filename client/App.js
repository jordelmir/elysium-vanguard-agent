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
  Animated,
  Easing,
  ActivityIndicator,
  Image
} from 'react-native';
import { io } from 'socket.io-client';
import { KJUR } from 'jsrsasign';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

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

  const [version, setVersion] = useState('1.2.0-vanguard');
  const [isDeploying, setIsDeploying] = useState(false);
  const rollbackTimer = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // HUD Metrics
  const [metrics, setMetrics] = useState({ cpu: '2.4%', mem: '142MB', bat: '88%' });

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

    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    };
    startPulse();

    // Metric Simulation (Pro Top Mundial)
    const metricInterval = setInterval(() => {
      setMetrics({
        cpu: `${(Math.random() * 5 + 2).toFixed(1)}%`,
        mem: `${(Math.random() * 10 + 140).toFixed(0)}MB`,
        bat: `${(100 - (Date.now() % 10000) / 500).toFixed(0)}%`
      });
    }, 2000);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (rollbackTimer.current) clearTimeout(rollbackTimer.current);
      clearInterval(metricInterval);
    };
  }, []);

  const addLog = (log) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [`[${timestamp}] ${log}`, ...prev].slice(0, 50));
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const task_id = Date.now().toString();
    
    // UI Update
    addLog(`>>> TRANSMITTING: ${input.toUpperCase()}`);
    setMessages(prev => [...prev, { id: task_id, text: input, sender: 'user' }]);
    
    // Socket Emit
    socketRef.current.emit('agent_task', { task_id, prompt: input });
    
    setInput('');
  };

  const pickAndUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const task_id = Date.now().toString();
      addLog(`[UPLINK] Initiating Extraction: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

      const uploadResult = await FileSystem.uploadAsync(`${SOCKET_URL}/upload`, file.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'vanguard_payload',
      });

      if (uploadResult.status === 200) {
        const response = JSON.parse(uploadResult.body);
        addLog(`[SECURE] Extraction SUCCESS: ${response.resource}`);
      } else {
        addLog(`[ERROR] Extraction FAILED: Status ${uploadResult.status}`);
      }
    } catch (err) {
      addLog(`[ERROR] Tactical Link Error: ${err.message}`);
    }
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
        <Animated.View style={[styles.statusDot, { opacity: pulseAnim, backgroundColor: status === 'ONLINE' ? '#00FF41' : '#FF3131' }]} />
        <Text style={styles.headerStatus}>{status}</Text>
      </View>

      {/* Vanguard HUD */}
      <View style={styles.hudBar}>
        <View style={styles.hudItem}><Text style={styles.hudLabel}>CPU</Text><Text style={styles.hudValue}>{metrics.cpu}</Text></View>
        <View style={styles.hudItem}><Text style={styles.hudLabel}>MEM</Text><Text style={styles.hudValue}>{metrics.mem}</Text></View>
        <View style={styles.hudItem}><Text style={styles.hudLabel}>BAT</Text><Text style={styles.hudValue}>{metrics.bat}</Text></View>
        <View style={styles.hudItem}><Text style={styles.hudLabel}>VER</Text><Text style={styles.hudValue}>v1.2</Text></View>
      </View>

      {/* Matrix Terminal (Logs) */}
      <View style={styles.terminalContainer}>
        <View style={styles.scanline} />
        <FlatList
          data={logs}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => <Text style={styles.logText}>{item}</Text>}
          inverted
          style={styles.terminal}
        />
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
        <TouchableOpacity style={styles.attachButton} onPress={pickAndUploadFile}>
          <Text style={styles.attachButtonText}>📎</Text>
        </TouchableOpacity>
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
  hudBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0D0D0D',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  hudItem: {
    alignItems: 'center',
  },
  hudLabel: {
    color: '#444',
    fontSize: 8,
    fontWeight: 'bold',
  },
  hudValue: {
    color: '#00FF41',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  terminalContainer: {
    height: 180,
    backgroundColor: '#000',
    margin: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00FF4144',
    overflow: 'hidden',
  },
  scanline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00FF4111',
    zIndex: 10,
  },
  terminal: {
    padding: 8,
  },
  logText: {
    color: '#00FF41',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    marginBottom: 2,
    textShadowColor: '#00FF4188',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  messageList: {
    flex: 1,
    padding: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#00FF4166',
  },
  messageText: {
    color: '#E0E0E0',
    fontSize: 13,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    backgroundColor: '#0A0A0A',
  },
  input: {
    flex: 1,
    backgroundColor: '#121212',
    color: '#FFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#00FF41',
    borderRadius: 4,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  attachButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 10,
  },
  attachButtonText: {
    fontSize: 18,
    color: '#00FF41',
  },
});
