export const PALETTES = {
  'night-emerald': { p: '#059669', l: '#10b981', pale: '#34d399', bg: '#020617', mid: '#0f172a', soft: '#1e293b', gold: '#fbbf24' },
  'japan-red': { p: '#bc002d', l: '#e11d48', pale: '#fda4af', bg: '#0f172a', mid: '#1e293b', soft: '#334155', gold: '#fbbf24' },
  'jade-gold': { p: '#0891b2', l: '#06b6d4', pale: '#67e8f9', bg: '#012b3e', mid: '#0c4a6e', soft: '#164e63', gold: '#fbbf24' },
  'purple-moon': { p: '#7c3aed', l: '#a78bfa', pale: '#ddd6fe', bg: '#0d0a1e', mid: '#1e1b4b', soft: '#2e1065', gold: '#fbbf24' },
} as const

export type PaletteKey = keyof typeof PALETTES

export type TemplateData = Record<string, string>

export type Field =
  | { section: string }
  | { key: string; label: string; big?: boolean }

export const PALETTE_OPTIONS: ReadonlyArray<{ key: PaletteKey; label: string; swatch: string }> = [
  { key: 'night-emerald', label: 'Night Emerald', swatch: '#10b981' },
  { key: 'japan-red', label: 'Japan Red', swatch: '#e11d48' },
  { key: 'jade-gold', label: 'Jade & Teal', swatch: '#06b6d4' },
  { key: 'purple-moon', label: 'Purple Moon', swatch: '#a78bfa' },
]

export const TEMPLATE_DEFAULTS: Record<string, TemplateData> = {
  T01: { badge: 'ANNOUNCEMENT', headline: 'IMPORTANT', accentWord: 'UPDATE', body: 'Replace this with your message. Works for any community news, event update, or important notice.', date: 'May 16, 2026', website: 'muslimsinjapan.com' },
  T02: { category: 'COMMUNITY EVENT', eventTitle: 'ISLAMIC\nGATHERING', date: 'Friday, May 22, 2026', time: "After Jumu'ah — 2:00 PM", location: 'Tokyo Camii, Shibuya', footer: 'ALL ARE WELCOME' },
  T03: { quote: '"Whoever believes in Allah and the Last Day should speak good or remain silent."', attribution: '— Prophet Muhammad ﷺ', source: 'Sahih al-Bukhari & Muslim' },
  T04: { city: 'Tokyo, Japan', dateStr: 'Friday · 16 May 2026', hijri: "16 Dhul-Qa'dah 1447", fajr: '04:12', dhuhr: '11:45', asr: '15:20', maghrib: '18:38', isha: '20:10' },
  T05: { cityBadge: 'TOKYO', mosqueName: 'Tokyo Camii & Turkish Culture Center', address: '1-19 Oyamacho, Shibuya, Tokyo · Open Daily' },
  T06: { arabic: 'رمضان مبارك', heading: 'RAMADAN MUBARAK', subtitle: 'May this blessed month bring peace & blessings' },
  T07: { category: 'COMMUNITY NEWS', date: 'May 16, 2026', headline: 'Muslims Finding Community in Modern Japan', body: 'A growing network of mosques, halal restaurants, and Islamic schools is reshaping daily Muslim life.', author: 'Muslims in Japan Editorial' },
  T08: { arabic: 'بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيمِ', translit: 'Bismillāhi r-raḥmāni r-raḥīm', translation: '"In the name of Allah, the Most Gracious, the Most Merciful"', topic: 'BEFORE ANY DEED' },
  T09: { title: 'EATING HALAL IN JAPAN', tip1: '🔍 Look for the ハラール (halal) certification mark', tip2: '🍜 Ramen shops with halal broth are growing in Tokyo', tip3: '📍 Muslim-friendly restaurants listed on our app', tip4: '🛒 Halal grocery stores in Shinjuku & Shin-Okubo' },
  T10: { month: 'Dhul-Hijjah', monthAr: 'ذو الحجة', yearAH: '1447 AH', yearCE: 'May–June 2026' },
  T11: { title: 'MUSLIM TRAVEL IN JAPAN', t1: 'Prayer Spaces', b1: 'Many department stores & airports have musolla rooms. Ask for 礼拝室.', t2: 'Halal Food', b2: 'Shin-Okubo in Tokyo has the highest concentration of halal restaurants.', t3: 'Qibla Direction', b3: 'From Japan, Qibla faces roughly northwest (~290°). Use our app.', t4: 'Water for Wudu', b4: 'Public restrooms have sinks. Carry a small bottle for istinja.' },
  T12: { title: 'ISLAM IN JAPAN TODAY', v1: '100+', l1: 'Mosques Listed', v2: '47', l2: 'Prefectures', v3: '3M+', l3: 'Muslims in Japan', v4: 'Free', l4: 'Forever & Always' },
  T13: { badge: 'TRAVEL TIP', headline: 'FIND YOUR NEAREST', accentWord: 'MOSQUE', body: "Use our interactive mosque finder to locate prayer spaces anywhere across Japan's 47 prefectures.", cta: 'Find Mosques →' },
  T14: { city: 'From Tokyo', coords: '35.6762° N, 139.6503° E', degrees: '289.5°', dist: 'Northwest from Tokyo · ~9,560 km to Makkah' },
  T15: { tagline: 'WELCOME · ようこそ', heading: 'MUSLIMS IN JAPAN', body: 'Your guide to Islamic life, prayer, mosques & community across Japan.', f1: '🕌 100+ Mosques', f2: '🕐 Prayer Times', f3: '🤲 Duas & Adhkar', f4: '📅 Islamic Calendar' },
}

