import { AppConfig } from '../config';
import {
  bookAppointment,
  BookingError,
  getAvailability,
  isSlotAvailable,
} from '../domain/booking';
import { looksLikeStudentProof, quotePrice } from '../domain/pricing';
import {
  findSalons,
  getSalon,
  matchService,
  recommendSimilar,
  reviewScore,
  SalonMatch,
} from '../domain/salonService';
import { planTransport } from '../domain/transport';
import { GeoPoint, Salon, Service } from '../domain/types';
import { detectIntent } from './nlu';
import { MOONZE_SYSTEM_PROMPT, OpenAIClient } from './openai';

export type CardType = 'salon' | 'quote' | 'transport' | 'availability' | 'booking';

export interface Card {
  type: CardType;
  [key: string]: unknown;
}

export interface AssistantResponse {
  text: string;
  cards?: Card[];
  /** Which engine produced the reply: rule-based or OpenAI-augmented. */
  engine: 'rules' | 'openai';
}

interface Session {
  id: string;
  serviceQuery?: string;
  selectedSalonId?: string;
  lastMatches?: SalonMatch[];
  isStudent?: boolean;
  studentVerified?: boolean;
  location?: GeoPoint;
  pending?: 'salon_choice' | 'booking_datetime' | 'booking_name' | 'confirm';
  draft?: {
    date?: string;
    time?: string;
    mobile?: boolean;
    prebooking?: boolean;
    customerName?: string;
  };
}

export interface HandleInput {
  sessionId: string;
  text: string;
  location?: GeoPoint;
  customerPhone?: string;
  customerName?: string;
}

const CURRENCY = (n: number, c: string) => `${c} ${n.toLocaleString('en-US')}`;

export class Assistant {
  private readonly sessions = new Map<string, Session>();
  private readonly openai: OpenAIClient;

  constructor(config: AppConfig) {
    this.openai = new OpenAIClient(config);
  }

  private session(id: string): Session {
    let s = this.sessions.get(id);
    if (!s) {
      s = { id };
      this.sessions.set(id, s);
    }
    return s;
  }

