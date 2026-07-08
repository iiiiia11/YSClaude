import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  type ListRenderItem,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { lightColors, useThemeColors, type ThemeColors } from '../../src/theme/colors';
import { ActorScriptMount, GameScriptSelect } from '../../src/components/GameScriptSection';
import {
  GAME_MACARON_SWATCHES,
  useGameStore,
  type GameActor,
  type GameApiPreset,
  type GameMessage,
  type GameScenario,
} from '../../src/stores/game';
import { useKeyboardHeight } from '../../src/hooks/useKeyboardHeight';

let colors = lightColors;
const EMPTY_GAME_MESSAGES: GameMessage[] = [];

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function fallbackActorColor(actorId: string, actors: GameActor[]) {
  const index = Math.max(0, actors.findIndex((actor) => actor.id === actorId));
  return GAME_MACARON_SWATCHES[index % GAME_MACARON_SWATCHES.length];
}

function actorColor(actorId: string, actors: GameActor[]) {
  const actor = actors.find((item) => item.id === actorId);
  const fallback = fallbackActorColor(actorId, actors);
  return {
    bg: actor?.bubbleColor || fallback.bg,
    text: actor?.textColor || fallback.text,
  };
}

function isNarrativeActor(actor: GameActor | { type: string }): boolean {
  return actor.type === 'narrator' || actor.type === 'summary';
}

function isFloorHidden(floor: number, scenario: GameScenario): boolean {
  return (scenario.hiddenRanges ?? []).some((range) => floor >= range.from && floor <= range.to);
}

async function pickAvatarUri(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled) return null;
  return result.assets?.[0]?.uri ?? null;
}

async function pickCardFaceUri(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.9,
  });
  if (result.canceled) return null;
  return result.assets?.[0]?.uri ?? null;
}

