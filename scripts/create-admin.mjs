/**
 * Bir kullanıcıya yönetici girişi tanımlar (yoksa oluşturur).
 * Kullanım: node scripts/create-admin.mjs <email> <sifre> [isim]
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const [email, password, name = 'Admin'] = process.argv.slice(2);

if (!email || !password) {
  console.error('Kullanım: node scripts/create-admin.mjs <email> <sifre> [isim]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Şifre en az 8 karakter olmalı.');
  process.exit(1);
}

const prisma = new PrismaClient();

const hash = await bcrypt.hash(password, 12);
const user = await prisma.user.upsert({
  where: { email },
  update: { password: hash, role: 'admin', status: 'active' },
  create: { email, name, password: hash, role: 'admin', status: 'active' },
});

console.log(`✅ Yönetici hazır: ${user.email} (${user.name})`);
await prisma.$disconnect();