export const TEMPLATE_FIELDS: Record<string, Field[]> = {
  T01: [{ section: 'Content' }, { key: 'badge', label: 'Badge Text' }, { key: 'headline', label: 'Main Headline' }, { key: 'accentWord', label: 'Accent Word' }, { key: 'body', label: 'Body Text', big: true }, { section: 'Details' }, { key: 'date', label: 'Date' }, { key: 'website', label: 'Website' }],
  T02: [{ section: 'Event Info' }, { key: 'category', label: 'Category Badge' }, { key: 'eventTitle', label: 'Event Title' }, { key: 'date', label: 'Date' }, { key: 'time', label: 'Time' }, { key: 'location', label: 'Location' }, { key: 'footer', label: 'Footer Text' }],
  T03: [{ section: 'Quote' }, { key: 'quote', label: 'Quote Text', big: true }, { key: 'attribution', label: 'Attribution' }, { key: 'source', label: 'Source' }],
  T04: [{ section: 'Location & Date' }, { key: 'city', label: 'City' }, { key: 'dateStr', label: 'Date' }, { key: 'hijri', label: 'Hijri Date' }, { section: 'Prayer Times' }, { key: 'fajr', label: 'Fajr' }, { key: 'dhuhr', label: 'Dhuhr' }, { key: 'asr', label: 'Asr' }, { key: 'maghrib', label: 'Maghrib' }, { key: 'isha', label: "Isha'" }],
  T05: [{ section: 'Mosque Info' }, { key: 'cityBadge', label: 'City Badge' }, { key: 'mosqueName', label: 'Mosque Name' }, { key: 'address', label: 'Address' }],
  T06: [{ section: 'Ramadan Card' }, { key: 'arabic', label: 'Arabic Text' }, { key: 'heading', label: 'Heading' }, { key: 'subtitle', label: 'Subtitle', big: true }],
  T07: [{ section: 'Article' }, { key: 'category', label: 'Category Badge' }, { key: 'date', label: 'Date' }, { key: 'headline', label: 'Headline' }, { key: 'body', label: 'Body Text', big: true }, { key: 'author', label: 'Author Name' }],
  T08: [{ section: 'Dua Card' }, { key: 'arabic', label: 'Arabic Text' }, { key: 'translit', label: 'Transliteration' }, { key: 'translation', label: 'Translation', big: true }, { key: 'topic', label: 'Topic Badge' }],
  T09: [{ section: 'Title' }, { key: 'title', label: 'Main Title' }, { section: 'Tips' }, { key: 'tip1', label: 'Tip 1' }, { key: 'tip2', label: 'Tip 2' }, { key: 'tip3', label: 'Tip 3' }, { key: 'tip4', label: 'Tip 4' }],
  T10: [{ section: 'Calendar Header' }, { key: 'month', label: 'Month (English)' }, { key: 'monthAr', label: 'Month (Arabic)' }, { key: 'yearAH', label: 'Year AH' }, { key: 'yearCE', label: 'Gregorian Year' }],
  T11: [{ section: 'Title' }, { key: 'title', label: 'Main Title' }, { section: 'Tip 1' }, { key: 't1', label: 'Title' }, { key: 'b1', label: 'Body', big: true }, { section: 'Tip 2' }, { key: 't2', label: 'Title' }, { key: 'b2', label: 'Body', big: true }, { section: 'Tip 3' }, { key: 't3', label: 'Title' }, { key: 'b3', label: 'Body', big: true }, { section: 'Tip 4' }, { key: 't4', label: 'Title' }, { key: 'b4', label: 'Body', big: true }],
  T12: [{ section: 'Header' }, { key: 'title', label: 'Title' }, { section: 'Stats' }, { key: 'v1', label: 'Value 1' }, { key: 'l1', label: 'Label 1' }, { key: 'v2', label: 'Value 2' }, { key: 'l2', label: 'Label 2' }, { key: 'v3', label: 'Value 3' }, { key: 'l3', label: 'Label 3' }, { key: 'v4', label: 'Value 4' }, { key: 'l4', label: 'Label 4' }],
  T13: [{ section: 'Content' }, { key: 'badge', label: 'Badge' }, { key: 'headline', label: 'Headline' }, { key: 'accentWord', label: 'Accent Word' }, { key: 'body', label: 'Body Text', big: true }, { key: 'cta', label: 'CTA Button' }],
  T14: [{ section: 'Qibla Info' }, { key: 'city', label: 'Location' }, { key: 'coords', label: 'Coordinates' }, { key: 'degrees', label: 'Bearing (degrees)' }, { key: 'dist', label: 'Distance Text' }],
  T15: [{ section: 'Content' }, { key: 'tagline', label: 'Tagline' }, { key: 'heading', label: 'Heading' }, { key: 'body', label: 'Body Text', big: true }, { section: 'Features' }, { key: 'f1', label: 'Feature 1' }, { key: 'f2', label: 'Feature 2' }, { key: 'f3', label: 'Feature 3' }, { key: 'f4', label: 'Feature 4' }],
}

