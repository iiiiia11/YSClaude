import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSettingsPageColors } from '../../theme/colors';
import { useSettingsStore } from '../../stores/settings';
import { useDiaryStore } from '../../stores/diary';
import { uploadDiary } from '../../services/tools';
import { formatDateOnly, formatFullTime } from '../../utils/time';
import { type Diary } from '../../types';
import { createSettingsStyles } from './styles';

type SettingsTabProps = {
  showToast: (message: string) => void;
  keyboardBottomInset: number;
};

export function DiaryTab({ keyboardBottomInset }: SettingsTabProps) {
  const colors = useSettingsPageColors();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  const { diaries, loadDiaries, addDiary, editDiary, toggleFavorite, removeDiary } = useDiaryStore();
  const { memoryVaultConfig } = useSettingsStore();

  // 编辑日记 Modal state
  const [editing, setEditing] = useState<Diary | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // 新建日记 Modal state
  const [creating, setCreating] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');

  // 上传到云端记忆库 Modal state
  const [uploadTarget, setUploadTarget] = useState<Diary | null>(null);
  const [uploadDate, setUploadDate] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDiaries();
  }, []);

  function handleOpenCreate() {
    setCreateTitle('');
    setCreateContent('');
    setCreating(true);
  }

  async function handleSaveCreate() {
    const content = createContent.trim();
    const title = createTitle.trim();
    if (!content && !title) {
      Alert.alert('提示', '请输入日记内容');
      return;
    }
    await addDiary(title || `日记 ${formatFullTime(Date.now())}`, content);
    setCreating(false);
    setCreateTitle('');
    setCreateContent('');
  }

  function handleOpenUpload(d: Diary) {
    setUploadTarget(d);
    setUploadDate(formatDateOnly(d.createdAt));
  }

  async function handleConfirmUpload() {
    if (!uploadTarget) return;
    const date = uploadDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('提示', '请输入正确的日期格式：YYYY-MM-DD');
      return;
    }
    // 标题并入正文：标题\n正文
    const title = uploadTarget.title.trim();
    const body = uploadTarget.content.trim();
    const content = title ? `${title}\n${body}` : body;
    if (!content) {
      Alert.alert('提示', '该日记内容为空，无法上传');
      return;
    }
    setUploading(true);
    try {
      await uploadDiary(date, content, memoryVaultConfig);
      setUploadTarget(null);
      Alert.alert('上传成功', `日记已上传到云端记忆库（${date}）`);
    } catch (e: any) {
      Alert.alert('上传失败', e.message || '请求失败');
    } finally {
      setUploading(false);
    }
  }

  function handleOpenEdit(d: Diary) {
    setEditing(d);
    setEditTitle(d.title);
    setEditContent(d.content);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    await editDiary(editing.id, { title: editTitle.trim(), content: editContent.trim() });
    setEditing(null);
  }

  function handleDeleteDiary(d: Diary) {
    Alert.alert('删除日记', `确定删除「${d.title || '无标题'}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => removeDiary(d.id) },
    ]);
  }

  return (
    <ScrollView
      style={styles.content}
      contentContainerStyle={{ paddingBottom: keyboardBottomInset + 20 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* 我的日记 */}
      <View style={styles.diaryHeaderRow}>
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>我的日记</Text>
        <Pressable style={styles.diaryAddButton} onPress={handleOpenCreate}>
          <Text style={styles.diaryAddText}>+ 新建</Text>
        </Pressable>
      </View>
      {diaries.length === 0 ? (
        <Text style={styles.hint}>暂无日记</Text>
      ) : (
        diaries.map((d) => (
          <Pressable
            key={d.id}
            style={styles.diaryItem}
            onPress={() => handleOpenEdit(d)}
            onLongPress={() => handleDeleteDiary(d)}
          >
            <Pressable style={styles.diaryStar} onPress={() => toggleFavorite(d.id)} hitSlop={8}>
              <Text style={[styles.diaryStarText, d.isFavorite && styles.diaryStarActive]}>
                {d.isFavorite ? '★' : '☆'}
              </Text>
            </Pressable>
            <View style={styles.diaryContent}>
              <Text style={styles.diaryTitle} numberOfLines={1}>{d.title || '无标题'}</Text>
              <Text style={styles.diaryPreview} numberOfLines={1}>{d.content}</Text>
              <Text style={styles.diaryDate}>{formatFullTime(d.createdAt)}</Text>
            </View>
            <Pressable style={styles.diaryUpload} onPress={() => handleOpenUpload(d)} hitSlop={8}>
              <Text style={styles.diaryUploadText}>上传</Text>
            </Pressable>
          </Pressable>
        ))
      )}

      <View style={{ height: 40 }} />

      {/* 编辑日记 Modal */}
      <Modal visible={!!editing} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setEditing(null)}>
          <View style={styles.modal} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>编辑日记</Text>
            <TextInput
              style={styles.summaryTitleInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="日记标题"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.summaryContentInput, styles.diaryModalContentInput]}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              scrollEnabled
              placeholder="日记内容"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => setEditing(null)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={handleSaveEdit}>
                <Text style={styles.modalConfirmText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* 新建日记 Modal */}
      <Modal visible={creating} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setCreating(false)}>
          <View style={styles.modal} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>新建日记</Text>
            <TextInput
              style={styles.summaryTitleInput}
              value={createTitle}
              onChangeText={setCreateTitle}
              placeholder="日记标题（留空自动生成）"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.summaryContentInput, styles.diaryModalContentInput]}
              value={createContent}
              onChangeText={setCreateContent}
              multiline
              scrollEnabled
              placeholder="日记内容"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => setCreating(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={handleSaveCreate}>
                <Text style={styles.modalConfirmText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* 上传日记到云端 Modal */}
      <Modal visible={!!uploadTarget} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => !uploading && setUploadTarget(null)}>
          <View style={styles.modal} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>上传到云端记忆库</Text>
            <Text style={styles.hint}>标题将并入正文上传。请确认日期（一个日期对应一篇云端日记，重复日期可能覆盖）</Text>
            <TextInput
              style={styles.summaryTitleInput}
              value={uploadDate}
              onChangeText={setUploadDate}
              placeholder="日期 YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => !uploading && setUploadTarget(null)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={handleConfirmUpload} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>上传</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
