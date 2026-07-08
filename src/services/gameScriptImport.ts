import { File } from 'expo-file-system';
import type { GameScriptEntry } from '../stores/game';

interface ImportedGameScript {
  title: string;
  description: string;
  entries: Array<Omit<GameScriptEntry, 'id'>>;
}

export interface GameScriptImportResult {
  cancelled: boolean;
  script?: ImportedGameScript;
}

type SillyTavernEntry = Record<string, unknown>;

export async function importGameScriptFromPicker(): Promise<GameScriptImportResult> {
  const result = await File.pickFileAsync({
    mimeTypes: ['application/json', 'text/json', 'application/octet-stream', '*/*'],
    multipleFiles: false,
  });

  if (result.canceled) {
    return { cancelled: true };
  }

  const text = await result.result.text();
  return {
    cancelled: false,
    script: parseGameScriptJson(text, result.result.name),
  };
}

function parseGameScriptJson(jsonText: string, fallbackName = '导入剧本'): ImportedGameScript {
  const parsed = JSON.parse(stripBom(jsonText));
  const worldBook = unwrapWorldBook(parsed);
  const rawEntries = collectEntries(worldBook);
  const entries = rawEntries.map(convertEntry).filter((entry): entry is Omit<GameScriptEntry, 'id'> => !!entry);

  if (entries.length === 0) {
    throw new Error('JSON 中没有可导入的世界书条目');
  }

  return {
    title: titleFromWorldBook(worldBook, fallbackName),
    description: stringFromFirst(worldBook, ['description', 'desc', 'note']) || '从 SillyTavern 世界书导入',
    entries,
  };
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

function unwrapWorldBook(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('JSON 顶层必须是对象');

  const candidates = [
    value,
    value.world_info,
    value.worldInfo,
    value.world_book,
    value.worldBook,
    value.lorebook,
  ];

  for (const candidate of candidates) {
    if (isRecord(candidate) && collectEntries(candidate).length > 0) return candidate;
  }

  return value;
}

function collectEntries(worldBook: Record<string, unknown>): SillyTavernEntry[] {
  const entries = worldBook.entries ?? worldBook.entry ?? worldBook.data;
  if (Array.isArray(entries)) {
    return entries.filter(isRecord);
  }
  if (isRecord(entries)) {
    return Object.values(entries).filter(isRecord);
  }
  return [];
}

function convertEntry(entry: SillyTavernEntry, index: number): Omit<GameScriptEntry, 'id'> | null {
  const content = stringFromFirst(entry, ['content', 'entry', 'text', 'description']).trim();
  if (!content) return null;

  const keys = uniqueStrings([
    ...stringsFromValue(entry.key),
    ...stringsFromValue(entry.keys),
    ...stringsFromValue(entry.primary_key),
    ...stringsFromValue(entry.primaryKeys),
  ]);

  return {
    title: stringFromFirst(entry, ['comment', 'name', 'title', 'displayName']).trim() || keys[0] || `条目 ${index + 1}`,
    content,
    enabled: !(entry.disable === true || entry.disabled === true),
    keys,
    source: 'sillytavern',
  };
}

function titleFromWorldBook(worldBook: Record<string, unknown>, fallbackName: string): string {
  const fileTitle = fallbackName.replace(/\.[^.]+$/, '').trim();
  return stringFromFirst(worldBook, ['name', 'title', 'worldName', 'world_name']).trim() || fileTitle || '导入剧本';
}

function stringFromFirst(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

function stringsFromValue(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringsFromValue);
  }
  return [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
