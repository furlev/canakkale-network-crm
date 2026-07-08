import { PrismaClient } from '@prisma/client';

/**
 * DATABASE_URL'e bağlantı havuzu sınırı ekler.
 *
 * DigitalOcean managed PostgreSQL (küçük plan) toplam ~22 bağlantı sunar ve birkaçını
 * SUPERUSER'a ayırır. Havuz sınırlanmazsa Prisma'nın varsayılan havuzu (num_cpus*2+1)
 * tüm regular slotları tüketebiliyor; bu durumda deploy sırasında container start'ta çalışan
 * `prisma migrate deploy` bağlantı bulamayıp "remaining connection slots are reserved for
 * roles with the SUPERUSER attribute" ile düşüyor ve deploy başarısız oluyor. connection_limit
 * ile uygulamanın ayak izini küçültüp migrate'e ve baş kalan işlere yer bırakıyoruz.
 * Değer PRISMA_CONNECTION_LIMIT env'i ile ayarlanabilir (varsayılan 8).
 */
function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  const limit = process.env.PRISMA_CONNECTION_LIMIT || '8';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=${limit}&pool_timeout=20`;
}

const prismaClientSingleton = () => {
  const url = databaseUrl();
  return url ? new PrismaClient({ datasourceUrl: url }) : new PrismaClient();
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
