import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// URL Base dinámica: Reconocerá si entraste a localhost (tu PC) 
// o si entraste desde la IP de tu red WiFi (tu Móvil/PC secundaria)
export const api = axios.create({
  baseURL: `http://${window.location.hostname}:8000/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para inyectar automáticamente el Token en peticiones
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Opcional: Interceptor de Respuestas (para desloguear si expira el token 401)
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
