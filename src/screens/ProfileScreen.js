import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { clearChatHistoryApi } from '../api/chatApi';
import { changePasswordApi, getUserInfoApi, updateUserInfoApi } from '../api/userApi';
import { clearLocalChatData } from '../services/chat/localChatStorage';

const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '保密' },
];

const DEFAULT_AVATAR = 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png';

export default function ProfileScreen({ currentUser, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [account, setAccount] = useState({ username: '', email: '' });
  const [form, setForm] = useState({ nickname: '', avatar: '', gender: 'other', age: '', bio: '' });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const loadProfile = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getUserInfoApi();
      if (!result.ok) {
        setError(result.message || '加载失败');
        return;
      }

      const user = result.payload?.data?.user || {};
      setAccount({ username: user.username || '', email: user.email || '' });
      setForm({
        nickname: user.nickname || '',
        avatar: user.avatar || '',
        gender: user.gender || 'other',
        age: user.age != null ? String(user.age) : '',
        bio: user.bio || '',
      });
    } catch (err) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSaveProfile = async () => {
    const payload = {
      nickname: form.nickname.trim(),
      avatar: form.avatar.trim() || DEFAULT_AVATAR,
      gender: form.gender,
      bio: form.bio.trim(),
    };

    if (form.age.trim()) {
      const age = Number(form.age);
      if (!Number.isFinite(age) || age < 18 || age > 100) {
        Alert.alert('提示', '年龄需在 18 - 100 之间');
        return;
      }
      payload.age = age;
    }

    setSaving(true);
    try {
      const result = await updateUserInfoApi(payload);
      if (!result.ok) {
        Alert.alert('保存失败', result.message || '请稍后重试');
        return;
      }
      Alert.alert('已保存', '个人资料已更新');
    } catch (err) {
      Alert.alert('保存失败', err?.message || '请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const { oldPassword, newPassword, confirmPassword } = passwordForm;

    if (!oldPassword || !newPassword) {
      Alert.alert('提示', '请填写旧密码和新密码');
      return;
    }

    if (String(newPassword).length < 6) {
      Alert.alert('提示', '新密码至少 6 位');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }

    setChangingPassword(true);
    try {
      const result = await changePasswordApi({ oldPassword, newPassword });
      if (!result.ok) {
        Alert.alert('修改失败', result.message || '请稍后重试');
        return;
      }
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert('已修改', '密码修改成功');
    } catch (err) {
      Alert.alert('修改失败', err?.message || '请稍后重试');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert('清空聊天记录', '将同时清空本地与服务端的聊天记录，且不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearChatHistoryApi();
          } catch {
            // 服务端清空失败不阻塞本地清理
          }

          try {
            await clearLocalChatData();
          } catch {
            // ignore
          }

          Alert.alert('已清空', '聊天记录已清空，重新进入聊天页生效');
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => onLogout?.() },
    ]);
  };

  const avatarUri = form.avatar.trim() || DEFAULT_AVATAR;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color='#07c160' />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.profileBlock}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
            <View style={styles.profileMeta}>
              <Text style={styles.profileName}>{form.nickname || account.username || '未命名'}</Text>
              <Text style={styles.profileAccount}>@{account.username || '-'}</Text>
              <Text style={styles.profileEmail}>{account.email || '-'}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>个人资料</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>昵称</Text>
            <TextInput
              value={form.nickname}
              onChangeText={v => updateField('nickname', v)}
              style={styles.input}
              placeholder='请输入昵称'
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>头像链接</Text>
            <TextInput
              value={form.avatar}
              onChangeText={v => updateField('avatar', v)}
              style={styles.input}
              placeholder='https://...'
              autoCapitalize='none'
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>性别</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map(option => {
                const active = form.gender === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => updateField('gender', option.value)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>年龄</Text>
            <TextInput
              value={form.age}
              onChangeText={v => updateField('age', v.replace(/[^0-9]/g, ''))}
              style={styles.input}
              keyboardType='number-pad'
              placeholder='选填'
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>个人简介</Text>
            <TextInput
              value={form.bio}
              onChangeText={v => updateField('bio', v)}
              style={[styles.input, styles.textarea]}
              placeholder='介绍一下自己'
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>{saving ? '保存中...' : '保存资料'}</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>修改密码</Text>

          <View style={styles.field}>
            <TextInput
              value={passwordForm.oldPassword}
              onChangeText={v => setPasswordForm(prev => ({ ...prev, oldPassword: v }))}
              style={styles.input}
              placeholder='旧密码'
              secureTextEntry
            />
            <TextInput
              value={passwordForm.newPassword}
              onChangeText={v => setPasswordForm(prev => ({ ...prev, newPassword: v }))}
              style={styles.input}
              placeholder='新密码（至少 6 位）'
              secureTextEntry
            />
            <TextInput
              value={passwordForm.confirmPassword}
              onChangeText={v => setPasswordForm(prev => ({ ...prev, confirmPassword: v }))}
              style={styles.input}
              placeholder='确认新密码'
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, changingPassword && styles.buttonDisabled]}
            onPress={handleChangePassword}
            disabled={changingPassword}
          >
            <Text style={styles.secondaryButtonText}>
              {changingPassword ? '提交中...' : '确认修改密码'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>其他</Text>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleClearHistory}>
            <Text style={styles.dangerText}>清空聊天记录</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.secondaryButton, styles.logoutButton]} onPress={handleLogout}>
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f4f8',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  errorText: {
    color: '#d9534f',
  },
  profileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eee',
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  profileAccount: {
    marginTop: 4,
    color: '#07c160',
    fontWeight: '600',
  },
  profileEmail: {
    marginTop: 2,
    color: '#999',
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: 8,
    color: '#666',
    fontWeight: '700',
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: '#555',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipActive: {
    backgroundColor: '#e6f7ee',
    borderColor: '#07c160',
  },
  chipText: {
    color: '#555',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#07c160',
  },
  primaryButton: {
    backgroundColor: '#07c160',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  secondaryButtonText: {
    color: '#555',
    fontWeight: '600',
  },
  dangerText: {
    color: '#d9534f',
    fontWeight: '600',
  },
  logoutButton: {
    borderColor: '#f0c4c0',
  },
  logoutText: {
    color: '#d9534f',
    fontWeight: '700',
  },
});
