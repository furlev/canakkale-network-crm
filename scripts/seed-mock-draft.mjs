/** Onay kuyruğu UI'sını test etmek için sahte bir AiDraft ekler (billing beklerken). */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.aiDraft.count();
  if (existing > 0) { console.log(`Zaten ${existing} taslak var, atlandı.`); await prisma.$disconnect(); return; }
  const d = await prisma.aiDraft.create({
    data: {
      topic: 'Çanakkale Boğazı feribot seferleri',
      title: 'Çanakkale Boğazı’nda Feribot Seferlerine Yaz Düzenlemesi',
      body: '<p>Çanakkale Boğazı’nda feribot işletmeleri, yaz sezonu yoğunluğu nedeniyle sefer sayısını artırdığını bildirdi. Yetkililer, Eceabat–Çanakkale ve Kilitbahir hatlarında ek seferlerin devreye alındığını belirtti.</p><p>Ulaşım koordinasyonunun tatil dönemi boyunca sürdürüleceği ifade edildi. Sürücülerin yoğun saatlerde alternatif hatları değerlendirmesi önerildi.</p>',
      category: 'Gündem',
      tags: JSON.stringify(['Çanakkale', 'Feribot', 'Ulaşım', 'Boğaz']),
      seoTitle: 'Çanakkale Feribot Seferlerine Yaz Düzenlemesi',
      metaDescription: 'Çanakkale Boğazı’nda feribot seferleri yaz sezonu için artırıldı; ek seferler ve alternatif hatlar gündemde.',
      socialPost: '⛴️ Çanakkale Boğazı’nda feribot seferlerine yaz düzenlemesi! Ek seferler devrede.',
      imageUrl: null,
      sources: JSON.stringify(['https://www.canakkaleolay.com/', 'https://news.google.com/']),
      confidence: 0.82,
      status: 'pending',
    },
  });
  console.log('Mock taslak eklendi:', d.title);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
