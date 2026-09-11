import { Alert } from 'react-native';
import { useAuth } from './src/hooks/useAuth';
import AuthScreen from './src/screens/AuthScreen';
import MainScreen from './src/screens/MainScreen';

export default function App() {
  const { currentUser, login, register, logout } = useAuth();

  const handleLogin = async form => {
    const result = await login(form);
    if (!result.ok) {
      Alert.alert('登录失败', result.message);
    }
  };

  const handleRegister = async form => {
    const result = await register(form);
    if (!result.ok) {
      Alert.alert('注册失败', result.message);
    }
  };

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return <MainScreen currentUser={currentUser} onLogout={logout} />;
}
