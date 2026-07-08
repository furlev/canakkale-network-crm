'use client';

import { useEffect } from 'react';

/**
 * Görüntülenme sayacı: mount'ta bir kez /api/site/view'a POST atar.
 * sessionStorage ile aynı oturumda aynı haberin tekrar sayılmasını önler.
 */
export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `cn-viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage kapalıysa yine de tek atış yapılır
    }
    fetch('/api/site/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {
      /* sayaç kritik değil — sessiz geç */
    });
  }, [slug]);

  return null;
}
