import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  _id: string;
  username: string;
  role: string;
  full_name: string;
  dni?: string;
  email?: string;
  phone?: string;
  address?: string;
  gender?: string;
  profile_picture_url?: string;
  date_of_birth?: string;
  theme_color?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'kardexis-auth', 
    }
  )
);
