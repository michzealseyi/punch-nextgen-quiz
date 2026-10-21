// The signed-in student, their level and streak, and which quizzes already paid out today.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, hasToken, setToken } from '../api.js';
import { useUi } from './UiContext.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const { toast } = useUi();
  const [me, setMe] = useState(null);
  const [level, setLevel] = useState(null);
  const [streak, setStreak] = useState(null);
  const [playedToday, setPlayedToday] = useState(() => new Set());
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasToken()) { setMe(null); return; }
    try {
      const r = await api.get('/me');
      setMe(r.user);
      setLevel(r.level);
      setStreak(r.streak);
      const { quizIds } = await api.get('/quizzes/played-today');
      setPlayedToday(new Set(quizIds));
    } catch { setMe(null); }
  }, []);

  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);

  useEffect(() => {
    const onExpired = () => { setMe(null); toast('Your session has expired. Sign in again.', true); };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [toast]);

  const signIn = useCallback(async (path, body) => {
    const { token, user } = await api.post(path, body);
    setToken(token);
    setMe(user);
    await refresh();
    return user;
  }, [refresh]);

  const signOut = useCallback(() => {
    setToken(null);
    setMe(null);
    setLevel(null);
    setStreak(null);
    setPlayedToday(new Set());
  }, []);

  const value = {
    me, level, streak, playedToday, ready, refresh, signIn, signOut, setMe,
    setPoints: (balance) => setMe((m) => (m ? { ...m, points: balance } : m)),
    markPlayed: (quizId) => setPlayedToday((s) => new Set(s).add(quizId)),
    applyProgress: (p) => { if (p.level) setLevel(p.level); if (p.streak) setStreak(p.streak); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
