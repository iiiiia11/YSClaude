import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sqliteStorage } from '../db/kv-storage';
import {
  checkNeteaseQrLogin,
  createNeteaseQrLogin,
  getNeteaseLoginProfile,
  getNeteasePlaylists,
  importNeteasePlaylist,
  type NeteasePlaylistSummary,
  type NeteaseProfile,
  type NeteaseQrLogin,
} from '../services/neteaseMusic';
import { useMusicStore } from './music';

interface NeteaseState {
  _hydrated: boolean;
  baseUrl: string;
  cookie: string;
  profile: NeteaseProfile | null;
  qrLogin: NeteaseQrLogin | null;
  playlists: NeteasePlaylistSummary[];
  loading: boolean;
  importingPlaylistId: number | null;
  lastImportSummary: string | null;
  error: string | null;

  setBaseUrl: (baseUrl: string) => void;
  startQrLogin: () => Promise<void>;
  checkQrLogin: () => Promise<void>;
  loadLoginStatus: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  importPlaylist: (playlistId: number) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useNeteaseStore = create<NeteaseState>()(
  persist(
    (set, get) => ({
      _hydrated: false,
      baseUrl: '',
      cookie: '',
      profile: null,
      qrLogin: null,
      playlists: [],
      loading: false,
      importingPlaylistId: null,
      lastImportSummary: null,
      error: null,

      setBaseUrl: (baseUrl) => set({ baseUrl, error: null }),

      startQrLogin: async () => {
        set({ loading: true, error: null, lastImportSummary: null });
        try {
          const qrLogin = await createNeteaseQrLogin(get().baseUrl);
          set({ qrLogin });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : '创建网易云登录二维码失败' });
        } finally {
          set({ loading: false });
        }
      },

      checkQrLogin: async () => {
        const { baseUrl, qrLogin } = get();
        if (!qrLogin) return;
        set({ loading: true, error: null });
        try {
          const result = await checkNeteaseQrLogin(baseUrl, qrLogin.key);
          if (result.code === 803 && result.cookie) {
            const profile = await getNeteaseLoginProfile(baseUrl, result.cookie);
            set({
              cookie: result.cookie,
              profile,
              qrLogin: null,
              playlists: [],
              lastImportSummary: null,
            });
            await get().loadPlaylists();
          } else {
            set({ error: result.message || loginCodeMessage(result.code) });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : '检查扫码状态失败' });
        } finally {
          set({ loading: false });
        }
      },

      loadLoginStatus: async () => {
        const { baseUrl, cookie } = get();
        if (!cookie) return;
        set({ loading: true, error: null });
        try {
          const profile = await getNeteaseLoginProfile(baseUrl, cookie);
          set({ profile });
          await get().loadPlaylists();
        } catch (error) {
          set({
            profile: null,
            playlists: [],
            error: error instanceof Error ? error.message : '网易云登录已失效',
          });
        } finally {
          set({ loading: false });
        }
      },

      loadPlaylists: async () => {
        const { baseUrl, cookie, profile } = get();
        if (!cookie || !profile?.userId) return;
        set({ loading: true, error: null });
        try {
          const playlists = await getNeteasePlaylists(baseUrl, cookie, profile.userId);
          set({ playlists });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : '读取网易云歌单失败' });
        } finally {
          set({ loading: false });
        }
      },

      importPlaylist: async (playlistId) => {
        const { baseUrl, cookie } = get();
        set({ importingPlaylistId: playlistId, error: null, lastImportSummary: null });
        try {
          const result = await importNeteasePlaylist(baseUrl, cookie, playlistId);
          useMusicStore.getState().replaceTracks(result.tracks);
          useMusicStore.getState().openPlayer();
          set({
            lastImportSummary: `已导入 ${result.playableCount} 首，可播放队列已更新；跳过 ${result.skippedCount} 首。`,
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : '导入歌单失败' });
        } finally {
          set({ importingPlaylistId: null });
        }
      },

      logout: () => {
        set({
          cookie: '',
          profile: null,
          qrLogin: null,
          playlists: [],
          lastImportSummary: null,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'ysclaude-netease',
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        baseUrl: state.baseUrl,
        cookie: state.cookie,
        profile: state.profile,
      }),
      onRehydrateStorage: () => () => {
        useNeteaseStore.setState({ _hydrated: true });
      },
    }
  )
);

function loginCodeMessage(code: number): string {
  switch (code) {
    case 800:
      return '二维码已过期，请重新获取';
    case 801:
      return '等待扫码';
    case 802:
      return '已扫码，请在网易云音乐中确认';
    case 803:
      return '登录成功';
    default:
      return `扫码状态：${code}`;
  }
}
