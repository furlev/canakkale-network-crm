/**
 * Prod (DigitalOcean) icin: ADC authorized_user kimligini GOOGLE_VERTEX_CREDENTIALS_JSON
 * env-JSON dalindan test eder (prod'un kullanacagi kod yolu) ve DO'ya yapistirilacak
 * gitignored dosyayi uretir. Token transcript'e basilmaz.
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT = 'project-089008bc-3f59-4485-a22';
const LOCATION = 'global';
const adcPath = path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json');
const adc = JSON.parse(fs.readFileSync(adcPath, 'utf8'));
const minified = JSON.stringify(adc); // tek satir, DO env'e yapistirmaya hazir

// 1) Prod'un kullanacagi dal: googleAuthOptions.credentials (dosya DEGIL env-JSON)
const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT,
  location: LOCATION,
  googleAuthOptions: { credentials: adc },
});

try {
  const r = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: 'Tek cümle: Çanakkale nerede?',
    config: { thinkingConfig: { thinkingBudget: 0 } },
  });
  console.log('PROD-DAL TEST ✓ (env-JSON credentials calisiyor):', (r.text || '').trim().slice(0, 80));
} catch (e) {
  console.error('PROD-DAL TEST ✗', e?.message || e);
  process.exit(1);
}

// 2) DO'ya yapistirilacak dosyayi yaz (gitignored: do-vertex-credentials.json)
const outCreds = path.join(process.cwd(), 'do-vertex-credentials.json');
fs.writeFileSync(outCreds, minified, 'utf8');
console.log(`\nGOOGLE_VERTEX_CREDENTIALS_JSON degeri yazildi -> ${outCreds}`);
console.log(`(uzunluk: ${minified.length} karakter, tip: ${adc.type})`);
console.log('\nDO env (3 degisken):');
console.log(`  GOOGLE_VERTEX_PROJECT = ${PROJECT}`);
console.log(`  GOOGLE_CLOUD_LOCATION = ${LOCATION}`);
console.log('  GOOGLE_VERTEX_CREDENTIALS_JSON = <do-vertex-credentials.json icerigi> (ENCRYPTED)');
