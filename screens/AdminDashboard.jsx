import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../styles/ThemeContext';
import supabase from '../supabase/client';
import ReasonModal from '../components/common/ReasonModal';
import { recordPostDeletion, sendModerationNotice, resolveReport, moderateDeleteComment } from '../supabase/helpers';

export default function AdminDashboardScreen({ navigation }) {
  const { user, isElevated, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [reasonVisible, setReasonVisible] = useState(false);
  const [target, setTarget] = useState(null); // { type: 'post'|'comment', report, postId?, commentId? }

  const canAccess = !!isElevated;

  const loadReports = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id, reported_by, post_id, comment_id, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setReports(data || []);
    } catch (e) {
      console.error('loadReports:', e.message);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  useEffect(() => { loadReports(); }, [loadReports]);

  if (authLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Access denied</Text>
      </View>
    );
  }

  const confirmResolve = (id) => {
    Alert.alert('Resolve', 'Remove this report from the queue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolve', style: 'destructive', onPress: async () => { await resolveReport(id); loadReports(); } },
    ]);
  };

  const handleDeletePostFromReport = async (report, reasonText) => {
    try {
      // fetch post to get owner + metadata
      const { data: post, error } = await supabase
        .from('posts')
        .select('id, user_id, title, description')
        .eq('id', report.post_id)
        .maybeSingle();
      if (error) throw error;
      if (!post) throw new Error('Post not found');
      // Remove any previous audit rows to avoid FK blocks
      try { await supabase.from('post_deletions').delete().eq('post_id', post.id); } catch {}
      // delete first to avoid FK restriction
      const { error: delErr } = await supabase.from('posts').delete().eq('id', post.id);
      if (delErr) throw delErr;
      await sendModerationNotice({ userId: post.user_id, postId: post.id, reason: reasonText });
      // record audit entry (supports 'reason' or fallback 'reson')
      try {
        await recordPostDeletion({
          postId: post.id,
          deletedBy: user.id,
          userId: post.user_id,
          title: post.title,
          description: post.description,
          reason: reasonText,
        });
      } catch (e) { console.warn('recordPostDeletion failed:', e.message); }
      await resolveReport(report.id);
      loadReports();
    } catch (e) {
      console.error('Delete post from report:', e.message);
    }
  };

  const handleDeleteCommentFromReport = async (report, reasonText) => {
    try {
      // fetch comment to get owner
      const { data: comment, error } = await supabase
        .from('comments')
        .select('id, post_id, user_id')
        .eq('id', report.comment_id)
        .maybeSingle();
      if (error) throw error;
      if (!comment) throw new Error('Comment not found');
      await moderateDeleteComment({
        commentId: comment.id,
        postId: comment.post_id,
        deletedBy: user.id,
        userId: comment.user_id,
        reason: reasonText,
      });
      await resolveReport(report.id);
      loadReports();
    } catch (e) {
      console.error('Delete comment from report:', e.message);
    }
  };

  const onSubmitReason = async (txt) => {
    const reason = txt || 'Removed by moderation';
    const t = target; setReasonVisible(false); setTarget(null);
    if (!t) return;
    if (t.type === 'post') await handleDeletePostFromReport(t.report, reason);
    if (t.type === 'comment') await handleDeleteCommentFromReport(t.report, reason);
  };

  const itemRender = ({ item }) => {
    const isPost = !!item.post_id && !item.comment_id;
    const label = isPost ? `Post #${item.post_id}` : `Comment #${item.comment_id}`;
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>{label}</Text>
        <Text style={{ color: theme.muted, marginTop: 4 }}>Reason: {item.reason}</Text>
        <Text style={{ color: theme.muted, marginTop: 2 }}>Reported: {new Date(item.created_at).toLocaleString()}</Text>
        <View style={styles.row}>
          {!!item.post_id && (
            <TouchableOpacity style={[styles.btn, styles.neutral]} onPress={() => navigation.navigate('Feed', { screen: 'SinglePost', params: { postId: item.post_id, commentId: item.comment_id || undefined } })}>
              <Text style={styles.btnText}>View</Text>
            </TouchableOpacity>
          )}
          {isPost ? (
            <TouchableOpacity style={[styles.btn, styles.destructive]} onPress={() => { setTarget({ type: 'post', report: item }); setReasonVisible(true); }}>
              <Text style={styles.btnText}>Delete Post…</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btn, styles.destructive]} onPress={() => { setTarget({ type: 'comment', report: item }); setReasonVisible(true); }}>
              <Text style={styles.btnText}>Delete Comment…</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, styles.resolve]} onPress={() => confirmResolve(item.id)}>
            <Text style={styles.btnText}>Resolve</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={theme.text} />
          <Text style={[styles.headerText, { color: theme.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Reports</Text>
        <View style={{ width: 60 }} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 12 }}
          renderItem={itemRender}
          ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', marginTop: 20 }}>No reports</Text>}
        />
      )}
      <ReasonModal
        visible={reasonVisible}
        title="Reason for removal"
        onCancel={() => { setReasonVisible(false); setTarget(null); }}
        onSubmit={onSubmitReason}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  headerText: { marginLeft: 6, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', marginTop: 12, justifyContent: 'flex-end' },
  btn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginLeft: 8 },
  destructive: { backgroundColor: '#7a1b1b' },
  resolve: { backgroundColor: '#2f6a31' },
  neutral: { backgroundColor: '#3a4347' },
  btnText: { color: 'white', fontWeight: '700' },
});
