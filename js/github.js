// GitHub REST API istemcisi: veri reposundaki JSON dosyalarını okur/yazar.
const API = 'https://api.github.com';

export function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHubError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export class GitHub {
  constructor({ owner, repo, token }) {
    this.owner = owner.trim();
    this.repo = repo.trim();
    this.token = token.trim();
    this.branch = null;
  }

  get base() { return `${API}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`; }

  async req(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new GitHubError('Ağ hatası: GitHub\'a ulaşılamadı', 0);
    }
    if (!res.ok) {
      let msg = `GitHub hatası (${res.status})`;
      try { const j = await res.json(); if (j.message) msg += `: ${j.message}`; } catch {}
      throw new GitHubError(msg, res.status);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // Repo bilgisini getirir: gizli mi, yazma izni var mı, varsayılan dal.
  async repoInfo() {
    const info = await this.req('GET', this.base);
    this.branch = info.default_branch || 'main';
    return info;
  }

  // data/ altındaki tüm dosyaların yol -> blob sha haritası.
  async tree() {
    if (!this.branch) await this.repoInfo();
    try {
      const t = await this.req('GET', `${this.base}/git/trees/${encodeURIComponent(this.branch)}?recursive=1`);
      const map = new Map();
      for (const item of t.tree || []) {
        if (item.type === 'blob' && item.path.startsWith('data/') && item.path.endsWith('.json')) {
          map.set(item.path, item.sha);
        }
      }
      return map;
    } catch (e) {
      // Boş repo (409) ya da dal henüz yok (404): hiç dosya yok demektir.
      if (e.status === 409 || e.status === 404) return new Map();
      throw e;
    }
  }

  async getBlob(sha) {
    const b = await this.req('GET', `${this.base}/git/blobs/${sha}`);
    return JSON.parse(b64decode(b.content));
  }

  async getFile(path) {
    try {
      const f = await this.req('GET', `${this.base}/contents/${encodeURI(path)}?t=${Date.now()}`);
      return { data: JSON.parse(b64decode(f.content)), sha: f.sha };
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async putFile(path, data, sha, message) {
    const body = { message, content: b64encode(JSON.stringify(data, null, 1) + '\n') };
    if (sha) body.sha = sha;
    const r = await this.req('PUT', `${this.base}/contents/${encodeURI(path)}`, body);
    if (!this.branch) this.branch = 'main';
    return r.content.sha;
  }
}
