import { z } from 'zod';

/* Shared field helpers — '' kabul edilir, rotalarda `value || null` ile null'a çevrilir */
// ISO / yyyy-mm-dd; rotalarda new Date() ile çevrilir. Boş/null hariç geçersiz tarihleri reddet
// (aksi halde new Date('bozuk') sessizce Invalid Date olarak kaydolur).
const dateString = z
  .string()
  .nullable()
  .refine(v => !v || !Number.isNaN(new Date(v).getTime()), { message: 'Geçersiz tarih' });
const idString = z.string().nullable();

/* ── Contact ── */
export const contactCreate = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().optional().nullable(),
});
export const contactUpdate = contactCreate.partial();

/* ── Client ── */
export const clientCreate = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
  satisfaction: z.coerce.number().int().min(0).max(100).optional(),
});
export const clientUpdate = clientCreate.partial();

/* ── Lead ── */
export const leadCreate = z.object({
  name: z.string().min(1),
  company: z.string().optional().nullable(),
  value: z.coerce.number().min(0).optional(),
  status: z.enum(['new', 'contacted', 'proposal', 'won', 'lost']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});
export const leadUpdate = leadCreate.partial();

/* ── Project ── */
export const projectCreate = z.object({
  name: z.string().min(1),
  status: z.enum(['active', 'completed', 'on_hold']).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  clientId: idString.optional(),
  deadline: dateString.optional(),
});
export const projectUpdate = projectCreate.partial();

/* ── Task ── */
export const taskCreate = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  projectId: idString.optional(),
  assigneeId: idString.optional(),
  dueDate: dateString.optional(),
});
export const taskUpdate = taskCreate.partial();

/* ── Invoice (Finans 2.0 — kalemli fatura + KDV) ── */
// Fatura satır kalemi girdisi; toplamlar SUNUCUDA hesaplanır (istemci değerine güvenilmez).
export const invoiceItemInput = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(20), // KDV oranı %
});
export const invoiceCreate = z.object({
  invoiceNo: z.string().optional(),
  // amount opsiyonel: kalem varsa sunucu hesaplar, yoksa (geriye dönük) elle girilir.
  amount: z.coerce.number().min(0).optional(),
  currency: z.enum(['TRY', 'USD', 'EUR', 'GBP']).optional(),
  status: z.enum(['unpaid', 'paid', 'overdue', 'cancelled']).optional(),
  clientId: idString.optional(),
  advertiserId: idString.optional(),
  dueDate: dateString.optional(),
  discount: z.coerce.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemInput).optional(),
});
export const invoiceUpdate = invoiceCreate.partial();

/* ── Estimate ── */
export const estimateCreate = z.object({
  estimateNo: z.string().optional(),
  amount: z.coerce.number().min(0),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
  clientId: idString.optional(),
  validUntil: dateString.optional(),
});
export const estimateUpdate = estimateCreate.partial();

/* ── Expense ── */
export const expenseCreate = z.object({
  category: z.string().min(1),
  amount: z.coerce.number().min(0),
  description: z.string().optional().nullable(),
  date: dateString.optional(),
});
export const expenseUpdate = expenseCreate.partial();

/* ── News ── */
export const newsCreate = z.object({
  title: z.string().min(1),
  category: z.string().optional(),
  author: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
});
export const newsUpdate = newsCreate.partial();

/* ── Subscriber ── */
export const subscriberCreate = z.object({
  email: z.string().email(),
  source: z.string().optional(),
  status: z.enum(['active', 'unsubscribed']).optional(),
});
export const subscriberUpdate = subscriberCreate.partial();

/* ── Advertiser ── */
export const advertiserCreate = z.object({
  company: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  activeAds: z.coerce.number().int().min(0).optional(),
  totalSpent: z.coerce.number().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export const advertiserUpdate = advertiserCreate.partial();

/* ── Event ── */
export const eventCreate = z.object({
  title: z.string().min(1),
  date: z.string().min(1).refine(v => !Number.isNaN(new Date(v).getTime()), { message: 'Geçersiz tarih' }),
  type: z.enum(['meeting', 'deadline', 'event']).optional(),
  description: z.string().optional().nullable(),
});
export const eventUpdate = eventCreate.partial();

/* ── Ticket ── */
export const ticketCreate = z.object({
  ticketNo: z.string().optional(),
  subject: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  clientId: idString.optional(),
  assigneeId: idString.optional(),
});
export const ticketUpdate = ticketCreate.partial();

/* ── Team member (User) ── */
export const teamCreate = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'user']).optional(),
  department: z.string().optional().nullable(),
  title: z.string().optional().nullable(),       // pozisyon: Ekip Lideri, Muhasebe, Editör...
  managerId: z.string().optional().nullable(),   // bağlı olduğu ekip lideri (B)
  status: z.enum(['active', 'inactive']).optional(),
  password: z.string().min(8).optional().or(z.literal('')), // boş = şifre atama
});
export const teamUpdate = teamCreate.partial();

