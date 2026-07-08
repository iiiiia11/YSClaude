import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { randomUUID } from 'expo-crypto';
import { importGameScriptFromPicker } from '../services/gameScriptImport';
import { useThemeColors, type ThemeColors } from '../theme/colors';
import {
  useGameStore,
  type GameActor,
  type GameScript,
  type GameScriptEntry,
} from '../stores/game';

export function GameScriptPoolPanel() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scripts = useGameStore((state) => state.gameScripts);
  const saveGameScript = useGameStore((state) => state.saveGameScript);
  const removeGameScript = useGameStore((state) => state.removeGameScript);
  const [activeScriptId, setActiveScriptId] = useState<string | null>(scripts[0]?.id ?? null);
  const [importing, setImporting] = useState(false);

  const activeScript = scripts.find((script) => script.id === activeScriptId) ?? scripts[0];

  function saveScript(script: GameScript) {
    const id = saveGameScript(script);
    setActiveScriptId(id);
  }

  function createScript() {
    const now = Date.now();
    saveScript({
      id: randomUUID(),
      title: '新剧本',
      description: '',
      entries: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  async function importScript() {
    setImporting(true);
    try {
      const result = await importGameScriptFromPicker();
      if (result.cancelled || !result.script) return;
      const now = Date.now();
      const script: GameScript = {
        id: randomUUID(),
        title: result.script.title,
        description: result.script.description,
        entries: result.script.entries.map((entry) => ({ ...entry, id: randomUUID() })),
        createdAt: now,
        updatedAt: now,
      };
      saveScript(script);
      Alert.alert('导入完成', `已导入 ${script.entries.length} 个剧本条目`);
    } catch (error: any) {
      Alert.alert('导入失败', error?.message || '无法读取剧本 JSON');
    } finally {
      setImporting(false);
    }
  }

  function updateScript(scriptId: string, patch: Partial<GameScript>) {
    const script = scripts.find((item) => item.id === scriptId);
    if (!script) return;
    saveScript({ ...script, ...patch });
  }

  function createEntry(script: GameScript) {
    saveScript({
      ...script,
      entries: [
        ...script.entries,
        {
          id: randomUUID(),
          title: '新条目',
          content: '',
          enabled: true,
          keys: [],
          source: 'manual',
        },
      ],
    });
  }

  function updateEntry(script: GameScript, entryId: string, patch: Partial<GameScriptEntry>) {
    saveScript({
      ...script,
      entries: script.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)),
    });
  }

  function removeEntry(script: GameScript, entryId: string) {
    saveScript({
      ...script,
      entries: script.entries.filter((entry) => entry.id !== entryId),
    });
  }

  function confirmRemoveScript(script: GameScript) {
    Alert.alert('删除剧本', `确定删除「${script.title}」吗？引用它的副本会清空选择。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          removeGameScript(script.id);
          setActiveScriptId(scripts.find((item) => item.id !== script.id)?.id ?? null);
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.poolScroll} contentContainerStyle={styles.poolInner}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>剧本池</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.secondaryButton} onPress={importScript} disabled={importing}>
            {importing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>导入 JSON</Text>
            )}
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={createScript}>
            <Text style={styles.primaryButtonText}>新建</Text>
          </Pressable>
        </View>
      </View>

      {scripts.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyText}>还没有剧本。可以新建，也可以导入 SillyTavern 世界书 JSON。</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scriptTabs}>
            {scripts.map((script) => {
              const active = script.id === activeScript?.id;
              return (
                <Pressable
                  key={script.id}
                  style={[styles.scriptTab, active && styles.scriptTabActive]}
                  onPress={() => setActiveScriptId(script.id)}
                >
                  <Text style={[styles.scriptTabText, active && styles.scriptTabTextActive]} numberOfLines={1}>
                    {script.title || '未命名剧本'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {activeScript && (
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>剧本内容</Text>
                <Pressable style={styles.dangerTextButton} onPress={() => confirmRemoveScript(activeScript)}>
                  <Text style={styles.dangerText}>删除剧本</Text>
                </Pressable>
              </View>
              <LabeledInput
                label="剧本名称"
                value={activeScript.title}
                onChangeText={(title) => updateScript(activeScript.id, { title })}
                styles={styles}
                colors={colors}
              />
              <LabeledInput
                label="简介"
                value={activeScript.description}
                onChangeText={(description) => updateScript(activeScript.id, { description })}
                multiline
                styles={styles}
                colors={colors}
              />

              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>条目</Text>
                <Pressable style={styles.secondaryButton} onPress={() => createEntry(activeScript)}>
                  <Text style={styles.secondaryButtonText}>添加条目</Text>
                </Pressable>
              </View>

              {activeScript.entries.length === 0 ? (
                <Text style={styles.emptyText}>这个剧本还没有条目。</Text>
              ) : (
                activeScript.entries.map((entry, index) => (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryTitle}>条目 {index + 1}</Text>
                      <View style={styles.entryActions}>
                        <Pressable
                          style={[styles.statusPill, entry.enabled !== false && styles.statusPillActive]}
                          onPress={() => updateEntry(activeScript, entry.id, { enabled: entry.enabled === false })}
                        >
                          <Text style={[styles.statusPillText, entry.enabled !== false && styles.statusPillTextActive]}>
                            {entry.enabled === false ? '停用' : '启用'}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => removeEntry(activeScript, entry.id)} hitSlop={8}>
                          <Text style={styles.dangerText}>删除</Text>
                        </Pressable>
                      </View>
                    </View>
                    <LabeledInput
                      label="标题"
                      value={entry.title}
                      onChangeText={(title) => updateEntry(activeScript, entry.id, { title })}
                      styles={styles}
                      colors={colors}
                    />
                    <LabeledInput
                      label="关键词"
                      value={(entry.keys ?? []).join('、')}
                      onChangeText={(text) => updateEntry(activeScript, entry.id, { keys: splitKeys(text) })}
                      styles={styles}
                      colors={colors}
                    />
                    <LabeledInput
                      label="内容"
                      value={entry.content}
                      onChangeText={(content) => updateEntry(activeScript, entry.id, { content })}
                      multiline
                      tall
                      styles={styles}
                      colors={colors}
                    />
                  </View>
                ))
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

export function ActorScriptMount({
  actor,
  script,
  onChange,
}: {
  actor: GameActor;
  script: GameScript | null;
  onChange: (entryIds: string[]) => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const enabledEntries = script?.entries.filter((entry) => entry.enabled !== false && entry.content.trim()) ?? [];
  const entryById = new Map(enabledEntries.map((entry) => [entry.id, entry]));
  const mountedIds = (actor.scriptEntryIds ?? []).filter((entryId) => entryById.has(entryId));
  const mountedEntries = mountedIds.map((entryId) => entryById.get(entryId)).filter((entry): entry is GameScriptEntry => !!entry);

  function toggleEntry(entryId: string) {
    if (mountedIds.includes(entryId)) {
      onChange(mountedIds.filter((id) => id !== entryId));
      return;
    }
    onChange([...mountedIds, entryId]);
  }

  function moveEntry(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= mountedIds.length) return;
    const next = [...mountedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <View style={styles.mountPanel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>挂载条目</Text>
        <Pressable style={styles.secondaryButton} onPress={() => setPickerVisible(true)} disabled={!script}>
          <Text style={[styles.secondaryButtonText, !script && styles.disabledText]}>选择条目</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>条目会按这里的顺序插入到 System Prompt 后、身份提示词前。</Text>
      {!script ? (
        <Text style={styles.emptyText}>先在副本基础信息里选择剧本。</Text>
      ) : mountedEntries.length === 0 ? (
        <Text style={styles.emptyText}>尚未挂载条目。</Text>
      ) : (
        mountedEntries.map((entry, index) => (
          <View key={entry.id} style={styles.mountedItem}>
            <View style={styles.mountedInfo}>
              <Text style={styles.mountedTitle} numberOfLines={1}>{entry.title}</Text>
              <Text style={styles.mountedMeta}>#{index + 1}</Text>
            </View>
            <View style={styles.orderActions}>
              <Pressable style={styles.orderButton} onPress={() => moveEntry(index, -1)} disabled={index === 0}>
                <Text style={[styles.orderButtonText, index === 0 && styles.disabledText]}>上</Text>
              </Pressable>
              <Pressable style={styles.orderButton} onPress={() => moveEntry(index, 1)} disabled={index === mountedEntries.length - 1}>
                <Text style={[styles.orderButtonText, index === mountedEntries.length - 1 && styles.disabledText]}>下</Text>
              </Pressable>
              <Pressable style={styles.orderButton} onPress={() => toggleEntry(entry.id)}>
                <Text style={styles.dangerText}>移除</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerPanel} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>选择挂载条目</Text>
            <ScrollView style={styles.entryPickerList}>
              {enabledEntries.length === 0 ? (
                <Text style={styles.emptyText}>这个剧本没有可挂载条目。</Text>
              ) : (
                enabledEntries.map((entry) => {
                  const mounted = mountedIds.includes(entry.id);
                  const expanded = expandedEntryId === entry.id;
                  return (
                    <View key={entry.id} style={[styles.entryPickItem, mounted && styles.entryPickItemActive]}>
                      <Pressable
                        style={styles.entryPickHeader}
                        onPress={() => setExpandedEntryId(expanded ? null : entry.id)}
                      >
                        <View style={styles.entryPickTitleBlock}>
                          <Text style={[styles.entryPickTitle, mounted && styles.entryPickTitleActive]}>{entry.title}</Text>
                          {!!entry.keys?.length && (
                            <Text style={styles.entryPickMeta} numberOfLines={1}>{entry.keys.join('、')}</Text>
                          )}
                        </View>
                        <Text style={styles.entryExpandText}>{expanded ? '收起' : '查看'}</Text>
                      </Pressable>
                      {expanded && <Text style={styles.entryContent}>{entry.content}</Text>}
                      <Pressable style={[styles.mountToggle, mounted && styles.mountToggleActive]} onPress={() => toggleEntry(entry.id)}>
                        <Text style={[styles.mountToggleText, mounted && styles.mountToggleTextActive]}>
                          {mounted ? '已挂载' : '挂载'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function GameScriptSelect({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (scriptId: string | null) => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scripts = useGameStore((state) => state.gameScripts);
  const [visible, setVisible] = useState(false);
  const selected = scripts.find((script) => script.id === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>剧本</Text>
      <Pressable style={styles.select} onPress={() => setVisible(true)}>
        <Text style={[styles.selectText, !selected && styles.placeholderText]}>
          {selected ? selected.title : '选择剧本'}
        </Text>
        <Text style={styles.selectArrow}>⌄</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.pickerPanel} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>选择剧本</Text>
            <Pressable
              style={styles.pickerItem}
              onPress={() => {
                onChange(null);
                setVisible(false);
              }}
            >
              <Text style={styles.pickerItemText}>不选择</Text>
            </Pressable>
            {scripts.map((script) => (
              <Pressable
                key={script.id}
                style={[styles.pickerItem, script.id === value && styles.pickerItemActive]}
                onPress={() => {
                  onChange(script.id);
                  setVisible(false);
                }}
              >
                <Text style={[styles.pickerItemText, script.id === value && styles.pickerItemTextActive]}>
                  {script.title}
                </Text>
                <Text style={styles.pickerMeta} numberOfLines={1}>
                  {script.entries.length} 个条目{script.description ? ` · ${script.description}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  multiline,
  tall,
  styles,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  tall?: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput, tall && styles.tallInput]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

function splitKeys(text: string): string[] {
  return [...new Set(text.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean))];
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  poolScroll: {
    flex: 1,
  },
  poolInner: {
    padding: 18,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  disabledText: {
    color: colors.textTertiary,
  },
  emptyPanel: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  scriptTabs: {
    marginBottom: 10,
  },
  scriptTab: {
    maxWidth: 160,
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginRight: 8,
  },
  scriptTabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  scriptTabText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  scriptTabTextActive: {
    color: colors.primary,
  },
  panel: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  dangerTextButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  dangerText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  field: {
    marginBottom: 10,
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  multilineInput: {
    minHeight: 72,
    lineHeight: 19,
  },
  tallInput: {
    minHeight: 112,
  },
  entryCard: {
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 10,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  entryTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    minHeight: 26,
    minWidth: 48,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statusPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  statusPillText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '800',
  },
  statusPillTextActive: {
    color: colors.primary,
  },
  mountPanel: {
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginTop: 2,
  },
  hint: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  mountedItem: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  mountedInfo: {
    flex: 1,
    minWidth: 0,
  },
  mountedTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  mountedMeta: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderButton: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  orderButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,20,19,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  pickerPanel: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '76%',
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  entryPickerList: {
    maxHeight: 440,
  },
  entryPickItem: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 10,
  },
  entryPickItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  entryPickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  entryPickTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  entryPickTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  entryPickTitleActive: {
    color: colors.primary,
  },
  entryPickMeta: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 3,
  },
  entryExpandText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  entryContent: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  mountToggle: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  mountToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mountToggleText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  mountToggleTextActive: {
    color: '#FFFFFF',
  },
  select: {
    minHeight: 44,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  placeholderText: {
    color: colors.textTertiary,
    fontWeight: '500',
  },
  selectArrow: {
    color: colors.textTertiary,
    fontSize: 18,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: colors.inputBackground,
  },
  pickerItemActive: {
    backgroundColor: colors.primaryLight,
  },
  pickerItemText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pickerItemTextActive: {
    color: colors.primary,
  },
  pickerMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
});