  /** Reset a conversation (used by tests and the "start over" command). */
  reset(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  async handle(input: HandleInput): Promise<AssistantResponse> {
    const session = this.session(input.sessionId);
    if (input.location) session.location = input.location;
    if (input.customerName && !session.draft?.customerName) {
      session.draft = { ...session.draft, customerName: input.customerName };
    }

    const nlu = detectIntent(input.text);

    // Update long-lived context.
    if (nlu.serviceQuery) session.serviceQuery = nlu.serviceQuery;
    if (nlu.student) session.isStudent = true;
    if (looksLikeStudentProof(input.text)) {
      session.isStudent = true;
      session.studentVerified = true;
    }

    // Try to resolve an explicit salon selection first (number or name).
    const selected = this.resolveSalonSelection(session, input.text);
    if (selected) session.selectedSalonId = selected.id;

    let response: AssistantResponse;

    // Handle multi-turn pending states before generic intents.
    if (session.pending === 'confirm') {
      response = this.handleConfirm(session, nlu, input);
    } else if (session.pending === 'booking_name') {
      response = this.handleBookingName(session, input);
    } else if (session.pending === 'booking_datetime' && (nlu.date || nlu.time)) {
      response = this.handleBookingDateTime(session, nlu, input);
    } else {
      response = this.route(session, nlu, input);
    }

    return this.maybeAugment(response, input.text);
  }

  private route(session: Session, nlu: ReturnType<typeof detectIntent>, input: HandleInput): AssistantResponse {
    switch (nlu.intent) {
      case 'greeting':
      case 'help':
        return this.welcome();
      case 'find_salon':
        return this.findSalon(session);
      case 'availability':
        return this.availability(session, nlu);
      case 'pricing':
        return this.pricing(session, nlu);
      case 'recommend':
        return this.recommend(session);
      case 'transport':
        return this.transport(session, nlu);
      case 'student_discount':
        return this.studentDiscount(session);
      case 'book':
        return this.startBooking(session, nlu, input);
      case 'affirm':
        // A bare "yes" with an active salon usually means "book it".
        if (session.selectedSalonId) return this.startBooking(session, nlu, input);
        return this.welcome();
      case 'deny':
        return { text: 'No problem. Is there anything else I can help you with? 💇🏽‍♀️', engine: 'rules' };
      default:
        return session.serviceQuery ? this.findSalon(session) : this.welcome();
    }
  }

  private welcome(): AssistantResponse {
    return {
      engine: 'rules',
      text:
        "Hi, I'm Moonze 💖 your beauty concierge. I can:\n" +
        '• Find salons for a specific hairdo near you\n' +
        '• Show available times & book appointments\n' +
        '• Arrange mobile (come-to-you) service & tell you the markup\n' +
        '• Apply pre-booking and verified student discounts\n' +
        '• Recommend similar highly-rated salons\n' +
        '• Sort out your ride there and back (Uber/Bolt/Little)\n\n' +
        'What hairdo or service are you after? (e.g. "knotless braids near me")',
    };
  }

  private findSalon(session: Session): AssistantResponse {
    if (!session.serviceQuery) {
      return { text: 'Sure! Which hairdo or service would you like? (e.g. box braids, silk press, gel manicure)', engine: 'rules' };
    }
    const service = matchService(session.serviceQuery);
    if (!service) {
      return { text: `I couldn't find "${session.serviceQuery}" yet. Try braids, silk press, locs, manicure, spa or bridal makeup.`, engine: 'rules' };
    }
    const matches = findSalons({ serviceQuery: session.serviceQuery, near: session.location, limit: 4 });
    if (matches.length === 0) {
      return { text: `No salons currently offer ${service.name}. Want me to recommend a close alternative?`, engine: 'rules' };
    }
    session.lastMatches = matches;
    session.pending = 'salon_choice';

    const lines = matches.map((m, i) => {
      const dist = m.distanceKm !== undefined ? ` · ${m.distanceKm} km away` : '';
      const mobile = m.salon.offersMobile ? ' · 🏠 mobile available' : '';
      return `${i + 1}. ${m.salon.name} ⭐ ${m.salon.rating} (${m.salon.reviewCount})${dist}${mobile}\n   ${m.salon.address}, from ${CURRENCY(service.basePrice, m.salon.currency)}`;
    });

    const near = session.location ? ' nearest to you' : '';
    return {
      engine: 'rules',
      text:
        `Here are top salons for ${service.name}${near}:\n\n${lines.join('\n')}\n\n` +
        'Reply with a number to see times, pricing, or transport for that salon.',
      cards: matches.map((m) => this.salonCard(m)),
    };
  }

  private availability(session: Session, nlu: ReturnType<typeof detectIntent>): AssistantResponse {
    const salon = this.currentSalon(session);
    const service = this.currentService(session);
    if (!salon || !service) return this.needSalonFirst();

    const date = nlu.date ?? this.nextOpenDate(salon);
    const slots = getAvailability(salon, service, date);
    const open = slots.filter((s) => s.available);
    if (open.length === 0) {
      return { text: `${salon.name} is fully booked for ${service.name} on ${date}. Want me to check another day or recommend a similar salon?`, engine: 'rules' };
    }
    session.pending = 'booking_datetime';
    session.draft = { ...session.draft, date };
    return {
      engine: 'rules',
      text:
        `Available ${service.name} slots at ${salon.name} on ${date}:\n` +
        open.map((s) => `• ${s.time}`).join('\n') +
        '\n\nTell me a time to book (e.g. "book 14:00"), or ask for pricing/transport.',
      cards: [{ type: 'availability', salon: salon.name, date, slots: open }],
    };
  }

  private pricing(session: Session, nlu: ReturnType<typeof detectIntent>): AssistantResponse {
    const salon = this.currentSalon(session);
    const service = this.currentService(session);
    if (!salon || !service) return this.needSalonFirst();

    const quote = quotePrice({
      salon,
      service,
      mobile: nlu.mobile ?? session.draft?.mobile,
      prebooking: nlu.prebooking ?? session.draft?.prebooking,
      isStudent: session.isStudent,
      studentProofVerified: session.studentVerified,
    });

    const items = quote.lineItems
      .map((li) => `  ${li.amount < 0 ? '−' : '+'} ${CURRENCY(Math.abs(li.amount), quote.currency)}  ${li.label}`)
      .join('\n');
    const notes = quote.notes.length ? `\n\n${quote.notes.map((n) => `ℹ️ ${n}`).join('\n')}` : '';

    return {
      engine: 'rules',
      text:
        `${service.name} at ${salon.name}:\n` +
        `  Base: ${CURRENCY(quote.basePrice, quote.currency)}\n` +
        (items ? `${items}\n` : '') +
        `  ─────────────\n  Total: ${CURRENCY(quote.total, quote.currency)}${notes}\n\n` +
        'Want me to book this, or check transport to the salon?',
      cards: [{ type: 'quote', salon: salon.name, service: service.name, quote }],
    };
  }

  private recommend(session: Session): AssistantResponse {
    const service = this.currentService(session);
    if (!service) return { text: 'Which service should I find similar salons for? (e.g. knotless braids)', engine: 'rules' };
    const refId = session.selectedSalonId ?? session.lastMatches?.[0]?.salon.id;
    let recs: SalonMatch[];
    if (refId) {
      recs = recommendSimilar(refId, session.serviceQuery!, 3);
    } else {
      recs = findSalons({ serviceQuery: session.serviceQuery!, near: session.location, limit: 3 });
    }
    if (recs.length === 0) return { text: 'I could not find a comparable salon right now.', engine: 'rules' };

    const refName = refId ? getSalon(refId)?.name : undefined;
    const lines = recs.map((m, i) =>
      `${i + 1}. ${m.salon.name} ⭐ ${m.salon.rating} (${m.salon.reviewCount}) — "${m.salon.reviews[0]?.comment ?? 'Highly rated'}"`,
    );
    return {
      engine: 'rules',
      text:
        (refName ? `Salons that do ${service.name} about as well as ${refName}:\n\n` : `Great ${service.name} salons:\n\n`) +
        lines.join('\n') +
        '\n\nReply with a number to see times or pricing.',
      cards: recs.map((m) => this.salonCard(m)),
    };
  }

  private transport(session: Session, nlu: ReturnType<typeof detectIntent>): AssistantResponse {
    const salon = this.currentSalon(session);
    if (!salon) return this.needSalonFirst();
    const plan = planTransport(salon, Boolean(nlu.lateFinish));

    const opts = plan.options
      .map((o) => {
        const promo = o.promoCode ? ` code ${o.promoCode}` : '';
        const late = o.coversLateReturn ? ' · covers late return' : '';
        return `• ${o.partner}: ${Math.round(o.discount * 100)}% off${promo}${late}\n  ${o.deepLink}`;
      })
      .join('\n');

    return {
      engine: 'rules',
      text: `${plan.summary}\n${opts}` + (plan.embedded ? '\n\n(You can book these rides right inside the salon chat.)' : ''),
      cards: [{ type: 'transport', plan }],
    };
  }

  private studentDiscount(session: Session): AssistantResponse {
    const salon = this.currentSalon(session);
    if (session.studentVerified) {
      const where = salon ? ` at ${salon.name}` : '';
      const pct = salon ? ` (${Math.round(salon.studentDiscount * 100)}% off)` : '';
      return { text: `You're verified as a student 🎓 — your discount${pct}${where} is applied automatically to quotes. Want a price with it included?`, engine: 'rules' };
    }
    return {
      engine: 'rules',
      text:
        'Yes! We offer a student discount 🎓 on proof of being a student.\n' +
        'Just share a valid student ID number or reply from/with your school email (e.g. name@uni.ac.ke or name@school.edu) and I\'ll unlock it, then apply it to your quote automatically.',
    };
  }

  private startBooking(session: Session, nlu: ReturnType<typeof detectIntent>, input: HandleInput): AssistantResponse {
    const salon = this.currentSalon(session);
    const service = this.currentService(session);
    if (!salon || !service) return this.needSalonFirst();

    session.draft = {
      ...session.draft,
      mobile: nlu.mobile ?? session.draft?.mobile,
      prebooking: nlu.prebooking ?? session.draft?.prebooking ?? true,
      date: nlu.date ?? session.draft?.date,
      time: nlu.time ?? session.draft?.time,
    };

    if (!session.draft.date || !session.draft.time) {
      session.pending = 'booking_datetime';
      const date = session.draft.date ?? this.nextOpenDate(salon);
      const open = getAvailability(salon, service, date).filter((s) => s.available);
      return {
        engine: 'rules',
        text:
          `Let's book ${service.name} at ${salon.name}. Which date and time?\n` +
          `${date} has: ${open.map((s) => s.time).join(', ') || 'no free slots'}.\n` +
          'e.g. "2026-07-20 14:00" or "tomorrow 10am".',
      };
    }
    return this.handleBookingDateTime(session, nlu, input);
  }

  private handleBookingDateTime(session: Session, nlu: ReturnType<typeof detectIntent>, input: HandleInput): AssistantResponse {
    const salon = this.currentSalon(session);
    const service = this.currentService(session);
    if (!salon || !service) return this.needSalonFirst();

    session.draft = {
      ...session.draft,
      date: nlu.date ?? session.draft?.date,
      time: nlu.time ?? session.draft?.time,
      mobile: nlu.mobile ?? session.draft?.mobile,
    };

    if (!session.draft.date || !session.draft.time) {
      session.pending = 'booking_datetime';
      return { text: 'Please give me both a date and a time, e.g. "tomorrow 14:00".', engine: 'rules' };
    }

    // Validate the chosen slot against real availability before collecting more
    // details, so we can guide the customer to an actual open time.
    if (!isSlotAvailable(salon, service, session.draft.date, session.draft.time)) {
      session.pending = 'booking_datetime';
      const open = getAvailability(salon, service, session.draft.date).filter((s) => s.available);
      const chosen = session.draft.time;
      session.draft.time = undefined;
      const offer = open.length
        ? `Open times for ${service.name} on ${session.draft.date} are: ${open.map((s) => s.time).join(', ')}. Which works?`
        : `There are no open ${service.name} slots on ${session.draft.date}. Want to try another day?`;
      return { text: `${chosen} isn't available for ${service.name} at ${salon.name}. ${offer}`, engine: 'rules' };
    }

    const name = session.draft.customerName ?? input.customerName;
    if (!name) {
      session.pending = 'booking_name';
      return { text: 'Great choice! What name should I put the booking under?', engine: 'rules' };
    }
    session.draft.customerName = name;
    session.pending = 'confirm';
    return this.summariseForConfirm(session, salon, service);
  }

  private handleBookingName(session: Session, input: HandleInput): AssistantResponse {
    const salon = this.currentSalon(session);
    const service = this.currentService(session);
    if (!salon || !service) return this.needSalonFirst();
    const name = input.text.trim();
    session.draft = { ...session.draft, customerName: name };
    session.pending = 'confirm';
    return this.summariseForConfirm(session, salon, service);
  }

  private summariseForConfirm(session: Session, salon: Salon, service: Service): AssistantResponse {
    const quote = quotePrice({
      salon,
      service,
      mobile: session.draft?.mobile,
      prebooking: session.draft?.prebooking,
      isStudent: session.isStudent,
      studentProofVerified: session.studentVerified,
    });
    session.draft = { ...session.draft };
    const mobile = session.draft?.mobile ? ' (mobile / come-to-you)' : '';
    return {
      engine: 'rules',
      text:
        `Please confirm your booking:\n` +
        `• ${service.name}${mobile} at ${salon.name}\n` +
        `• ${session.draft?.date} at ${session.draft?.time}\n` +
        `• Name: ${session.draft?.customerName}\n` +
        `• Total: ${CURRENCY(quote.total, quote.currency)}\n\n` +
        'Reply "yes" to confirm or "no" to change anything.',
      cards: [{ type: 'quote', salon: salon.name, service: service.name, quote }],
    };
  }

  private handleConfirm(session: Session, nlu: ReturnType<typeof detectIntent>, input: HandleInput): AssistantResponse {
    if (nlu.intent === 'deny') {
      session.pending = undefined;
      return { text: 'Okay, cancelled. Tell me what you\'d like to change 😊', engine: 'rules' };
    }
    if (nlu.intent !== 'affirm') {
      return { text: 'Reply "yes" to confirm the booking or "no" to cancel.', engine: 'rules' };
    }
    const salon = this.currentSalon(session);
    const service = this.currentService(session);
    if (!salon || !service || !session.draft?.date || !session.draft?.time || !session.draft.customerName) {
      return this.needSalonFirst();
    }
    const quote = quotePrice({
      salon,
      service,
      mobile: session.draft.mobile,
      prebooking: session.draft.prebooking,
      isStudent: session.isStudent,
      studentProofVerified: session.studentVerified,
    });
    try {
      const appointment = bookAppointment({
        salon,
        service,
        customerName: session.draft.customerName,
        customerPhone: input.customerPhone ?? session.id,
        date: session.draft.date,
        time: session.draft.time,
        mobile: Boolean(session.draft.mobile),
        quote,
      });
      session.pending = undefined;
      const plan = planTransport(salon);
      const transportHint = plan.options.length
        ? `\n\nNeed a ride? ${plan.options[0].partner} offers ${Math.round(plan.options[0].discount * 100)}% off to ${salon.name}.`
        : '';
      return {
        engine: 'rules',
        text:
          `✅ Booked! Confirmation ${appointment.id}\n` +
          `${service.name} at ${salon.name}, ${appointment.date} ${appointment.time}.\n` +
          `Total: ${CURRENCY(quote.total, quote.currency)}.${transportHint}`,
        cards: [{ type: 'booking', appointment }],
      };
    } catch (e) {
      if (e instanceof BookingError) {
        session.pending = 'booking_datetime';
        return { text: e.message + ' Please pick another time.', engine: 'rules' };
      }
      throw e;
    }
  }

  // ---- helpers ----

  private resolveSalonSelection(session: Session, text: string): Salon | undefined {
    const matches = session.lastMatches;
    if (!matches?.length) {
      // Even without a pending list, allow selecting by explicit name.
      return this.matchByName(text);
    }
    const numMatch = text.trim().match(/^#?(\d{1,2})\b/);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < matches.length) return matches[idx].salon;
    }
    return this.matchByName(text) ?? undefined;
  }

  private matchByName(text: string): Salon | undefined {
    const t = text.toLowerCase();
    const candidates = (this.sessionsToSalons()).filter((s) => t.includes(s.name.toLowerCase().split(' ')[0]) && s.name.length > 0);
    // Require a reasonably specific name token to avoid false matches.
    return candidates.find((s) => t.includes(s.name.toLowerCase())) ?? undefined;
  }

  private sessionsToSalons(): Salon[] {
    // All known salons (kept small; imported lazily to avoid a cycle).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../data/seed').SALONS as Salon[];
  }

  private currentSalon(session: Session): Salon | undefined {
    if (session.selectedSalonId) return getSalon(session.selectedSalonId);
    if (session.lastMatches?.length === 1) return session.lastMatches[0].salon;
    return undefined;
  }

  private currentService(session: Session): Service | undefined {
    return session.serviceQuery ? matchService(session.serviceQuery) : undefined;
  }

  private needSalonFirst(): AssistantResponse {
    return {
      engine: 'rules',
      text: 'Which salon and service? Tell me a hairdo (e.g. "silk press") and I\'ll list salons, then pick one by number.',
    };
  }

  private nextOpenDate(_salon: Salon): string {
    return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  }

  private salonCard(m: SalonMatch): Card {
    return {
      type: 'salon',
      id: m.salon.id,
      name: m.salon.name,
      rating: m.salon.rating,
      reviewCount: m.salon.reviewCount,
      address: m.salon.address,
      distanceKm: m.distanceKm,
      offersMobile: m.salon.offersMobile,
      mobileMarkup: m.salon.mobileMarkup,
      prebookingDiscount: m.salon.prebookingDiscount,
      studentDiscount: m.salon.studentDiscount,
      basePrice: m.service.basePrice,
      currency: m.salon.currency,
      score: Math.round(reviewScore(m.salon) * 100) / 100,
      topReview: m.salon.reviews[0]?.comment,
    };
  }

  /**
   * Optionally rewrite the deterministic reply through OpenAI to make it more
   * natural. Core structured data (cards) is preserved. Falls back silently to
   * the rule-based text if OpenAI is unavailable or errors.
   */
  private async maybeAugment(response: AssistantResponse, userText: string): Promise<AssistantResponse> {
    if (!this.openai.isEnabled()) return response;
    try {
      const rewritten = await this.openai.complete([
        { role: 'system', content: MOONZE_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `Customer said: "${userText}".\n` +
            `Here is the factual reply to convey (keep all names, prices, times, links and numbers EXACTLY, just make the wording warm and natural):\n${response.text}`,
        },
      ]);
      if (rewritten) return { ...response, text: rewritten, engine: 'openai' };
    } catch {
      // fall through to rule-based text
    }
    return response;
  }
}