/* ── Warn (kullanıcı uyarısı) ── */
export const warnCreate = z.object({
  userId: z.string().min(1),
  reason: z.string().min(1),
  severity: z.enum(['low', 'normal', 'high']).optional(),
});

/* ── Budget (ortak harcama) + Payment (ödeme talebi / maaş) ── */
export const budgetCreate = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  dueDate: dateString.optional(),
  distributions: z.array(z.object({
    userId: z.string().min(1),
    amount: z.coerce.number().min(0),
  })).min(1),
});

export const paymentCreate = z.object({
  kind: z.enum(['collection', 'salary']).optional(),
  userId: z.string().min(1),
  title: z.string().min(1),
  amount: z.coerce.number().min(0),
  note: z.string().optional().nullable(),
  dueDate: dateString.optional(),
});
export const paymentUpdate = z.object({
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  title: z.string().min(1).optional(),
  amount: z.coerce.number().min(0).optional(),
  note: z.string().optional().nullable(),
  dueDate: dateString.optional(),
});

/* ── Document ── */
export const documentCreate = z.object({
  name: z.string().min(1),
  type: z.enum(['pdf', 'word', 'excel', 'image', 'other']).optional(),
  size: z.coerce.number().int().min(0).optional(),
  url: z.string().optional().nullable(),
});
export const documentUpdate = documentCreate.partial();

/* ── Tip ── */
export const tipCreate = z.object({
  subject: z.string().min(1),
  content: z.string().min(1),
  source: z.string().optional(),
  sourceType: z.enum(['email', 'phone', 'social', 'web', 'other']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['new', 'investigating', 'verified', 'converted', 'rejected']).optional(),
});
export const tipUpdate = tipCreate.partial().extend({
  reporterId: idString.optional(),
});

/* ── Contract ── */
export const contractCreate = z.object({
  title: z.string().min(1),
  value: z.coerce.number().min(0).optional(),
  status: z.enum(['draft', 'active', 'expired']).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  clientId: idString.optional(),
});
export const contractUpdate = contractCreate.partial();

/* ── Proposal ── */
export const proposalCreate = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  value: z.coerce.number().min(0).optional(),
  status: z.enum(['draft', 'sent', 'approved', 'rejected', 'converted']).optional(),
  clientId: idString.optional(),
});
export const proposalUpdate = proposalCreate.partial();

/* ── Announcement ── */
export const announcementCreate = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  target: z.enum(['Herkes', 'Ekip', 'Müşteri']).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  author: z.string().optional(),
});
export const announcementUpdate = announcementCreate.partial();

/* ── Note ── */
export const noteCreate = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  category: z.string().optional(),
  color: z.string().optional(),
  shared: z.boolean().optional(),
  favorite: z.boolean().optional(),
});
export const noteUpdate = noteCreate.partial();

/* ── Article ── */
export const articleCreate = z.object({
  title: z.string().min(1),
  content: z.string().optional().nullable(),
  category: z.string().optional(),
});
export const articleUpdate = articleCreate.partial().extend({
  views: z.coerce.number().int().min(0).optional(),
});

/* ── Message ── */
export const messageCreate = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1),
  fromMe: z.boolean().optional(),
});

/* ── Setting ── */
export const settingPut = z.object({
  key: z.enum(['general', 'company', 'email', 'notifications', 'ai', 'styleGuide', 'autoPublish', 'aiBudget']),
  // Boyut sınırı: ayarlar küçük yapılandırma nesneleridir; dev JSON'la depo şişirilemesin.
  value: z.unknown().refine(v => {
    try { return JSON.stringify(v).length <= 20_000; } catch { return false; }
  }, { message: 'Ayar değeri çok büyük' }),
});

/* ── AiDraft (AI haber taslağı onay kuyruğu) ── */
export const aiDraftUpdate = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  seoTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  socialPost: z.string().optional(),
  imageUrl: z.string().optional(),
  titleVariants: z.string().optional(),  // JSON: A/B başlık varyantları / seçilen alt başlık (P2)
  district: z.string().optional(),  // ilçe slug'ı (onay kuyruğunda editör düzeltir)
  // 'published' KASITLI olarak yok: yayın yalnızca .../publish route'undan yapılır (siteye SiteArticle olarak).
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

/* ── Auth ── */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'Yeni şifre en az 8 karakter olmalı'),
});
