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
import {
  getGirlfriendApi,
  resetGirlfriendApi,
  updateGirlfriendApi,
} from '../api/girlfriendApi';

const PERSONALITY_OPTIONS = ['温柔体贴', '活泼开朗', '知性优雅', '可爱俏皮', '成熟稳重'];
const VOICE_OPTIONS = ['甜美', '温柔', '清脆', '磁性'];
const LANGUAGE_STYLE_OPTIONS = ['亲昵', '正式', '幽默', '文艺'];

const DEFAULT_AVATAR = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png';

function ChipGroup({ label, options, value, onChange }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(option => {
          const active = value === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(option)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function GirlfriendScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    avatar: '',
    personality: '温柔体贴',
    age: '22',
    hobbiesText: '',
    voice: '温柔',
    languageStyle: '亲昵',
    background: '',
  });

  const applyGirlfriend = girlfriend => {
    setForm({
      name: girlfriend?.name || '',
      avatar: girlfriend?.avatar || '',
      personality: girlfriend?.personality || '温柔体贴',
      age: String(girlfriend?.age ?? 22),
      hobbiesText: Array.isArray(girlfriend?.hobbies) ? girlfriend.hobbies.join('、') : '',
      voice: girlfriend?.voice || '温柔',
      languageStyle: girlfriend?.languageStyle || '亲昵',
      background: girlfriend?.background || '',
    });
  };

  const loadGirlfriend = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getGirlfriendApi();
      if (!result.ok) {
        setError(result.message || '加载失败');
        return;
      }
      applyGirlfriend(result.payload?.data?.girlfriend);
    } catch (err) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGirlfriend();
  }, []);

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert('提示', '请填写女友名字');
      return;
    }

    const age = Number(form.age);
    if (!Number.isFinite(age) || age < 18 || age > 35) {
      Alert.alert('提示', '年龄需在 18 - 35 之间');
      return;
    }

    const hobbies = form.hobbiesText
      .split(/[,，、\s]+/)
      .map(item => item.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const result = await updateGirlfriendApi({
        name,
        avatar: form.avatar.trim() || DEFAULT_AVATAR,
        personality: form.personality,
        age,
        hobbies,
        voice: form.voice,
        languageStyle: form.languageStyle,
        background: form.background.trim(),
      });

      if (!result.ok) {
        Alert.alert('保存失败', result.message || '请稍后重试');
        return;
      }

      applyGirlfriend(result.payload?.data?.girlfriend);
      Alert.alert('已保存', '女友配置已更新');
    } catch (err) {
      Alert.alert('保存失败', err?.message || '请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert('重置配置', '确定要恢复默认女友配置吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '重置',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await resetGirlfriendApi();
            if (!result.ok) {
              Alert.alert('重置失败', result.message || '请稍后重试');
              return;
            }
            applyGirlfriend(result.payload?.data?.girlfriend);
          } catch (err) {
            Alert.alert('重置失败', err?.message || '请稍后重试');
          }
        },
      },
    ]);
  };

  const avatarUri = form.avatar.trim() || DEFAULT_AVATAR;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI 女友定制</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color='#07c160' />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.avatarBlock}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
            <View style={styles.avatarMeta}>
              <Text style={styles.avatarName}>{form.name || '未命名'}</Text>
              <Text style={styles.avatarHint}>{form.personality}</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>名字</Text>
            <TextInput
              value={form.name}
              onChangeText={v => updateField('name', v)}
              style={styles.input}
              placeholder='例如：小爱'
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

          <ChipGroup
            label='性格'
            options={PERSONALITY_OPTIONS}
            value={form.personality}
            onChange={v => updateField('personality', v)}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>年龄</Text>
            <TextInput
              value={form.age}
              onChangeText={v => updateField('age', v.replace(/[^0-9]/g, ''))}
              style={styles.input}
              keyboardType='number-pad'
              placeholder='18 - 35'
            />
          </View>

          <ChipGroup
            label='声音'
            options={VOICE_OPTIONS}
            value={form.voice}
            onChange={v => updateField('voice', v)}
          />

          <ChipGroup
            label='语言风格'
            options={LANGUAGE_STYLE_OPTIONS}
            value={form.languageStyle}
            onChange={v => updateField('languageStyle', v)}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>爱好（用、或逗号分隔）</Text>
            <TextInput
              value={form.hobbiesText}
              onChangeText={v => updateField('hobbiesText', v)}
              style={styles.input}
              placeholder='聊天、听音乐、看电影'
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>背景故事</Text>
            <TextInput
              value={form.background}
              onChangeText={v => updateField('background', v)}
              style={[styles.input, styles.textarea]}
              placeholder='介绍一下她的性格与经历'
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>{saving ? '保存中...' : '保存配置'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
            <Text style={styles.secondaryButtonText}>恢复默认</Text>
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
    gap: 16,
  },
  errorText: {
    color: '#d9534f',
  },
  avatarBlock: {
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
  avatarMeta: {
    flex: 1,
  },
  avatarName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  avatarHint: {
    marginTop: 4,
    color: '#888',
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
    minHeight: 88,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
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
    color: '#666',
    fontWeight: '600',
  },
});
