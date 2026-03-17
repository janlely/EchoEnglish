import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiService } from '../services/ApiService';
import { authEventEmitter } from '../services/WebSocketService';
import { getDatabase } from '../database';
import User from '../database/models/User';
import { Q } from '@nozbe/watermelondb';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  localAvatarPath?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, code?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 监听 logout 事件（WebSocket 认证失败时触发）
  useEffect(() => {
    const handleLogout = () => {
      console.log('🔑 Received logout event from WebSocket');
      setUser(null);
      ApiService.clearTokens();
    };

    authEventEmitter.on('logout', handleLogout);
    return () => {
      authEventEmitter.off('logout', handleLogout);
    };
  }, []);

  // 监听 user 状态变化
  useEffect(() => {
    console.log('[AuthContext] user state changed:', user ? { id: user.id, email: user.email } : null);
  }, [user]);

  // 自动登录
  useEffect(() => {
    console.log('[AuthContext] Running autoLogin on mount...');
    autoLogin();
  }, []);

  const autoLogin = async () => {
    try {
      const data = await ApiService.getCurrentUser();
      const userData = data.data!.user;

      console.log('[AuthContext] autoLogin: Got user data from API:', userData.id);

      setUser({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatarUrl ?? undefined,
      });

      console.log('[AuthContext] autoLogin: Success');
    } catch (error: unknown) {
      console.log('[AuthContext] autoLogin: Error -', error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.message !== 'No token' && error.message !== 'Request failed') {
        console.warn('[AuthContext] Auto login failed:', error.message);
      }
      setLoading(false);
    } finally {
      console.log('[AuthContext] autoLogin: Setting loading to false');
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    console.log('[AuthContext] login: Called with email:', email);
    const data = await ApiService.login(email, password);

    console.log('[AuthContext] login: Setting user from login response');

    setUser({
      id: data.data!.user.id,
      name: data.data!.user.name,
      email: data.data!.user.email,
      avatarUrl: data.data!.user.avatarUrl ?? undefined,
    });

    // 保存 token
    if (data.data!.accessToken && data.data!.refreshToken) {
      console.log('[AuthContext] login: Saving tokens');
      await ApiService.saveTokens(data.data!.accessToken, data.data!.refreshToken);
    }

    console.log('[AuthContext] login: Complete');
  };

  const register = async (name: string, email: string, password: string, code?: string) => {
    console.log('[AuthContext] register: Called with email:', email, 'code:', code ? 'provided' : 'not provided');
    const data = await ApiService.register(name, email, password, code);

    // 如果返回了 token，说明注册成功并已验证邮箱，直接登录
    if (data.data!.accessToken && data.data!.refreshToken) {
      console.log('[AuthContext] register: Setting user from register response');

      setUser({
        id: data.data!.user.id,
        name: data.data!.user.name,
        email: data.data!.user.email,
        avatarUrl: data.data!.user.avatarUrl ?? undefined,
      });

      await ApiService.saveTokens(data.data!.accessToken, data.data!.refreshToken);
      console.log('[AuthContext] register: Auto-login complete');
    } else {
      // 旧流程：只保存 token，不设置用户状态
      // 用户需要去邮箱验证后，再通过登录流程进入应用
      console.log('[AuthContext] register: Success, user should verify email');
    }
  };

  const logout = async () => {
    console.log('[AuthContext] logout: Called');
    try {
      await ApiService.logout();
    } finally {
      console.log('[AuthContext] logout: Clearing user state');
      setUser(null);
    }
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    console.log('[AuthContext] updateUser:', updates);
    setUser((prev) => {
      if (!prev) return prev;
      const updatedUser = { ...prev, ...updates };

      // Sync to local database
      syncUserToLocalDB(updatedUser);

      return updatedUser;
    });
  };

  const syncUserToLocalDB = async (userData: AuthUser) => {
    try {
      const db = getDatabase();
      if (!db) {
        console.log('[AuthContext] Database not available');
        return;
      }

      const collection = db.collections.get<User>('users');
      const existingUser = await collection
        .query(Q.where('user_id', userData.id))
        .fetch()
        .then((users: User[]) => users[0] || null);

      await db.write(async () => {
        if (existingUser) {
          await existingUser.update((u: User) => {
            u.name = userData.name;
            u.email = userData.email;
            u.avatarUrl = userData.avatarUrl ?? undefined;
            u.localAvatarPath = userData.localAvatarPath ?? undefined;
          });
          console.log('[AuthContext] Updated local user:', userData.id);
        } else {
          await collection.create((u: User) => {
            u.userId = userData.id;
            u.name = userData.name;
            u.email = userData.email;
            u.avatarUrl = userData.avatarUrl ?? undefined;
            u.localAvatarPath = userData.localAvatarPath ?? undefined;
            u.isOnline = true;
          });
          console.log('[AuthContext] Created local user:', userData.id);
        }
      });
    } catch (error) {
      console.error('[AuthContext] Sync to local DB error:', error);
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
