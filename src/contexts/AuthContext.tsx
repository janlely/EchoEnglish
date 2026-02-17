import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { ApiService } from '../services/ApiService';
import User from '../database/models/User';

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

  // 自动登录
  useEffect(() => {
    autoLogin();
  }, []);

  const autoLogin = async () => {
    try {
      const data: any = await ApiService.getCurrentUser();
      const userData = data.data.user;
      
      setUser({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatarUrl: userData.avatarUrl,
      });

      await syncUserToLocal(userData);
    } catch (error: any) {
      // 自动登录失败是正常的（用户未登录或 Token 过期）
      // 只在非 401 错误时打印日志
      if (error.message !== 'No refresh token' && error.message !== 'Request failed') {
        console.warn('Auto login failed:', error.message);
      }
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const syncUserToLocal = async (userData: any) => {
    try {
      if (!database) return;

      const localUsers = await database.collections.get<User>('users').query().fetch();
      const existingUser = localUsers.find((u: User) => u.id === userData.id);

      await database.write(async () => {
        if (existingUser) {
          await existingUser.update((u: any) => {
            u.name = userData.name;
            u.email = userData.email;
            u.avatarUrl = userData.avatarUrl;
            // 不要修改 createdAt 和 updatedAt，它们是 readonly
          });
        } else {
          await database.collections.get<User>('users').create((u: any) => {
            u.id = userData.id;
            u.name = userData.name;
            u.email = userData.email;
            u.avatarUrl = userData.avatarUrl;
            u.isOnline = true;
            // 使用 _raw 来设置 readonly 字段
            u._raw.created_at = Date.now();
            u._raw.updated_at = Date.now();
          });
        }
      });
    } catch (error) {
      console.error('Sync user failed:', error);
    }
  };

  const login = async (email: string, password: string) => {
    const data: any = await ApiService.login(email, password);
    
    setUser({
      id: data.data.user.id,
      name: data.data.user.name,
      email: data.data.user.email,
      avatarUrl: data.data.user.avatarUrl,
    });

    await syncUserToLocal(data.data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const data: any = await ApiService.register(name, email, password);
    
    setUser({
      id: data.data.user.id,
      name: data.data.user.name,
      email: data.data.user.email,
      avatarUrl: data.data.user.avatarUrl,
    });

    await syncUserToLocal(data.data.user);
  };

  const logout = async () => {
    try {
      await ApiService.logout();
    } finally {
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
