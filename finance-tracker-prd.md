# Product Requirements Document
## Personal Ultimate Finance Tracker (PUFT)
**Version:** 1.1  
**Date:** May 26, 2026  
**Status:** Draft  

---

## 1. Executive Summary

**PUFT** is a cross-platform personal finance tracker — available as a web app and mobile app — designed to eliminate the friction of managing money. It combines AI-powered bill parsing, instant manual entry, deep analytics, group expense splitting, and a set of uniquely useful features that no other finance app currently bundles together. The product's north star: **"Every rupee tracked in under 5 seconds."**

---

## 2. Problem Statement

Existing finance apps suffer from:
- Slow, clunky bill upload flows (OCR takes too long, corrections are painful)
- No real group expense management within personal finance context
- Analytics that show *what happened* but not *what to do next*
- No smart nudges or proactive financial intelligence
- Poor offline and low-bandwidth support

---

## 3. Target Users

| Persona | Description |
|---|---|
| **The Busy Professional** | Earns well, spends across categories, rarely tracks anything |
| **The Budget Optimizer** | Tracks everything, wants deep analytics and forecasting |
| **The Group Splitter** | Travels often, shares rent/utilities, needs fair expense splits |
| **The Side Hustler** | Multiple income streams, needs income + expense categorization |

---

## 4. Core Principles

1. **Speed First** — Every primary action (add expense, upload bill) must complete in ≤5 seconds
2. **Zero Friction** — No mandatory sign-up fields beyond email. No forced tutorials.
3. **Intelligence by Default** — AI auto-categorizes, parses bills, and surfaces insights automatically
4. **Privacy-First** — All financial data encrypted at rest. Local-first option available.
5. **Cross-Platform Parity** — Web and mobile apps have feature parity on all core flows

---

## 5. Feature Specifications

---

### 5.1 MUST-HAVE FEATURES

---

#### 5.1.1 Bill Upload & AI Parsing

**Goal:** Extract structured data from any bill — physical, digital, PDF, or screenshot — in under 3 seconds.

**Sub-features:**

- **Camera Capture** (mobile): One-tap capture → auto-crop → parse
- **PDF/Image Upload** (web + mobile): Drag-and-drop or file picker
- **URL Import**: Paste a merchant email link or bill URL → auto-fetch and parse
- **Email Forwarding**: Forward receipts to a unique `bills@puft.app` address → auto-parsed and categorized
- **Supported formats**: JPG, PNG, PDF, HEIC, webp, scanned documents

**Parsed fields (auto-extracted):**
- Merchant name
- Transaction date
- Line items (item name, quantity, amount)
- Tax (GST, VAT, etc.)
- Total amount
- Payment method (if visible)
- Category (AI-inferred)

**Correction UI:**
- Tappable inline fields to correct any parsed value
- "Confirm All" button to accept parsed data in one tap
- Confidence score shown per field (low-confidence fields highlighted in yellow)

**Edge cases:**
- Unreadable scan → prompt for manual entry pre-filled with what was detected
- Multi-page bills → stitch pages before parsing
- Foreign currency bills → auto-convert using date-of-transaction exchange rate

---

#### 5.1.2 Manual Bill / Expense Entry

**Goal:** Add any transaction in under 5 seconds.

**Quick Entry (Default Mode):**
- Single input bar at the top: `Amount` + `Description` → press Enter
- Smart defaults: today's date, last-used category, last-used account
- Voice input supported: "Spent 250 on lunch at Swiggy" → parsed automatically

**Full Entry Mode:**
- Amount, currency
- Date & time
- Category (AI-suggested, manually overridable)
- Sub-category
- Account / wallet
- Payment method
- Merchant
- Tags (free-form)
- Notes
- Receipt attachment
- Recurring flag (daily / weekly / monthly / custom)
- Group assignment (see Section 5.1.5)

**Batch Entry:**
- Import from CSV / Excel
- Paste a table from any source → auto-map columns

---

#### 5.1.3 Fast Upload Mode

**Goal:** Reduce the time from "I have a bill" to "It's logged" to under 3 seconds.

**Mechanism:**
- **Floating Action Button** always visible on mobile
- **Keyboard shortcut** on web: `Cmd/Ctrl + N`
- **Widget** on mobile home screen (iOS & Android) → directly opens fast entry
- **Quick-add from notification** on mobile: one-tap from a UPI/payment notification to pre-fill amount
- **Siri / Google Assistant integration**: "Hey Siri, log 180 rupees at BigBasket"
- **WhatsApp / Telegram Bot**: Send a message or photo from any chat app → expense logged instantly (see Section 5.1.6)

