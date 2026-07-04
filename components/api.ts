// @ts-nocheck
const API = process.env.NEXT_PUBLIC_API_URL || '';

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };
  if (options.body instanceof FormData) delete headers['Content-Type'];
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers,
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
