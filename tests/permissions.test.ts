import { describe, it, expect } from 'vitest';
import {
  levelOf,
  hasLevel,
  isAdmin,
  isLeaderOrAdmin,
  canAccessPath,
} from '@/lib/permissions';

describe('levelOf', () => {
  it('admin → A, editor → B, diğer/boş → C', () => {
    expect(levelOf('admin')).toBe('A');
    expect(levelOf('editor')).toBe('B');
    expect(levelOf('user')).toBe('C');
    expect(levelOf('herhangi')).toBe('C');
    expect(levelOf(null)).toBe('C');
    expect(levelOf(undefined)).toBe('C');
  });
});

describe('hasLevel', () => {
  it('sıralama A ≥ B ≥ C', () => {
    expect(hasLevel({ role: 'admin' }, 'A')).toBe(true);
    expect(hasLevel({ role: 'admin' }, 'C')).toBe(true);
    expect(hasLevel({ role: 'editor' }, 'B')).toBe(true);
    expect(hasLevel({ role: 'editor' }, 'A')).toBe(false);
    expect(hasLevel({ role: 'user' }, 'B')).toBe(false);
    expect(hasLevel({ role: 'user' }, 'C')).toBe(true);
    expect(hasLevel(null, 'C')).toBe(true); // C=0 eşiği herkesçe karşılanır
    expect(hasLevel(null, 'B')).toBe(false);
  });
});

describe('isAdmin / isLeaderOrAdmin', () => {
  it('rol tabanlı kısayollar', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true);
    expect(isAdmin({ role: 'editor' })).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isLeaderOrAdmin({ role: 'admin' })).toBe(true);
    expect(isLeaderOrAdmin({ role: 'editor' })).toBe(true);
    expect(isLeaderOrAdmin({ role: 'user' })).toBe(false);
  });
});

describe('canAccessPath', () => {
  it('oturum yoksa erişim yok', () => {
    expect(canAccessPath(null, '/tasks')).toBe(false);
  });

  it('A her şeye erişir', () => {
    const a = { role: 'admin' };
    expect(canAccessPath(a, '/settings')).toBe(true);
    expect(canAccessPath(a, '/editor-performance')).toBe(true);
    expect(canAccessPath(a, '/clients/5')).toBe(true);
  });

  it('B: /settings hariç her şey; /editor-performance açık', () => {
    const b = { role: 'editor' };
    expect(canAccessPath(b, '/settings')).toBe(false);
    expect(canAccessPath(b, '/editor-performance')).toBe(true);
    expect(canAccessPath(b, '/clients')).toBe(true);
  });

  it('C: allowlist içi açık, dışı kapalı; /editor-performance ve /settings kapalı', () => {
    const c = { role: 'user' };
    expect(canAccessPath(c, '/tasks/42')).toBe(true); // ilk segment /tasks allowlist'te
    expect(canAccessPath(c, '/payments')).toBe(true);
    expect(canAccessPath(c, '/clients')).toBe(false); // allowlist dışı
    expect(canAccessPath(c, '/settings')).toBe(false);
    expect(canAccessPath(c, '/editor-performance')).toBe(false);
    expect(canAccessPath(c, '/')).toBe(true);
  });
});