**Speed optimizations:**
- Predictive category based on merchant name (local ML model, runs offline)
- Recent merchants shown as quick-tap options
- Smart amount suggestions based on merchant history

---

#### 5.1.4 Finance Analytics

**Goal:** Answer "Where is my money going?" instantly, and "What should I do about it?" proactively.

**Dashboard:**
- Net worth snapshot (assets − liabilities)
- Monthly cash flow bar (income vs. spend)
- Spending heatmap (by day of week / time of day)
- Category donut chart with drill-down
- Top merchants this month
- Budget progress bars

**Reports:**
- Monthly summary with YoY and MoM comparisons
- Category trends over time (line chart)
- Merchant spend history
- Income vs. Expense waterfall chart
- Savings rate trend

**Filters & Segmentation:**
- Date range (preset + custom)
- Category, subcategory, tags
- Account / payment method
- Group / individual expenses
- Recurring vs. one-time

**Export:**
- PDF report (shareable)
- CSV / Excel raw data
- CA-ready export format (TDS / GST summary)

**AI Insights Engine (Proactive):**
- "You spent 40% more on food this month vs. your 6-month average"
- "Your top 3 spending days are Fridays. Consider a spending check-in."
- "You have ₹12,000 in unused subscriptions this month"
- Weekly digest email / push notification

---

#### 5.1.5 Groups

**Goal:** Track and settle shared expenses without switching to a separate app.

**Group Creation:**
- Create group with name, icon, optional description
- Add members by phone / email / username
- Roles: Admin, Member

**Adding Group Expenses:**
- Add expense → assign to a group
- Flexible splits:
  - Equal split
  - Percentage split
  - Exact amount split
  - Item-level split (each person picks line items from a parsed bill)
- Non-member share (assign a portion to "others" / unnamed people)

**Settlement:**
- "Who owes whom" simplified view (minimizes number of transactions)
- Mark as settled (cash, UPI, other)
- Settlement history log
- Automated reminders to group members (optional, user-controlled)

**Group Analytics:**
- Total group spend by category
- Each member's contribution over time
- Most frequent group merchants

---

#### 5.1.6 WhatsApp & Telegram Bot Integration

**Goal:** Let users log expenses, upload bills, and query their finances without ever opening the app — using chat interfaces they already live in.

**Why it matters:** The #1 reason people stop using finance apps is the context-switch friction. Opening an app, waiting for it to load, navigating to "add expense" — it breaks the moment. WhatsApp and Telegram are already open. This feature meets users where they are.

---

**5.1.6.1 Setup & Linking**

- User connects their PUFT account via a one-time link from Settings → "Connect Messaging Bot"
- WhatsApp: links via official WhatsApp Business API (cloud-hosted number)
- Telegram: links via Telegram Bot API (`@PUFTBot`)
- One PUFT account can connect both simultaneously
- Multi-device: same bot works across all devices where the messaging app is installed
- Unlink anytime from Settings

---

**5.1.6.2 Natural Language Expense Entry**

Users simply type a message in plain language. The bot parses intent and extracts structured fields.

**Supported input formats:**

| User Message | What Gets Logged |
|---|---|
| `250 lunch` | ₹250, category: Food, note: lunch |
| `spent 1200 on groceries at DMart` | ₹1200, merchant: DMart, category: Groceries |
| `petrol 800` | ₹800, category: Transport |
| `paid 3500 rent` | ₹3500, category: Housing |
| `coffee 90 yesterday` | ₹90, date: yesterday, category: Food |
| `earned 50000 salary` | ₹50,000 logged as Income |
| `split 1800 dinner 3 ways` | ₹600 logged; prompts to assign group |

**Bot response after logging:**
```
✅ Logged: ₹250 · Food · Lunch
📅 Today · 🏦 Default Account
[Edit] [Delete] [Add Note]
```
Inline buttons allow correction without re-typing.

---

**5.1.6.3 Bill & Receipt Upload via Chat**

- User sends a photo or PDF of a bill directly in the chat
- Bot runs the same AI parsing pipeline as the main app
- Returns a confirmation card with parsed fields:

```
📄 Bill parsed:
🏪 Swiggy · ₹486
📅 26 May 2026
🗂 Food & Dining
[Confirm ✅] [Edit ✏️] [Discard ❌]
```

- User taps **Confirm** → expense saved instantly
- User taps **Edit** → bot sends a guided field-by-field correction flow
- Multi-item bills: bot shows line items in a numbered list; user can confirm all or edit specific lines

---

**5.1.6.4 Query & Report Commands**

Users can ask the bot questions about their finances in plain language or via commands:

