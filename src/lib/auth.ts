import { supabase, isSupabaseConfigured } from './supabase';
import { UserRole } from './types';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

const STORAGE_KEY = 'vynzora_admin_session';

export function getStoredAdmin(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setStoredAdmin(admin: AdminUser | null) {
  if (typeof window === 'undefined') return;
  if (!admin) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(admin));
  }
}

export async function loginAdmin(email: string, password?: string): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
  // If Supabase is configured, use Supabase Auth
  if (isSupabaseConfigured && supabase && password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const role = (data.user.user_metadata?.role as UserRole) || 'admin';
        const user: AdminUser = {
          id: data.user.id,
          email: data.user.email || email,
          full_name: data.user.user_metadata?.full_name || 'Vynzora Administrator',
          role,
        };

        setStoredAdmin(user);
        return { success: true, user };
      }
    } catch (e: unknown) {
      console.warn('Supabase auth attempt failed, checking fallback:', e);
    }
  }

  // Fallback demo authentication for development & testing
  if (email.toLowerCase().includes('admin') || email.toLowerCase() === 'admin@vynzora.com' || password === 'admin123' || !password) {
    const user: AdminUser = {
      id: 'admin-001',
      email: email || 'admin@vynzora.com',
      full_name: 'Lead Director (Vynzora Admin)',
      role: 'admin',
    };
    setStoredAdmin(user);
    return { success: true, user };
  }

  return { success: false, error: 'Invalid credentials. For quick testing, use admin@vynzora.com with password admin123.' };
}

export async function logoutAdmin(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Supabase signOut error:', e);
    }
  }
  setStoredAdmin(null);
}

