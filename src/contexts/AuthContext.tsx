import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { ApiService } from '../services/ApiService';
import User from '../database/models/User';
import { Q } from '@nozbe/watermelondb';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const database = useDatabase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

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
    console.log('[AuthContext] autoLogin: Starting...');
    try {
      const data: any = await ApiService.getCurrentUser();
      const userData = data.data.user;

      console.log('[AuthContext] autoLogin: Got user data from API:', userData.id);
      setUser({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatarUrl,
      });

      await syncUserToLocal(userData);
      console.log('[AuthContext] autoLogin: Success');
    } catch (error: any) {
      console.log('[AuthContext] autoLogin: Error -', error.message);
      if (error.message !== 'No refresh token' && error.message !== 'Request failed') {
        console.warn('[AuthContext] Auto login failed:', error.message);
      }
      setLoading(false);
    } finally {
      console.log('[AuthContext] autoLogin: Setting loading to false');
      setLoading(false);
    }
  };

  const syncUserToLocal = async (userData: any) => {
    try {
      if (!database) {
        console.log('[AuthContext] syncUserToLocal: database not available');
        return;
      }

      const collection = database.collections.get<User>('users');
      
      // 使用 userId 字段查找现有用户（后端用户 ID）
      const existingUser = await collection
        .query(Q.where('user_id', userData.id))
        .fetch()
        .then((users: User[]) => users[0] || null);

      await database.write(async () => {
        if (existingUser) {
          // 更新现有用户
          await existingUser.update((u: any) => {
            u.name = userData.name;
            u.email = userData.email;
            u.avatarUrl = userData.avatarUrl;
          });
          console.log('[AuthContext] syncUserToLocal: Updated existing user:', userData.id);
        } else {
          // 创建新用户 - 使用 userId 字段存储后端用户 ID
          await collection.create((u: any) => {
            u.userId = userData.id;
            u.name = userData.name;
            u.email = userData.email;
            u.avatarUrl = userData.avatarUrl;
            u.isOnline = true;
          });
          console.log('[AuthContext] syncUserToLocal: Created new user:', userData.id);
        }
      });
    } catch (error) {
      console.error('[AuthContext] syncUserToLocal error:', error);
      // 不抛出错误，避免影响 user 状态设置
    }
  };

  const login = async (email: string, password: string) => {
    console.log('[AuthContext] login: Called with email:', email);
    const data: any = await ApiService.login(email, password);

    console.log('[AuthContext] login: Setting user from login response');
    setUser({
      id: data.data.user.id,
      name: data.data.user.name,
      email: data.data.user.email,
      avatarUrl: data.data.user.avatarUrl,
    });

    // 保存 token
    if (data.data.accessToken && data.data.refreshToken) {
      console.log('[AuthContext] login: Saving tokens');
      await ApiService.saveTokens(data.data.accessToken, data.data.refreshToken);
    }

    await syncUserToLocal(data.data.user);
    console.log('[AuthContext] login: Complete');
  };

  const register = async (name: string, email: string, password: string) => {
    console.log('[AuthContext] register: Called with email:', email);
    const data: any = await ApiService.register(name, email, password);

    setUser({
      id: data.data.user.id,
      name: data.data.user.name,
      email: data.data.user.email,
      avatarUrl: data.data.user.avatarUrl,
    });

    // 保存 token
    if (data.data.accessToken && data.data.refreshToken) {
      console.log('[AuthContext] register: Saving tokens');
      await ApiService.saveTokens(data.data.accessToken, data.data.refreshToken);
    }

    await syncUserToLocal(data.data.user);
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

  const value = {
    user,
    loading,
    login,
    register,
    logout,
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
