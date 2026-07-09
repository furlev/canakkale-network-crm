/**
 * Basit yapılandırılmış (JSON) logger — bağımlılıksız, kritik yerlerde kullanıma hazır.
 *
 * Neden: `console.log('...')` serbest metni prod log toplayıcılarda (DO, Sentry breadcrumb,
 * grep) zor filtrelenir. Bu logger her satırı tek-satır JSON basar → seviye/alan bazlı arama
 * kolaylaşır. Seviye eşiği `LOG_LEVEL` env'i ile ayarlanır (varsayılan 'info').
 *
 * Graceful: hiçbir env gerektirmez; toplayıcı yoksa yalnız stdout/stderr'e yazar.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const env = (process.env.LOG_LEVEL || '').toLowerCase() as LogLevel;
  return ORDER[env] ?? ORDER.info;
}

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  if (ORDER[level] < threshold()) return;
  const record: Record<string, unknown> = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta || {}),
  };
  let line: string;
  try {
    line = JSON.stringify(record);
  } catch {
    // Döngüsel/serileştirilemeyen meta → güvenli düşüş.
    line = JSON.stringify({ t: record.t, level, msg });
  }
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
