import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import type { ResolvedSharePayload, SharePayload } from 'expo-sharing';

import { useChatStore } from '../stores/chat';
import { useSettingsStore } from '../stores/settings';
import { extractSharedHttpUrl } from '../utils/sharedLinks';

function buildPayloadSignature(
  payloads: SharePayload[],
  resolvedPayloads: ResolvedSharePayload[]
): string {
  return JSON.stringify({
    raw: payloads.map((payload) => ({
      value: payload.value,
      shareType: payload.shareType,
      mimeType: payload.mimeType,
    })),
    resolved: resolvedPayloads.map((payload) => ({
      value: payload.value,
      shareType: payload.shareType,
      mimeType: payload.mimeType,
      contentUri: payload.contentUri,
      contentType: payload.contentType,
      contentMimeType: payload.contentMimeType,
    })),
  });
}

export function IncomingShareHandler() {
  if (Platform.OS !== 'android') {
    return null;
  }

  const router = useRouter();
  const settingsHydrated = useSettingsStore((state) => state._hydrated);
  const addSharedLinkToLatestConversation = useChatStore(
    (state) => state.addSharedLinkToLatestConversation
  );
  const loadConversation = useChatStore((state) => state.loadConversation);
  const {
    sharedPayloads,
    resolvedSharedPayloads,
    clearSharedPayloads,
    isResolving,
  } = useIncomingShare();
  const handledSignatureRef = useRef<string | null>(null);

  const signature = useMemo(
    () => buildPayloadSignature(sharedPayloads, []),
    [sharedPayloads]
  );

  useEffect(() => {
    if (!settingsHydrated || sharedPayloads.length === 0) return;
    if (handledSignatureRef.current === signature) return;

    const url = extractSharedHttpUrl(sharedPayloads, resolvedSharedPayloads);
    if (!url) {
      if (!isResolving) {
        handledSignatureRef.current = signature;
        clearSharedPayloads();
      }
      return;
    }

    handledSignatureRef.current = signature;
    let cancelled = false;

    (async () => {
      const conversationId = await addSharedLinkToLatestConversation(url);
      if (cancelled) return;
      await loadConversation(conversationId);
      if (cancelled) return;
      router.replace('/');
      clearSharedPayloads();
    })().catch((error) => {
      console.warn('[share] failed to save incoming link', error);
      clearSharedPayloads();
    });

    return () => {
      cancelled = true;
    };
  }, [
    addSharedLinkToLatestConversation,
    clearSharedPayloads,
    isResolving,
    loadConversation,
    resolvedSharedPayloads,
    router,
    settingsHydrated,
    sharedPayloads,
    signature,
  ]);

  return null;
}
