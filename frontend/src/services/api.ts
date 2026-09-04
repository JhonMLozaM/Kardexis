import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Capacitor } from '@capacitor/core';

// Detectar si estamos en Capacitor (movil) o en web
const isNative = Capacitor.isNativePlatform();

// En web: usa proxy de Vite (/api/v1)
// En Capacitor: apunta directo al backend (IP de la PC)
const BASE_URL = isNative
  ? 'http://192.168.1.100:8000/api/v1'  // Cambiar por la IP de la PC con el backend
  : '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para inyectar automaticamente el Token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout en 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
