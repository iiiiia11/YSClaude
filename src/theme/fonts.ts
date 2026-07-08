import type { TextStyle } from 'react-native';

type FontFamily = TextStyle['fontFamily'];

export const fonts: Record<
  'regular' | 'bold' | 'mono' | 'serif' | 'serifBold' | 'serifStrong',
  FontFamily
> = {
  regular: undefined,
  bold: undefined,
  mono: undefined,
  serif: undefined,
  serifBold: undefined,
  serifStrong: undefined,
};