| Input | Bot Response |
|---|---|
| `balance` | Current month spend vs. budget summary |
| `how much did I spend today?` | Today's total with category breakdown |
| `this week food` | Food spend this week vs. last week |
| `top 5 expenses this month` | Ranked list |
| `did I pay Netflix?` | Confirms last subscription charge date & amount |
| `how much left in budget?` | Remaining budget per category |
| `summary` | Mini monthly report card |
| `report` | Sends a PDF of the monthly report as a file attachment |

---

**5.1.6.5 Smart Notifications via Bot (Optional)**

Users can opt-in to receive proactive alerts through WhatsApp/Telegram instead of (or in addition to) push notifications:

- Daily spending recap at a user-set time (e.g., 10 PM)
- Budget overspend alert: "⚠️ You've spent ₹4,200 on Food — 84% of your ₹5,000 budget"
- Upcoming bill reminder: "📅 Netflix ₹799 bills tomorrow"
- Weekly summary every Sunday
- Group settlement reminder: "You owe Rahul ₹450 from last Friday's dinner"

User controls frequency and which alert types to receive from Settings → Notification Preferences.

---

**5.1.6.6 Group Expense via Bot**

- User can add a group expense directly from chat: `split 2400 cab 4 ways #goa-trip`
- Bot identifies the group by hashtag/name and logs a split expense
- Other group members (if they have the bot connected) receive a notification in their chat
- Settlement can be confirmed via bot: `paid rahul 600`

---

**5.1.6.7 Security & Privacy**

- Phone number verified at link time via OTP — no one else can access your account through the bot
- All messages processed over encrypted channels (WhatsApp E2E, Telegram MTProto)
- Bot never stores raw chat messages — only the structured transaction extracted from them
- "Lock bot" command: temporarily disable bot access without unlinking (useful if sharing a device)
- Auto-lock after 30 days of inactivity (configurable)

---

**5.1.6.8 Limitations & Edge Cases**

- Bot requires internet connectivity (no offline support for this channel — by design)
- Complex operations (viewing charts, editing past transactions beyond inline buttons) redirect to the app with a deep link
- Rate limit: 100 messages/day per user to prevent abuse
- Unsupported input → bot responds: "I didn't understand that. Try: `amount description` or type `help`"
- `help` command always available → shows a concise command reference card

---

### 5.2 UNIQUE VALUE-ADD FEATURES

---

#### 5.2.1 Subscription Graveyard

Automatically detect all recurring charges across linked accounts and bills. Display:
- Subscription name, amount, billing cycle, last charged date
- "Last used" signal (if app-connected, e.g., Netflix login activity)
- One-tap "cancel reminder" — sets a calendar alert before next billing date
- Estimated annual cost for each

**Why it's useful:** Most users are paying for 3–7 forgotten subscriptions. This feature makes the invisible visible.

---

#### 5.2.2 Financial Time Machine

See a projection of your finances 3, 6, and 12 months out based on:
- Current income + known recurring expenses
- Historical spending patterns
- User-set savings goals

Shows: projected net savings, projected category overspend warnings, goal achievement dates.

**Why it's useful:** Budgets tell you what happened. Time Machine tells you what *will* happen if nothing changes.

---

#### 5.2.3 Smart Merchant Intelligence

When you add a transaction from a known merchant:
- Show your full history with that merchant
- Show your average spend per visit
- "You visit this merchant ~3x/month. Average: ₹450/visit."
- Flag if this transaction is significantly above your average

**Why it's useful:** Context at the point of entry catches errors and spending drift instantly.

---

#### 5.2.4 "Guilt-Free Money" Envelope

User sets a weekly/monthly guilt-free spending budget (fun money, no questions asked). Tracked separately from main budget. Shows:
- Remaining guilt-free balance
- "You have ₹1,200 of guilt-free money left this week — enjoy it."

**Why it's useful:** Removes the psychological punishment loop from budgeting, making users more likely to stick with tracking.

---

#### 5.2.5 Tax Season Mode

Activate during tax filing season to:
- Auto-tag deductible expenses (80C investments, medical, HRA-linked rent, etc.)
- Generate a tax summary PDF categorized by Section
- Export CA-ready income + expense report

**Why it's useful:** Finance apps never connect to tax filing. This bridges the gap without replacing a CA.

---

#### 5.2.6 Bill Price Tracker

When you upload a grocery or utility bill:
- Track item-level prices over time
- Alert when a product's price increases >10% vs. your last purchase
- "Toor dal was ₹120/kg last month. Now ₹155/kg."

**Why it's useful:** Inflation is abstract until it hits your cart. This makes it concrete and actionable.

---

#### 5.2.7 Offline-First Architecture

All core functions (add expense, view analytics, manage groups) work fully offline. Data syncs automatically when connectivity returns. Local-only mode available for privacy-sensitive users.

