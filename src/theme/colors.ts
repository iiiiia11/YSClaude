import { useColorScheme, type ColorSchemeName } from 'react-native';

export const lightColors = {
  background: '#faf9f5',
  surface: '#F0EBE4',
  surfaceHover: '#f1eee7',
  border: '#E5E0D8',
  text: '#141413',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  primary: '#D97706',
  primaryLight: '#FEF3C7',
  userBubble: '#f1eee7',
  assistantBubble: 'transparent',
  codeBlock: '#ffffff',
  codeText: '#73726e',
  inputBackground: '#FFFFFF',
  inputBorder: '#f8f8f6',
  danger: '#DC2626',
  dangerSurface: '#FEF2F2',
  success: '#16A34A',
  iconGray: '#8B8B8B',
  disclaimer: '#787773',
};

const darkColors = {
  background: '#12100D',
  surface: '#211C17',
  surfaceHover: '#2B241D',
  border: '#3A3027',
  text: '#F7F2EA',
  textSecondary: '#C9BFB2',
  textTertiary: '#8F8478',
  primary: '#D97706',
  primaryLight: '#3A2511',
  userBubble: '#2B241D',
  assistantBubble: 'transparent',
  codeBlock: '#1B1713',
  codeText: '#D8CEC0',
  inputBackground: '#1A1612',
  inputBorder: '#332A22',
  danger: '#F87171',
  dangerSurface: '#351818',
  success: '#4ADE80',
  iconGray: '#A69A8E',
  disclaimer: '#9B9084',
};

export type ThemeColors = typeof lightColors;

function createSettingsPageColors(base: ThemeColors): ThemeColors {
  return base;
}

export const settingsPageColors: ThemeColors = createSettingsPageColors(lightColors);

function getThemeColors(colorScheme: ColorSchemeName | null | undefined): ThemeColors {
  return colorScheme === 'dark' ? darkColors : lightColors;
}

export function useThemeColors(): ThemeColors {
  return getThemeColors(useColorScheme());
}

export function useSettingsPageColors(): ThemeColors {
  return createSettingsPageColors(useThemeColors());
}

export const colors = lightColors;
