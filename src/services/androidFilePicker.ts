import { NativeModules, Platform } from 'react-native';

export interface AndroidPickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

interface AndroidFilePickerModule {
  pickReadingBook: () => Promise<AndroidPickedFile | null>;
}

const nativeModule = NativeModules.AndroidFilePicker as AndroidFilePickerModule | undefined;

export async function pickAndroidReadingBookFile(): Promise<AndroidPickedFile | null> {
  if (Platform.OS !== 'android' || !nativeModule?.pickReadingBook) {
    return null;
  }

  return nativeModule.pickReadingBook();
}