**Why it's useful:** In India and many markets, network connectivity is intermittent. Finance apps that fail offline lose users.

---

#### 5.2.8 Spending Streak & Habit Tracker

- "You've stayed under budget for 14 days in a row 🔥"
- Daily check-in prompt (optional): "Did you add today's expenses?"
- Weekly spending habit score (0–100) based on consistency of tracking and staying within budget

**Why it's useful:** Behavior change requires positive reinforcement, not just data.

---

## 6. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Bill parse time (clear photo) | < 3 seconds |
| Manual entry to save | < 2 seconds |
| Dashboard load time | < 1.5 seconds |
| Offline capability | 100% core features |
| Data encryption | AES-256 at rest, TLS 1.3 in transit |
| App size (mobile) | < 25 MB |
| Platform support | iOS 16+, Android 10+, Chrome/Safari/Firefox (modern) |
| Accessibility | WCAG 2.1 AA |

---

## 7. Technical Architecture (High-Level)

```
Client (Web / iOS / Android)
    ↓ HTTPS / WebSocket
API Gateway
    ↓
Core Services:
  - Auth Service (JWT + OAuth2)
  - Transaction Service
  - Bill Parser Service (OCR + LLM extraction)
  - Analytics Service
  - Group Service
  - Notification Service
  - Messaging Bot Service (WhatsApp Business API + Telegram Bot API)
    ↓
Storage:
  - PostgreSQL (transactions, users, groups)
  - Redis (session cache, real-time sync)
  - S3-compatible Object Store (bill images, PDFs)
  - Local SQLite (offline mode, mobile)
```

**Key tech choices:**
- **OCR**: Tesseract + custom fine-tuned vision LLM for bill parsing
- **Mobile**: React Native (shared codebase, native performance)
- **Web**: Next.js (SSR for fast initial load, PWA support)
- **Sync**: CRDT-based conflict-free sync for offline → online reconciliation

---

## 8. Data Model (Core Entities)

- **User**: id, name, email, currency_preference, timezone
- **Account**: id, user_id, name, type (bank/wallet/cash/credit), balance
- **Transaction**: id, user_id, account_id, amount, currency, category, merchant, date, tags[], receipt_url, group_id?, recurring_rule?
- **Bill**: id, user_id, raw_file_url, parsed_data (JSON), status (pending/confirmed/failed)
- **Group**: id, name, members[], created_by
- **GroupExpense**: id, group_id, transaction_id, splits[] (member_id, amount, settled_at?)
- **Subscription**: id, user_id, merchant, amount, cycle, next_billing_date, status
- **BotSession**: id, user_id, platform (whatsapp/telegram), phone_or_chat_id, linked_at, locked, last_active

---

## 9. MVP Scope (Phase 1 — 0 to 3 Months)

| Feature | In MVP? |
|---|---|
| Manual expense entry (quick + full) | ✅ |
| Bill upload + AI parsing | ✅ |
| Fast upload (FAB, widget, keyboard shortcut) | ✅ |
| Core analytics dashboard | ✅ |
| Category management | ✅ |
| Groups (basic split + settlement) | ✅ |
| Subscription Graveyard | ✅ |
| Offline mode | ✅ |
| CSV import/export | ✅ |
| Email forwarding for bills | Phase 2 |
| WhatsApp Bot (expense entry + bill upload) | Phase 2 |
| Telegram Bot (expense entry + bill upload) | Phase 2 |
| Bot smart notifications & queries | Phase 3 |
| Financial Time Machine | Phase 2 |
| Tax Season Mode | Phase 2 |
| Bill Price Tracker | Phase 2 |
| Siri / Assistant integration | Phase 2 |

---

## 10. Success Metrics

| Metric | 3-Month Target |
|---|---|
| DAU / MAU ratio | > 40% |
| Avg. transactions logged per active user/week | > 10 |
| Bill parse success rate (auto, no correction) | > 80% |
| Time to log a manual expense (P50) | < 5 seconds |
| D30 retention | > 45% |
| NPS | > 50 |

---

## 11. Open Questions

1. Should the app support UPI auto-import via SMS parsing (Android) or bank statement sync via Account Aggregator (AA framework in India)?
2. Multi-currency handling — primary currency with spot-rate conversion, or full multi-currency ledger?
3. Is local-only (no cloud) a paid feature or free?
4. What is the monetization model? (Freemium with analytics/groups behind paywall, or subscription-only?)
5. Should groups allow non-PUFT users to participate via a web link (no account required)?
6. WhatsApp Business API has per-message costs beyond the free tier — what is the acceptable CAC impact, and should bot access be a paid/Pro feature?

---

*PRD Author: Product Team | Next Review: 2 weeks from creation date*
