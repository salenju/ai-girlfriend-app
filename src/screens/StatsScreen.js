import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getStatsApi } from '../api/statsApi';

const EMPTY_STATS = {
  totalMessages: 0,
  userMessages: 0,
  assistantMessages: 0,
  todayMessages: 0,
  weekMessages: 0,
  avgDailyMessages: 0,
  dailyStats: [],
  lastMessageAt: null,
};

function StatCard({ label, value }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(EMPTY_STATS);

  const loadStats = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getStatsApi();
      if (!result.ok) {
        setError(result.message || '加载失败');
        return;
      }
      setStats({ ...EMPTY_STATS, ...(result.payload?.data || {}) });
    } catch (err) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const dailyStats = stats.dailyStats || [];
  const maxCount = Math.max(1, ...dailyStats.map(item => Number(item.count) || 0));

  const formatDate = value => {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无';
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>聊天数据</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadStats}>
          <Text style={styles.refreshText}>刷新</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color='#07c160' />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.cardGrid}>
            <StatCard label='总消息' value={stats.totalMessages} />
            <StatCard label='我发送' value={stats.userMessages} />
            <StatCard label='TA 回复' value={stats.assistantMessages} />
            <StatCard label='今日' value={stats.todayMessages} />
            <StatCard label='近 7 天' value={stats.weekMessages} />
            <StatCard label='日均' value={stats.avgDailyMessages} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>最近 7 天</Text>

            <View style={styles.chart}>
              {dailyStats.map(item => {
                const count = Number(item.count) || 0;
                const height = count === 0 ? 4 : Math.max(8, (count / maxCount) * 84);

                return (
                  <View key={item.date} style={styles.chartColumn}>
                    <Text style={styles.chartValue}>{count}</Text>
                    <View style={[styles.chartBar, { height }]} />
                    <Text style={styles.chartLabel}>{item.date?.slice(5) || ''}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>最后一条消息</Text>
            <Text style={styles.lastMessage}>{formatDate(stats.lastMessageAt)}</Text>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  refreshText: {
    color: '#444',
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
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#07c160',
  },
  cardLabel: {
    marginTop: 6,
    color: '#888',
    fontSize: 12,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  panelTitle: {
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 130,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  chartValue: {
    fontSize: 10,
    color: '#999',
  },
  chartBar: {
    width: 16,
    borderRadius: 6,
    backgroundColor: '#07c160',
  },
  chartLabel: {
    fontSize: 10,
    color: '#999',
  },
  lastMessage: {
    color: '#555',
  },
});