export const TEMPLATE_META = [
  { id: 'T01', label: 'Breaking Announcement', tag: 'Dark · 1:1' },
  { id: 'T02', label: 'Event Poster', tag: 'Color · 1:1' },
  { id: 'T03', label: 'Quote Card', tag: 'Dark · 1:1' },
  { id: 'T04', label: 'Prayer Times', tag: 'Dark · 1:1' },
  { id: 'T05', label: 'Mosque Spotlight', tag: 'Photo · 1:1' },
  { id: 'T06', label: 'Ramadan Mubarak', tag: 'Purple · 1:1' },
  { id: 'T07', label: 'Community News', tag: 'Green · 1:1' },
  { id: 'T08', label: 'Dua Card', tag: 'Cream · 1:1' },
  { id: 'T09', label: 'Halal Food Guide', tag: 'Amber · 1:1' },
  { id: 'T10', label: 'Islamic Calendar', tag: 'Dark · 1:1' },
  { id: 'T11', label: 'Travel Tips', tag: 'Teal · 1:1' },
  { id: 'T12', label: 'Stats Infographic', tag: 'Light · 1:1' },
  { id: 'T13', label: 'Story Vertical', tag: 'Dark · 9:16' },
  { id: 'T14', label: 'Qibla Direction', tag: 'Teal · 1:1' },
  { id: 'T15', label: 'Welcome Banner', tag: 'Split · 1:1' },
] as const
