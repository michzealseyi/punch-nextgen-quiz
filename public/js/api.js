// Thin fetch wrapper. Token is kept in localStorage so a refresh keeps you signed in.
const Api = (() => {
  const KEY = 'nextgen_token';
  let token = null;
  try { token = localStorage.getItem(KEY); } catch { /* storage blocked */ }

  function setToken(t) {
    token = t;
    try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  }

  async function request(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch('/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Can’t reach the server. Check your connection and try again.');
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('auth:expired')); }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: res.status });
    return data;
  }

  return {
    get hasToken() { return !!token; },
    setToken,
    get: (p) => request(p),
    post: (p, body) => request(p, { method: 'POST', body: body || {} }),
    patch: (p, body) => request(p, { method: 'PATCH', body }),
    del: (p) => request(p, { method: 'DELETE' }),
  };
})();
