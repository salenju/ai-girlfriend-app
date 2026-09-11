import { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ChatScreen from './ChatScreen';
import GirlfriendScreen from './GirlfriendScreen';
import ProfileScreen from './ProfileScreen';
import StatsScreen from './StatsScreen';

const TABS = [
  { key: 'chat', label: '聊天' },
  { key: 'girlfriend', label: '女友' },
  { key: 'stats', label: '数据' },
  { key: 'profile', label: '我的' },
];

export default function MainScreen({ currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('chat');
  // 首次进入后再挂载，之后保持挂载以保留各页状态
  const [mountedTabs, setMountedTabs] = useState({ chat: true });

  const switchTab = key => {
    setActiveTab(key);
    setMountedTabs(prev => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const renderTab = (key, node) => {
    if (!mountedTabs[key]) {
      return null;
    }

    return (
      <View key={key} style={[styles.pane, activeTab !== key && styles.hiddenPane]}>
        {node}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {renderTab('chat', <ChatScreen currentUser={currentUser} />)}
        {renderTab('girlfriend', <GirlfriendScreen />)}
        {renderTab('stats', <StatsScreen />)}
        {renderTab('profile', <ProfileScreen currentUser={currentUser} onLogout={onLogout} />)}
      </View>

      <SafeAreaView style={styles.tabBarSafe}>
        <View style={styles.tabBar}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                onPress={() => switchTab(tab.key)}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      <StatusBar style='dark' />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  pane: {
    flex: 1,
  },
  hiddenPane: {
    display: 'none',
  },
  tabBarSafe: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ececec',
  },
  tabBar: {
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  tabLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#07c160',
  },
  tabIndicator: {
    marginTop: 4,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: '#07c160',
  },
});
