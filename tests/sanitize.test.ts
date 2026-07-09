import { describe, it, expect } from 'vitest';
import { sanitizeHtml, youtubeEmbedUrl } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('boş/null → boş string', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('script etiketi içeriğiyle birlikte atılır', () => {
    const out = sanitizeHtml('<p>merhaba</p><script>alert(1)</script>');
    expect(out).toContain('merhaba');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('img onerror (ayırıcı-varyantı) XSS temizlenir', () => {
    const out = sanitizeHtml('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('alert');
  });

  it('javascript: şeması reddedilir', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">tık</a>');
    expect(out).not.toContain('javascript:');
  });

  it('güvenli link korunur ve rel=noopener eklenir', () => {
    const out = sanitizeHtml('<a href="https://example.com">site</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('noopener');
  });

  it('YouTube iframe korunur, yabancı iframe düşer', () => {
    const yt = sanitizeHtml('<iframe src="https://www.youtube.com/embed/abc123"></iframe>');
    expect(yt).toContain('<iframe');
    expect(yt).toContain('youtube.com/embed/abc123');
    // Yabancı host: tag kalsa da tehlikeli src DÜŞER (embed gerçekleşmez).
    const evil = sanitizeHtml('<iframe src="https://evil.com/x"></iframe>');
    expect(evil).not.toContain('evil.com');
    expect(evil).not.toContain('src=');
  });

  it('protokol-göreli URL reddedilir', () => {
    const out = sanitizeHtml('<a href="//evil.com">x</a>');
    expect(out).not.toContain('//evil.com');
  });
});

describe('youtubeEmbedUrl', () => {
  it('watch / youtu.be / shorts / embed biçimlerini tanır', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(youtubeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
  });

  it('tanınmayan URL → null', () => {
    expect(youtubeEmbedUrl('https://vimeo.com/123')).toBeNull();
    expect(youtubeEmbedUrl(null)).toBeNull();
    expect(youtubeEmbedUrl('')).toBeNull();
  });
});
