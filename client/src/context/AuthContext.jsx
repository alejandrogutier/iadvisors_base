import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('iadvisors_user');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('Error reading stored user', error);
      return null;
    }
  });
  const [isRefreshingUser, setIsRefreshingUser] = useState(Boolean(user?.id));

  useEffect(() => {
    if (user) {
      localStorage.setItem('iadvisors_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('iadvisors_user');
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setIsRefreshingUser(false);
      return undefined;
    }

    let ignore = false;
    const refreshUser = async () => {
      setIsRefreshingUser(true);
      try {
        const { data } = await api.get(`/users/${user.id}`);
        if (!ignore) {
          setUser((current) => {
            if (!current) return data.user;
            if (current.id !== data.user.id) return data.user;
            if (
              current.name === data.user.name &&
              current.email === data.user.email &&
              current.role === data.user.role
            ) {
              return current;
            }
            return data.user;
          });
        }
      } catch (error) {
        const status = error?.response?.status;
        if (status === 404 && user?.email) {
          try {
            const { data } = await api.get('/users/resolve', {
              params: { email: user.email }
            });
            if (!ignore) {
              setUser(data.user);
            }
            return;
          } catch (resolveError) {
            console.error('No se pudo resolver la sesion por email', resolveError);
            if (!ignore) {
              setUser(null);
            }
            return;
          }
        }
        console.error('No se pudo sincronizar el usuario', error);
      } finally {
        if (!ignore) {
          setIsRefreshingUser(false);
        }
      }
    };

    refreshUser();

    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const loginUser = async ({ email, password }) => {
    const { data } = await api.post('/users/login', { email, password });
    setUser(data.user);
    return data.user;
  };

  const updateProfile = async (updates) => {
    if (!user) return null;
    const { data } = await api.put(`/users/${user.id}`, updates);
    setUser(data.user);
    return data.user;
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    if (!user) return;
    await api.post('/users/change-password', {
      userId: user.id,
      currentPassword,
      newPassword
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('iadvisors_user');
  };

  const value = {
    user,
    isRefreshingUser,
    loginUser,
    updateProfile,
    changePassword,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
