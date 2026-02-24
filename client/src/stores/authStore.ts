/**
 * Auth store (Zustand) with localStorage persist. Phase 6.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
    id: string;
    email: string;
    role: string;
}

interface AuthState {
    token: string | null;
    user: AuthUser | null;
    setAuth: (token: string, user: AuthUser) => void;
    logout: () => void;
    setUser: (user: AuthUser | null) => void;
}

const STORAGE_KEY = 'secure-file-auth';

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            setAuth: (token, user) => set({ token, user }),
            logout: () => set({ token: null, user: null }),
            setUser: (user) => set({ user }),
        }),
        { name: STORAGE_KEY },
    ),
);

export function getAuthToken(): string | null {
    return useAuthStore.getState().token;
}
