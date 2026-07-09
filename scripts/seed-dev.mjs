/**
 * Yerel geliştirme seed'i — A/B/C test kullanıcıları + örnek veri.
 * Çalıştır: DATABASE_URL=<local> node scripts/seed-dev.mjs
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * PROD-GUARD: seed'in yanlışlıkla üretim veritabanına çalışmasını engeller.
 * NODE_ENV=production ya da DATABASE_URL bilinen managed host'lara (DigitalOcean/Render)
 * işaret ediyorsa hata basıp çıkar. Bilerek geçmek için `--force` bayrağı gerekir.
 */
function assertNotProdDb() {
  if (process.argv.includes('--force')) {
    console.warn('[seed] --force verildi: prod-guard atlandı.');
    return;
  }
  const url = process.env.DATABASE_URL || '';
  const isProdHost = /ondigitalocean\.com|render\.com/i.test(url);
  const isProdEnv = process.env.NODE_ENV === 'production';
  if (isProdEnv || isProdHost) {
    console.error('HATA: Seed script\'i üretim (production) veritabanına çalıştırılamaz.');
    console.error(`  NODE_ENV=${process.env.NODE_ENV || '(boş)'} · DATABASE_URL host prod=${isProdHost}`);
    console.error('  Yerel DB kullan ya da bilerek geçmek için `--force` ekle.');
    process.exit(1);
  }
}

async function upsertUser(email, data) {
  const password = data.password ? await bcrypt.hash(data.password, 12) : undefined;
  const { password: _pw, ...rest } = data;
  return prisma.user.upsert({
    where: { email },
    update: { ...rest, ...(password ? { password } : {}) },
    create: { email, ...rest, password: password ?? null },
  });
}

async function main() {
  console.log('Seeding A/B/C kullanıcıları...');
  const admin = await upsertUser('furkan@canakkale.network', { name: 'Furkan', role: 'admin', title: 'Kurucu', department: 'Yönetim', status: 'active', password: '8418fur6169leV.' });
  const lider = await upsertUser('lider@test.local', { name: 'Deniz Lider', role: 'editor', title: 'Ekip Lideri', department: 'Haber', status: 'active', password: 'Test1234!' });
  const muhasebe = await upsertUser('muhasebe@test.local', { name: 'Selin Muhasebe', role: 'editor', title: 'Muhasebe', department: 'Finans', status: 'active', password: 'Test1234!' });
  const uye1 = await upsertUser('uye1@test.local', { name: 'Ali Muhabir', role: 'user', title: 'Muhabir', department: 'Haber', status: 'active', password: 'Test1234!', managerId: lider.id });
  const uye2 = await upsertUser('uye2@test.local', { name: 'Ayşe Editör', role: 'user', title: 'Editör', department: 'Haber', status: 'active', password: 'Test1234!', managerId: lider.id });

  if ((await prisma.client.count()) === 0) {
    console.log('Örnek veri ekleniyor...');
    await prisma.client.createMany({ data: [
      { companyName: 'Truva Turizm', contactName: 'Mehmet Yıldız', email: 'info@truvaturizm.test', status: 'active', satisfaction: 92 },
      { companyName: 'Boğaz Lojistik', contactName: 'Zeynep Ak', email: 'z@bogaz.test', status: 'active', satisfaction: 78 },
      { companyName: 'Kaleiçi Cafe', contactName: 'Can Er', email: 'can@kaleici.test', status: 'inactive', satisfaction: 60 },
    ]});

    await prisma.news.createMany({ data: [
      { title: 'Çanakkale Boğazı feribot seferleri arttı', category: 'Gündem', author: 'Ali Muhabir', status: 'published', views: 1240, publishDate: new Date() },
      { title: 'ÇOMÜ bahar şenlikleri başladı', category: 'Üniversite', author: 'Ayşe Editör', status: 'published', views: 860, publishDate: new Date() },
      { title: 'Biga OSB\'ye yeni yatırım', category: 'Ekonomi', author: 'Ali Muhabir', status: 'published', views: 430, publishDate: new Date() },
      { title: 'Kent meydanı düzenleme taslağı', category: 'Gündem', author: 'Deniz Lider', status: 'draft', views: 0 },
    ]});

    await prisma.task.createMany({ data: [
      { title: 'Feribot haberini yaz', status: 'done', priority: 'high', assigneeId: uye1.id },
      { title: 'Şenlik fotoğraflarını topla', status: 'done', priority: 'normal', assigneeId: uye2.id },
      { title: 'OSB röportajı ayarla', status: 'in_progress', priority: 'normal', assigneeId: uye1.id },
      { title: 'Meydan taslağını incele', status: 'todo', priority: 'low', assigneeId: uye2.id },
    ]});

    await prisma.tip.createMany({ data: [
      { tipNumber: 'TIP-001', subject: 'Trafik kazası ihbarı', content: 'Kepez\'de zincirleme kaza', source: 'Vatandaş', priority: 'high', status: 'converted', reporterId: uye1.id },
      { tipNumber: 'TIP-002', subject: 'Su kesintisi', content: 'Barbaros mahallesi', source: 'Anonim', priority: 'normal', status: 'new' },
    ]});

    // Ortak bütçe + ödeme talepleri
    const budget = await prisma.budget.create({ data: {
      title: 'Ofis kirası katkısı (Temmuz)', description: 'Ortak ofis gideri', totalAmount: 3000, createdBy: 'Furkan', status: 'open',
      requests: { create: [
        { kind: 'collection', userId: lider.id, title: 'Ofis kirası katkısı (Temmuz)', amount: 1000 },
        { kind: 'collection', userId: uye1.id, title: 'Ofis kirası katkısı (Temmuz)', amount: 1000 },
        { kind: 'collection', userId: uye2.id, title: 'Ofis kirası katkısı (Temmuz)', amount: 1000 },
      ]},
    }});
    // Örnek maaş kaydı
    await prisma.paymentRequest.create({ data: { kind: 'salary', userId: uye1.id, title: 'Temmuz maaşı', amount: 25000, status: 'pending' } });
    console.log('Bütçe:', budget.title);
  }

  const count = await prisma.user.count();
  console.log(`Bitti. Toplam kullanıcı: ${count}`);
  console.log('Giriş: furkan@canakkale.network / 8418fur6169leV.  |  lider@test.local, muhasebe@test.local, uye1@test.local, uye2@test.local (hepsi Test1234!)');
}

assertNotProdDb();
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
