import type { TextStyle } from 'react-native';

type FontFamily = TextStyle['fontFamily'];

export const fonts: Record<
  'regular' | 'bold' | 'mono' | 'serif' | 'serifBold' | 'serifStrong',
  FontFamily
> = {
  regular: 'Sohne-Buch',
  bold: 'Sohne-Halbfett',
  mono: 'SohneMono-Buch',
  serif: 'TiemposText',
  serifBold: 'TiemposText-bold',
  serifStrong: 'TiemposText-bold2',
};
