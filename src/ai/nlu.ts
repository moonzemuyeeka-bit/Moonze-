import { SERVICES } from '../data/seed';

export type Intent =
  | 'greeting'
  | 'find_salon'
  | 'availability'
  | 'book'
  | 'pricing'
  | 'recommend'
  | 'transport'
  | 'student_discount'
  | 'help'
  | 'affirm'
  | 'deny'
  | 'unknown';

export interface Nlu {
  intent: Intent;
  serviceQuery?: string;
  mobile?: boolean;
  prebooking?: boolean;
  student?: boolean;
  lateFinish?: boolean;
  date?: string;
  time?: string;
}

const GREETING = /\b(hi|hii+|hello|hey|habari|jambo|niaje|good\s?(morning|afternoon|evening))\b/;
const FIND = /\b(find|look(ing)?|search|need|want|where|which\s+salon|recommend me|get)\b/;
const AVAIL = /\b(available|availability|free|open|slot|times?|when)\b/;
const BOOK = /\b(book|reserve|schedule|appointment|confirm)\b/;
const PRICE = /\b(price|cost|how much|charge|rate|quote|markup|discount)\b/;
const RECOMMEND = /\b(recommend|similar|alternative|another|else|like this|good as)\b/;
const TRANSPORT = /\b(transport|ride|uber|bolt|little|taxi|get there|pick.?up|drop.?off|way to get)\b/;
const STUDENT = /\b(student|campus|university|college|\.edu|\.ac\.)\b/;
const MOBILE = /\b(mobile|come to (me|my)|my (place|home|house)|at home|to my location|come over)\b/;
const PREBOOK = /\b(pre.?book|book(ing)? (ahead|early|in advance)|advance|early bird)\b/;
const LATE = /\b(late|night|after (hours|dark)|finish(ing)? late|evening)\b/;
const AFFIRM = /^(y|yes|yeah|yep|sure|ok(ay)?|correct|confirm|go ahead|please do|do it)\b/;
const DENY = /^(n|no|nope|nah|not now|cancel|stop)\b/;

/** Extract a service/hairdo phrase from free text by scanning known aliases. */
export function extractServiceQuery(text: string): string | undefined {
  const t = text.toLowerCase();
  let best: string | undefined;
  for (const svc of SERVICES) {
    const candidates = [svc.name.toLowerCase(), ...svc.aliases.map((a) => a.toLowerCase())];
    for (const c of candidates) {
      if (t.includes(c) && (!best || c.length > best.length)) {
        best = c;
      }
    }
  }
  return best;
}

function extractDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const t = text.toLowerCase();
  const today = new Date();
  if (/\btoday\b/.test(t)) return toIso(today);
  if (/\btomorrow\b/.test(t)) return toIso(new Date(today.getTime() + 86400000));
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (t.includes(days[i])) {
      const d = new Date(today);
      const delta = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + delta);
      return toIso(d);
    }
  }
  return undefined;
}

function extractTime(text: string): string | undefined {
  // Strip ISO dates so digits like the month/day are not read as a time.
  const cleaned = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');

  // Prefer an explicit HH:MM.
  const hm = cleaned.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hm) {
    const hour = parseInt(hm[1], 10);
    const min = parseInt(hm[2], 10);
    if (hour <= 23 && min <= 59) {
      return `${hour.toString().padStart(2, '0')}:${hm[2]}`;
    }
  }

  // Otherwise require an am/pm marker to disambiguate a bare hour.
  const ap = cleaned.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (ap) {
    let hour = parseInt(ap[1], 10);
    const marker = ap[2].toLowerCase();
    if (hour >= 1 && hour <= 12) {
      if (marker === 'pm' && hour < 12) hour += 12;
      if (marker === 'am' && hour === 12) hour = 0;
      return `${hour.toString().padStart(2, '0')}:00`;
    }
  }

  return undefined;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Lightweight rule-based intent + slot extraction used when OpenAI is off. */
export function detectIntent(text: string): Nlu {
  const t = text.toLowerCase().trim();
  const serviceQuery = extractServiceQuery(t);
  const nlu: Nlu = {
    intent: 'unknown',
    serviceQuery,
    mobile: MOBILE.test(t) || undefined,
    prebooking: PREBOOK.test(t) || undefined,
    student: STUDENT.test(t) || undefined,
    lateFinish: LATE.test(t) || undefined,
    date: extractDate(t),
    time: extractTime(t),
  };

  if (AFFIRM.test(t)) nlu.intent = 'affirm';
  else if (DENY.test(t)) nlu.intent = 'deny';
  else if (STUDENT.test(t) && PRICE.test(t)) nlu.intent = 'student_discount';
  else if (TRANSPORT.test(t)) nlu.intent = 'transport';
  else if (RECOMMEND.test(t)) nlu.intent = 'recommend';
  else if (BOOK.test(t)) nlu.intent = 'book';
  else if (AVAIL.test(t)) nlu.intent = 'availability';
  else if (PRICE.test(t)) nlu.intent = 'pricing';
  else if (STUDENT.test(t)) nlu.intent = 'student_discount';
  else if (FIND.test(t) && serviceQuery) nlu.intent = 'find_salon';
  else if (serviceQuery) nlu.intent = 'find_salon';
  else if (GREETING.test(t)) nlu.intent = 'greeting';
  else if (/\b(help|what can you do|menu|options)\b/.test(t)) nlu.intent = 'help';

  return nlu;
}
