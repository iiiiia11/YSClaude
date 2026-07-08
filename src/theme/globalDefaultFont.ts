import type { TextStyle } from 'react-native';
import { Text, TextInput } from 'react-native';
import { fonts } from './fonts';

declare const require: (moduleName: string) => any;

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: fonts.serifBold,
};

const PATCH_FLAG = '__ysClaudeDefaultTextFontPatched';

type ElementFactory = (type: unknown, props?: any, ...rest: any[]) => unknown;

function isTextComponent(type: unknown): boolean {
  return type === Text || type === TextInput;
}

function withDefaultFont(type: unknown, props: any) {
  if (!isTextComponent(type)) return props;

  const nextProps = props ?? {};
  return {
    ...nextProps,
    style: [DEFAULT_TEXT_STYLE, nextProps.style],
  };
}

function patchFactory(runtime: any, factoryName: string) {
  const original = runtime?.[factoryName] as ElementFactory | undefined;
  if (typeof original !== 'function' || (original as any)[PATCH_FLAG]) return;

  const patched: ElementFactory = function patchedElementFactory(type, props, ...rest) {
    return original(type, withDefaultFont(type, props), ...rest);
  };

  Object.defineProperty(patched, PATCH_FLAG, { value: true });
  runtime[factoryName] = patched;
}

export function applyGlobalDefaultFont() {
  const globalState = globalThis as any;
  if (globalState[PATCH_FLAG]) return;
  globalState[PATCH_FLAG] = true;

  patchFactory(require('react'), 'createElement');
  patchFactory(require('react/jsx-runtime'), 'jsx');
  patchFactory(require('react/jsx-runtime'), 'jsxs');
  patchFactory(require('react/jsx-dev-runtime'), 'jsxDEV');
}

