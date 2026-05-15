import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AuthScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '' });

  const canSubmit = useMemo(() => {
    return form.username.trim().length >= 2 && form.password.length >= 6;
  }, [form]);

  const onChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const onSubmit = () => {
    if (mode === 'login') {
      onLogin(form);
      return;
    }
    onRegister(form);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>仿微信聊天 Demo</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? '欢迎回来，请登录' : '创建账号，开始聊天'}
          </Text>

          <TextInput
            value={form.username}
            onChangeText={v => onChange('username', v)}
            placeholder='用户名（至少2位）'
            style={styles.input}
            autoCapitalize='none'
          />

          <TextInput
            value={form.password}
            onChangeText={v => onChange('password', v)}
            placeholder='密码（至少6位）'
            style={styles.input}
            secureTextEntry
          />

          <TouchableOpacity
            disabled={!canSubmit}
            onPress={onSubmit}
            style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>{mode === 'login' ? '登录' : '注册并登录'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(m => (m === 'login' ? 'register' : 'login'))}>
            <Text style={styles.switchModeText}>
              {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录（demo / 123456）'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <StatusBar style='dark' />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f4f8',
  },
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
    color: '#222',
  },
  subtitle: {
    color: '#666',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  primaryButton: {
    backgroundColor: '#07c160',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  switchModeText: {
    marginTop: 14,
    textAlign: 'center',
    color: '#576b95',
  },
});