export default function GameRoomScreen() {
  colors = useThemeColors();
  styles = useMemo(() => createStyles(colors), [colors]);
  const keyboardHeight = useKeyboardHeight();
  const inputKeyboardInset = Platform.OS === 'ios' ? 0 : keyboardHeight;

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scenario = useGameStore((state) => state.scenarios.find((item) => item.id === id));
  const messages = useGameStore((state) => state.messagesByScenario[id] ?? EMPTY_GAME_MESSAGES);
  const activeGeneratingActorId = useGameStore((state) => state.activeGeneratingActorId);
  const error = useGameStore((state) => state.error);
  const addUserMessage = useGameStore((state) => state.addUserMessage);
  const editMessage = useGameStore((state) => state.editMessage);
  const removeMessage = useGameStore((state) => state.removeMessage);
  const triggerActorResponse = useGameStore((state) => state.triggerActorResponse);
  const stopGenerating = useGameStore((state) => state.stopGenerating);
  const clearScenarioMessages = useGameStore((state) => state.clearScenarioMessages);
  const removeScenario = useGameStore((state) => state.removeScenario);
  const saveScenario = useGameStore((state) => state.saveScenario);
  const ensureScenarioDefaults = useGameStore((state) => state.ensureScenarioDefaults);
  const addHiddenRange = useGameStore((state) => state.addHiddenRange);
  const removeHiddenRange = useGameStore((state) => state.removeHiddenRange);
  const updateActorBubbleColor = useGameStore((state) => state.updateActorBubbleColor);
  const clearError = useGameStore((state) => state.clearError);

  const [inputText, setInputText] = useState('');
  const [actorMenuOpen, setActorMenuOpen] = useState(false);
  const [narratorSendMode, setNarratorSendMode] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [scenarioEditorVisible, setScenarioEditorVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<GameMessage | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const listRef = useRef<FlatList<GameMessage>>(null);

  const actors = useMemo<GameActor[]>(
    () => (scenario ? [scenario.narrator, ...(scenario.summarizer ? [scenario.summarizer] : []), ...scenario.characters] : []),
    [scenario]
  );
  const showAvatars = scenario?.showAvatars ?? true;

  useEffect(() => {
    if (scenario && (!scenario.summarizer || !scenario.hiddenRanges || scenario.scripts?.length)) {
      ensureScenarioDefaults(scenario.id);
    }
  }, [ensureScenarioDefaults, scenario]);

  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [messages.length]);

  function handleSend() {
    if (!id || activeGeneratingActorId) return;
    const text = inputText.trim();
    if (!text) return;
    addUserMessage(
      id,
      text,
      narratorSendMode && scenario
        ? {
            senderId: scenario.narrator.id,
            senderType: scenario.narrator.type,
            senderName: scenario.narrator.name,
          }
        : undefined
    );
    setInputText('');
  }

  function handleActorPress(actorId: string) {
    if (!id || activeGeneratingActorId) return;
    setActorMenuOpen(false);
    triggerActorResponse(id, actorId).catch(() => undefined);
  }

  function openMessageActions(message: GameMessage) {
    if (activeGeneratingActorId && !message.content.trim()) return;
    setSelectedMessage(message);
    setMessageDraft(message.content);
  }

  function handleSaveMessage() {
    if (!id || !selectedMessage) return;
    editMessage(id, selectedMessage.id, messageDraft);
    setSelectedMessage(null);
  }

  function handleDeleteMessage() {
    if (!id || !selectedMessage) return;
    const message = selectedMessage;
    setSelectedMessage(null);
    Alert.alert('删除消息', '确定删除这条消息吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => removeMessage(id, message.id) },
    ]);
  }

  function handleClearMessages() {
    if (!id) return;
    setMoreVisible(false);
    Alert.alert('清空消息', '确定清空这个副本房间里的所有消息吗？', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => clearScenarioMessages(id) },
    ]);
  }

  function handleDeleteScenario() {
    if (!scenario) return;
    setMoreVisible(false);
    Alert.alert('删除副本', `确定删除「${scenario.title}」吗？副本消息也会一起删除。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          removeScenario(scenario.id);
          router.replace('/game');
        },
      },
    ]);
  }

  const renderMessage = useMemo<ListRenderItem<GameMessage>>(
    () =>
      ({ item, index }) => {
        const floor = index + 1;
        const isUser = item.senderType === 'user';
        const isNarrator = item.senderType === 'narrator' || item.senderType === 'summary';
        const hidden = scenario ? isFloorHidden(floor, scenario) : false;
        const roleColor = actorColor(item.senderId, actors);

        if (isNarrator) {
          const narrativeActor = actors.find((actor) => actor.id === item.senderId);
          return (
            <Pressable style={styles.narratorMessage} onLongPress={() => openMessageActions(item)}>
              {showAvatars && (
                <AvatarCircle
                  name={item.senderName}
                  avatarUri={narrativeActor?.avatarUri}
                  style={styles.narratorAvatar}
                  textStyle={styles.narratorAvatarText}
                />
              )}
              <Text style={styles.floorText}>#{floor}{hidden ? ' · 已隐藏' : ''}</Text>
              <Text style={styles.narratorMeta}>{item.senderName} · {formatMessageTime(item.createdAt)}</Text>
              {item.content ? (
                <Text style={styles.narratorText}>{item.content}</Text>
              ) : (
                <View style={styles.centerTypingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.typingText}>生成中...</Text>
                </View>
              )}
            </Pressable>
          );
        }

        return (
          <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
            {!isUser && showAvatars && (
              <AvatarCircle
                name={item.senderName}
                avatarUri={actors.find((actor) => actor.id === item.senderId)?.avatarUri}
                style={[styles.avatar, { backgroundColor: roleColor.bg, borderColor: roleColor.bg }]}
                textStyle={[styles.avatarText, { color: roleColor.text }]}
              />
            )}
            <Pressable
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : { backgroundColor: roleColor.bg, borderColor: roleColor.bg },
              ]}
              onLongPress={() => openMessageActions(item)}
            >
              <View style={styles.messageMetaRow}>
                <Text style={[styles.senderName, isUser ? styles.userSenderName : { color: roleColor.text }]}>
                  #{floor} · {hidden ? '已隐藏 · ' : ''}{item.senderName}
                </Text>
                <Text style={[styles.messageTime, !isUser && { color: roleColor.text }]}>{formatMessageTime(item.createdAt)}</Text>
              </View>
              {item.content ? (
                <Text style={[styles.messageText, !isUser && { color: roleColor.text }]}>{item.content}</Text>
              ) : (
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color={isUser ? colors.primary : roleColor.text} />
                  <Text style={[styles.typingText, !isUser && { color: roleColor.text }]}>生成中...</Text>
                </View>
              )}
            </Pressable>
            {isUser && showAvatars && (
              <AvatarCircle
                name={item.senderName}
                avatarUri={scenario?.userAvatarUri}
                style={styles.userAvatar}
                textStyle={styles.userAvatarText}
              />
            )}
          </View>
        );
      },
    [actors, activeGeneratingActorId, id, scenario?.userAvatarUri, showAvatars]
  );

  if (!scenario) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>副本不存在</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/game')}>
          <Text style={styles.primaryButtonText}>返回 Game</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Text style={styles.headerButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.title} numberOfLines={1}>{scenario.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            旁白 + {scenario.characters.length} 个角色
          </Text>
        </View>
        <Pressable style={styles.moreButton} onPress={() => setMoreVisible(true)}>
          <Text style={styles.moreButtonText}>⋯</Text>
        </Pressable>
      </View>

      {error && (
        <Pressable style={styles.errorBanner} onPress={clearError}>
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>副本已开启</Text>
            <Text style={styles.emptyText}>输入一句话发到房间里，再点右侧菜单选择旁白或角色回复。</Text>
          </View>
        }
      />

      <View style={[styles.inputArea, { paddingBottom: 16 + inputKeyboardInset }]}>
        {actorMenuOpen && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.actorMenuScroll}
            contentContainerStyle={styles.actorMenu}
          >
            {actors.map((actor) => {
              const isGenerating = activeGeneratingActorId === actor.id;
              const isDisabled = !!activeGeneratingActorId && !isGenerating;
              const roleColor = actorColor(actor.id, actors);
              return (
                <Pressable
                  key={actor.id}
                  style={[styles.actorMenuItem, isDisabled && styles.actorMenuItemDisabled]}
                  onPress={() => handleActorPress(actor.id)}
                  disabled={isDisabled}
                >
                  <View
                    style={[
                      styles.menuAvatar,
                      isNarrativeActor(actor)
                        ? styles.menuNarratorAvatar
                        : { backgroundColor: roleColor.bg, borderColor: roleColor.bg },
                    ]}
                  >
                    {isGenerating ? (
                      <ActivityIndicator size="small" color={isNarrativeActor(actor) ? '#FFFFFF' : roleColor.text} />
                    ) : actor.avatarUri ? (
                      <Image source={{ uri: actor.avatarUri }} style={styles.avatarImage} resizeMode="cover" />
                    ) : (
                      <Text
                        style={[
                          styles.menuAvatarText,
                          isNarrativeActor(actor) ? styles.menuNarratorAvatarText : { color: roleColor.text },
                        ]}
                      >
                        {actor.name.slice(0, 2)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.actorMenuName} numberOfLines={1}>{actor.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入后回车发送"
            placeholderTextColor={colors.textTertiary}
            multiline
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSend}
            editable={!activeGeneratingActorId}
          />
          <Pressable
            style={[
              styles.identityButton,
              narratorSendMode ? styles.identityButtonActive : styles.identityButtonInactive,
            ]}
            onPress={() => setNarratorSendMode((current) => !current)}
            disabled={!!activeGeneratingActorId}
          >
            <Text
              style={[
                styles.identityButtonText,
                narratorSendMode ? styles.identityButtonTextActive : styles.identityButtonTextInactive,
              ]}
            >
              旁
            </Text>
          </Pressable>
          {activeGeneratingActorId ? (
            <Pressable style={styles.menuButton} onPress={stopGenerating}>
              <Text style={styles.stopText}>停</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.menuButton} onPress={() => setActorMenuOpen((current) => !current)}>
              <Text style={styles.menuButtonText}>⋯</Text>
            </Pressable>
          )}
        </View>
      </View>

      <MorePanel
        visible={moreVisible}
        scenario={scenario}
        actors={actors}
        onClose={() => setMoreVisible(false)}
        onEditScenario={() => {
          setMoreVisible(false);
          setScenarioEditorVisible(true);
        }}
        onDeleteScenario={handleDeleteScenario}
        onClearMessages={handleClearMessages}
        onToggleAvatars={() => saveScenario({ ...scenario, showAvatars: !(scenario.showAvatars ?? true) })}
        onHideRange={(from, to) => addHiddenRange(scenario.id, from, to)}
        onRemoveHiddenRange={(index) => removeHiddenRange(scenario.id, index)}
        onSelectColor={(actor, swatch) => {
          updateActorBubbleColor(scenario.id, actor.id, swatch.bg, swatch.text);
        }}
      />

      <ScenarioEditModal
        visible={scenarioEditorVisible}
        scenario={scenario}
        onClose={() => setScenarioEditorVisible(false)}
        onSave={(nextScenario) => {
          saveScenario(nextScenario);
          setScenarioEditorVisible(false);
        }}
      />

      <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={() => setSelectedMessage(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelectedMessage(null)}>
          <View style={[styles.messageActionPanel, { marginBottom: keyboardHeight }]} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>消息操作</Text>
            <TextInput
              style={styles.editMessageInput}
              value={messageDraft}
              onChangeText={setMessageDraft}
              multiline
              autoFocus
              placeholder="消息内容"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.modalActionsSplit}>
              <Pressable style={styles.deleteButton} onPress={handleDeleteMessage}>
                <Text style={styles.deleteButtonText}>删除</Text>
              </Pressable>
              <View style={styles.modalActionsRight}>
                <Pressable style={styles.modalCancel} onPress={() => setSelectedMessage(null)}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </Pressable>
                <Pressable style={styles.modalConfirm} onPress={handleSaveMessage}>
                  <Text style={styles.modalConfirmText}>保存</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function AvatarCircle({
  name,
  avatarUri,
  style,
  textStyle,
}: {
  name: string;
  avatarUri?: string;
  style: any;
  textStyle: any;
}) {
  return (
    <View style={style}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <Text style={textStyle}>{name.slice(0, 2)}</Text>
      )}
    </View>
  );
}

function MorePanel({
  visible,
  scenario,
  actors,
  onClose,
  onEditScenario,
  onDeleteScenario,
  onClearMessages,
  onToggleAvatars,
  onHideRange,
  onRemoveHiddenRange,
  onSelectColor,
}: {
  visible: boolean;
  scenario: GameScenario;
  actors: GameActor[];
  onClose: () => void;
  onEditScenario: () => void;
  onDeleteScenario: () => void;
  onClearMessages: () => void;
  onToggleAvatars: () => void;
  onHideRange: (from: number, to: number) => void;
  onRemoveHiddenRange: (index: number) => void;
  onSelectColor: (actor: GameActor, swatch: typeof GAME_MACARON_SWATCHES[number]) => void;
}) {
  const [hideFrom, setHideFrom] = useState('');
  const [hideTo, setHideTo] = useState('');

  function submitHiddenRange() {
    const from = parseInt(hideFrom.trim(), 10);
    const to = parseInt(hideTo.trim(), 10);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) {
      Alert.alert('提示', '请输入有效楼层范围，例如 3 到 8');
      return;
    }
    onHideRange(from, to);
    setHideFrom('');
    setHideTo('');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.morePanel} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>更多</Text>

          <View style={styles.moreActions}>
            <Pressable style={styles.moreActionButton} onPress={onEditScenario}>
              <Text style={styles.moreActionText}>编辑副本</Text>
            </Pressable>
            <Pressable style={styles.moreActionButton} onPress={onClearMessages}>
              <Text style={styles.moreActionText}>清空消息</Text>
            </Pressable>
            <Pressable style={[styles.moreActionButton, styles.dangerActionButton]} onPress={onDeleteScenario}>
              <Text style={styles.dangerActionText}>删除副本</Text>
            </Pressable>
          </View>

          <View style={styles.avatarToggleRow}>
            <View>
              <Text style={styles.avatarToggleTitle}>聊天头像</Text>
              <Text style={styles.avatarToggleHint}>{scenario.showAvatars === false ? '当前隐藏' : '当前显示'}</Text>
            </View>
            <Pressable style={styles.avatarToggleButton} onPress={onToggleAvatars}>
              <Text style={styles.avatarToggleButtonText}>{scenario.showAvatars === false ? '显示' : '隐藏'}</Text>
            </Pressable>
          </View>

          <Text style={styles.panelSectionTitle}>隐藏消息</Text>
          <View style={styles.hidePanel}>
            <View style={styles.hideInputRow}>
              <TextInput
                style={styles.hideInput}
                value={hideFrom}
                onChangeText={setHideFrom}
                keyboardType="number-pad"
                placeholder="起始楼"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.hideToText}>到</Text>
              <TextInput
                style={styles.hideInput}
                value={hideTo}
                onChangeText={setHideTo}
                keyboardType="number-pad"
                placeholder="结束楼"
                placeholderTextColor={colors.textTertiary}
              />
              <Pressable style={styles.hideButton} onPress={submitHiddenRange}>
                <Text style={styles.hideButtonText}>隐藏</Text>
              </Pressable>
            </View>
            {(scenario.hiddenRanges ?? []).length > 0 && (
              <View style={styles.hiddenRangeList}>
                {(scenario.hiddenRanges ?? []).map((range, index) => (
                  <View key={`${range.from}-${range.to}-${index}`} style={styles.hiddenRangeItem}>
                    <Text style={styles.hiddenRangeText}>#{range.from} 到 #{range.to}</Text>
                    <Pressable onPress={() => onRemoveHiddenRange(index)} hitSlop={8}>
                      <Text style={styles.hiddenRangeDelete}>移除</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Text style={styles.panelSectionTitle}>角色气泡颜色</Text>
          <ScrollView style={styles.colorList}>
            {scenario.characters.map((actor) => {
              const current = actorColor(actor.id, actors);
              return (
                <View key={actor.id} style={styles.colorRow}>
                  <View style={styles.colorRowHeader}>
                    <View style={[styles.colorPreview, { backgroundColor: current.bg }]} />
                    <Text style={styles.colorActorName}>{actor.name}</Text>
                  </View>
                  <View style={styles.swatchGrid}>
                    {GAME_MACARON_SWATCHES.map((swatch) => {
                      const selected = current.bg === swatch.bg;
                      return (
                        <Pressable
                          key={`${actor.id}-${swatch.bg}`}
                          style={[
                            styles.swatchButton,
                            { backgroundColor: swatch.bg, borderColor: selected ? swatch.text : swatch.bg },
                          ]}
                          onPress={() => onSelectColor(actor, swatch)}
                        >
                          {selected && <Text style={[styles.swatchCheck, { color: swatch.text }]}>✓</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

function ScenarioEditModal({
  visible,
  scenario,
  onClose,
  onSave,
}: {
  visible: boolean;
  scenario: GameScenario;
  onClose: () => void;
  onSave: (scenario: GameScenario) => void;
}) {
  const apiPresets = useGameStore((state) => state.apiPresets);
  const gameScripts = useGameStore((state) => state.gameScripts);
  const keyboardHeight = useKeyboardHeight();
  const [draft, setDraft] = useState<GameScenario>(scenario);
  const selectedScript = gameScripts.find((script) => script.id === draft.scriptId) ?? null;

  useEffect(() => {
    if (visible) {
      setDraft({
        ...scenario,
        narrator: { ...scenario.narrator },
        summarizer: scenario.summarizer ? { ...scenario.summarizer } : undefined,
        characters: scenario.characters.map((actor) => ({ ...actor })),
        hiddenRanges: scenario.hiddenRanges ? [...scenario.hiddenRanges] : [],
      });
    }
  }, [scenario, visible]);

  function updateNarrator(patch: Partial<GameActor>) {
    setDraft((current) => ({ ...current, narrator: { ...current.narrator, ...patch } }));
  }

  function updateSummarizer(patch: Partial<GameActor>) {
    setDraft((current) =>
      current.summarizer
        ? { ...current, summarizer: { ...current.summarizer, ...patch } }
        : current
    );
  }

  function updateCharacter(actorId: string, patch: Partial<GameActor>) {
    setDraft((current) => ({
      ...current,
      characters: current.characters.map((actor) => (actor.id === actorId ? { ...actor, ...patch } : actor)),
    }));
  }

  function updateScriptId(scriptId: string | null) {
    setDraft((current) => ({
      ...current,
      scriptId,
      narrator: { ...current.narrator, scriptEntryIds: [] },
      characters: current.characters.map((actor) => ({ ...actor, scriptEntryIds: [] })),
    }));
  }

  async function pickUserAvatar() {
    const uri = await pickAvatarUri();
    if (uri) setDraft((current) => ({ ...current, userAvatarUri: uri }));
  }

  async function pickCardFace() {
    const uri = await pickCardFaceUri();
    if (uri) setDraft((current) => ({ ...current, cardFaceUri: uri }));
  }

  async function pickNarratorAvatar() {
    const uri = await pickAvatarUri();
    if (uri) updateNarrator({ avatarUri: uri });
  }

  async function pickSummarizerAvatar() {
    const uri = await pickAvatarUri();
    if (uri) updateSummarizer({ avatarUri: uri });
  }

  async function pickCharacterAvatar(actorId: string) {
    const uri = await pickAvatarUri();
    if (uri) updateCharacter(actorId, { avatarUri: uri });
  }

  function submit() {
    if (!draft.title.trim()) {
      Alert.alert('提示', '请输入副本名称');
      return;
    }
    onSave({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      systemPrompt: draft.systemPrompt.trim(),
      scriptId: draft.scriptId ?? null,
      scripts: undefined,
      narrator: {
        ...draft.narrator,
        name: draft.narrator.name.trim() || '旁白',
        prompt: draft.narrator.prompt.trim(),
      },
      summarizer: draft.summarizer
        ? {
            ...draft.summarizer,
            name: draft.summarizer.name.trim() || '总结AI',
            prompt: draft.summarizer.prompt.trim(),
          }
        : undefined,
      userAvatarUri: draft.userAvatarUri,
      showAvatars: draft.showAvatars ?? true,
      characters: draft.characters.map((actor) => ({
        ...actor,
        name: actor.name.trim() || '角色',
        prompt: actor.prompt.trim(),
      })),
    });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalScreen, { paddingBottom: keyboardHeight }]}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onClose}>
            <Text style={styles.headerButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.editorTitle}>编辑副本</Text>
          <Pressable style={styles.saveButton} onPress={submit}>
            <Text style={styles.saveButtonText}>保存</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.editorContent} contentContainerStyle={styles.editorContentInner}>
          <CardFacePicker
            cardFaceUri={draft.cardFaceUri}
            title={draft.title}
            onPick={pickCardFace}
            onRemove={() => setDraft((current) => ({ ...current, cardFaceUri: undefined }))}
          />
          <RoomField label="副本名称" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
          <RoomField
            label="简介"
            value={draft.description}
            onChangeText={(description) => setDraft({ ...draft, description })}
            multiline
          />
          <RoomField
            label="副本 System Prompt"
            value={draft.systemPrompt}
            onChangeText={(systemPrompt) => setDraft({ ...draft, systemPrompt })}
            multiline
            tall
          />

          <GameScriptSelect value={draft.scriptId} onChange={updateScriptId} />

          <Text style={styles.panelSectionTitle}>用户</Text>
          <View style={styles.editorCard}>
            <AvatarPicker
              label="用户头像"
              name="用户"
              avatarUri={draft.userAvatarUri}
              onPick={pickUserAvatar}
              onRemove={() => setDraft((current) => ({ ...current, userAvatarUri: undefined }))}
            />
          </View>

          <Text style={styles.panelSectionTitle}>旁白</Text>
          <View style={styles.editorCard}>
            <AvatarPicker
              label="头像"
              name={draft.narrator.name}
              avatarUri={draft.narrator.avatarUri}
              onPick={pickNarratorAvatar}
              onRemove={() => updateNarrator({ avatarUri: undefined })}
            />
            <RoomField label="名称" value={draft.narrator.name} onChangeText={(name) => updateNarrator({ name })} />
            <PresetSelect
              label="API 配置"
              value={draft.narrator.apiPresetId}
              presets={apiPresets}
              onChange={(apiPresetId) => updateNarrator({ apiPresetId })}
            />
            <RoomField
              label="身份提示词"
              value={draft.narrator.prompt}
              onChangeText={(prompt) => updateNarrator({ prompt })}
              multiline
              tall
            />
            <ActorScriptMount
              actor={draft.narrator}
              script={selectedScript}
              onChange={(scriptEntryIds) => updateNarrator({ scriptEntryIds })}
            />
          </View>

          {draft.summarizer && (
            <>
              <Text style={styles.panelSectionTitle}>总结 AI</Text>
              <View style={styles.editorCard}>
                <AvatarPicker
                  label="头像"
                  name={draft.summarizer.name}
                  avatarUri={draft.summarizer.avatarUri}
                  onPick={pickSummarizerAvatar}
                  onRemove={() => updateSummarizer({ avatarUri: undefined })}
                />
                <RoomField label="名称" value={draft.summarizer.name} onChangeText={(name) => updateSummarizer({ name })} />
                <PresetSelect
                  label="API 配置"
                  value={draft.summarizer.apiPresetId}
                  presets={apiPresets}
                  onChange={(apiPresetId) => updateSummarizer({ apiPresetId })}
                />
                <RoomField
                  label="总结提示词"
                  value={draft.summarizer.prompt}
                  onChangeText={(prompt) => updateSummarizer({ prompt })}
                  multiline
                  tall
                />
              </View>
            </>
          )}

          <Text style={styles.panelSectionTitle}>参与角色</Text>
          {draft.characters.map((actor, index) => (
            <View key={actor.id} style={styles.editorCard}>
              <Text style={styles.actorEditorTitle}>角色 {index + 1}</Text>
              <AvatarPicker
                label="头像"
                name={actor.name}
                avatarUri={actor.avatarUri}
                onPick={() => pickCharacterAvatar(actor.id)}
                onRemove={() => updateCharacter(actor.id, { avatarUri: undefined })}
              />
              <RoomField label="名称" value={actor.name} onChangeText={(name) => updateCharacter(actor.id, { name })} />
              <PresetSelect
                label="API 配置"
                value={actor.apiPresetId}
                presets={apiPresets}
                onChange={(apiPresetId) => updateCharacter(actor.id, { apiPresetId })}
              />
              <RoomField
                label="角色设定"
                value={actor.prompt}
                onChangeText={(prompt) => updateCharacter(actor.id, { prompt })}
                multiline
                tall
              />
              <ActorScriptMount
                actor={actor}
                script={selectedScript}
                onChange={(scriptEntryIds) => updateCharacter(actor.id, { scriptEntryIds })}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function RoomField({
  label,
  value,
  onChangeText,
  multiline,
  tall,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  tall?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline, tall && styles.fieldInputTall]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

function AvatarPicker({
  label,
  name,
  avatarUri,
  onPick,
  onRemove,
}: {
  label: string;
  name: string;
  avatarUri?: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.avatarPickerRow}>
      <View style={styles.avatarPickerPreview}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarPickerImage} resizeMode="cover" />
        ) : (
          <Text style={styles.avatarPickerInitial}>{name.slice(0, 2)}</Text>
        )}
      </View>
      <View style={styles.avatarPickerText}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.avatarPickerHint}>{avatarUri ? '已选择图片头像' : '使用文字头像'}</Text>
      </View>
      <View style={styles.avatarPickerActions}>
        <Pressable style={styles.avatarPickButton} onPress={onPick}>
          <Text style={styles.avatarPickButtonText}>上传</Text>
        </Pressable>
        {avatarUri && (
          <Pressable style={styles.avatarRemoveButton} onPress={onRemove}>
            <Text style={styles.avatarRemoveButtonText}>移除</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function CardFacePicker({
  cardFaceUri,
  title,
  onPick,
  onRemove,
}: {
  cardFaceUri?: string;
  title: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.cardFacePicker}>
      <View style={styles.cardFacePreview}>
        {cardFaceUri ? (
          <Image source={{ uri: cardFaceUri }} style={styles.cardFacePreviewImage} resizeMode="cover" />
        ) : (
          <Text style={styles.cardFacePreviewText}>{title.slice(0, 2) || '副本'}</Text>
        )}
      </View>
      <View style={styles.cardFacePickerText}>
        <Text style={styles.fieldLabel}>牌面</Text>
        <Text style={styles.avatarPickerHint}>{cardFaceUri ? '已使用自定义牌面' : '默认牌面'}</Text>
      </View>
      <View style={styles.avatarPickerActions}>
        <Pressable style={styles.avatarPickButton} onPress={onPick}>
          <Text style={styles.avatarPickButtonText}>上传</Text>
        </Pressable>
        {cardFaceUri && (
          <Pressable style={styles.avatarRemoveButton} onPress={onRemove}>
            <Text style={styles.avatarRemoveButtonText}>移除</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function PresetSelect({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: string | null;
  presets: GameApiPreset[];
  onChange: (value: string | null) => void;
}) {
  const [visible, setVisible] = useState(false);
  const selected = presets.find((preset) => preset.id === value);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.select} onPress={() => setVisible(true)}>
        <Text style={[styles.selectText, !selected && styles.placeholderText]}>
          {selected ? selected.name : '选择副本 API 配置'}
        </Text>
        <Text style={styles.selectArrow}>⌄</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.pickerPanel} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable
              style={styles.pickerItem}
              onPress={() => {
                onChange(null);
                setVisible(false);
              }}
            >
              <Text style={styles.pickerItemText}>不选择</Text>
            </Pressable>
            {presets.map((preset) => (
              <Pressable
                key={preset.id}
                style={[styles.pickerItem, preset.id === value && styles.pickerItemActive]}
                onPress={() => {
                  onChange(preset.id);
                  setVisible(false);
                }}
              >
                <Text style={[styles.pickerItemText, preset.id === value && styles.pickerItemTextActive]}>
                  {preset.name}
                </Text>
                <Text style={styles.pickerMeta} numberOfLines={1}>{preset.model}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  moreButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  moreButtonText: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '800',
  },
  errorBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.dangerSurface,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 14,
    paddingBottom: 20,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 12,
    maxWidth: '88%',
  },
  userMessageRow: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
  },
  narratorMessage: {
    alignSelf: 'center',
    maxWidth: '88%',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 12,
  },
  narratorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderWidth: 0,
    overflow: 'hidden',
    marginBottom: 6,
  },
  narratorAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  floorText: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 3,
  },
  narratorMeta: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  narratorText: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
  },
  centerTypingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    marginTop: 2,
    overflow: 'hidden',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderWidth: 0,
    marginTop: 2,
    overflow: 'hidden',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  messageBubble: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    borderColor: colors.border,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 5,
  },
  senderName: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '800',
  },
  userSenderName: {
    color: colors.textSecondary,
  },
  messageTime: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
  },
  messageText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
  },
  typingText: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
  },
  inputArea: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  actorMenuScroll: {
    marginBottom: 10,
  },
  actorMenu: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 4,
  },
  actorMenuItem: {
    width: 56,
    alignItems: 'center',
    gap: 5,
  },
  actorMenuItemDisabled: {
    opacity: 0.45,
  },
  menuAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    overflow: 'hidden',
  },
  menuNarratorAvatar: {
    backgroundColor: colors.primary,
  },
  menuAvatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  menuNarratorAvatarText: {
    color: '#FFFFFF',
  },
  actorMenuName: {
    width: '100%',
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
  },
  input: {
    flex: 1,
    maxHeight: 112,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  identityButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  identityButtonInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  identityButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  identityButtonText: {
    fontSize: 15,
    fontWeight: '900',
  },
  identityButtonTextInactive: {
    color: colors.primary,
  },
  identityButtonTextActive: {
    color: '#FFFFFF',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '800',
  },
  stopText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,20,19,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  morePanel: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '82%',
    borderRadius: 8,
    backgroundColor: colors.background,
    padding: 16,
  },
  messageActionPanel: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 8,
    backgroundColor: colors.background,
    padding: 16,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  moreActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  avatarToggleRow: {
    minHeight: 56,
    borderRadius: 8,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  avatarToggleTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  avatarToggleHint: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 3,
  },
  avatarToggleButton: {
    minWidth: 58,
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  avatarToggleButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  moreActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  moreActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  dangerActionButton: {
    backgroundColor: colors.dangerSurface,
  },
  dangerActionText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  panelSectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 10,
  },
  hidePanel: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 12,
  },
  hideInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hideInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: 10,
  },
  hideToText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  hideButton: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  hideButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  hiddenRangeList: {
    gap: 6,
    marginTop: 10,
  },
  hiddenRangeItem: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  hiddenRangeText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  hiddenRangeDelete: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  colorList: {
    maxHeight: 420,
  },
  colorRow: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  colorRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },
  colorPreview: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  colorActorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchCheck: {
    fontSize: 15,
    fontWeight: '900',
  },
  editMessageInput: {
    minHeight: 120,
    maxHeight: 240,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  modalActionsSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalActionsRight: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteButton: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dangerSurface,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  modalCancel: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  modalConfirm: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  editorTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  saveButton: {
    minWidth: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  editorContent: {
    flex: 1,
  },
  editorContentInner: {
    padding: 18,
    paddingBottom: 40,
  },
  editorCard: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  cardFacePicker: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 14,
  },
  cardFacePreview: {
    width: 54,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardFacePreviewImage: {
    width: '100%',
    height: '100%',
  },
  cardFacePreviewText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  cardFacePickerText: {
    flex: 1,
    minWidth: 0,
  },
  actorEditorTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  avatarPickerRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatarPickerPreview: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  avatarPickerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },
  avatarPickerInitial: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  avatarPickerText: {
    flex: 1,
    minWidth: 0,
  },
  avatarPickerHint: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  avatarPickerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  avatarPickButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  avatarPickButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  avatarRemoveButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.dangerSurface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  avatarRemoveButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  fieldInput: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldInputMultiline: {
    minHeight: 78,
    lineHeight: 20,
  },
  fieldInputTall: {
    minHeight: 118,
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
  pickerPanel: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  notFoundText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

let styles = createStyles(colors);
