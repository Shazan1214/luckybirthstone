# LuckyBirthstone — B2B Gemstone Marketplace

## Overview
LuckyBirthstone is a B2B gemstone trading network designed to connect verified traders, miners, manufacturers, and retailers globally. It operates with a zero-commission model on transactions. The platform includes a public marketplace for browsing listings, secure B2B profiles, a messaging system, and an admin portal for managing users, listings, and subscriptions. Key features include multi-image/video galleries for listings, a referral system, and a gem auction system. The project's vision is to be the leading professional network for gemstone trading.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
- **Public Pages**: `/contact`, `/privacy`, `/terms`, `/marketplace-policy`, `/marketplace` (read-only without login).
- **Footer**: Consistent across all main app pages, linking to key information.
- **Admin Portal**: Separate interface at `/admin` with a 13-tab sidebar for comprehensive management.
- **Image Gallery**: Displays images and videos (`<video autoPlay muted loop>`) with thumbnail previews and video indicators.
- **Gem Auctions**: Features a `CountdownTimer` component with color-coded urgency and social sharing options.
- **Payment Flow**: Utilizes a PaymentModal that integrates with Razorpay's native popup for various payment methods.

### Technical Implementations
- **Monorepo**: pnpm workspaces for managing multiple packages.
- **Backend**: Node.js 24, Express 5 API with in-memory storage (persisted to GCS).
- **Frontend**: React, Vite, TailwindCSS, Wouter router, TanStack Query.
- **Language**: TypeScript 5.9.
- **File Uploads**: Uses Replit Object Storage via presigned URLs for images and videos.
- **API Endpoints**: Structured for Auth, Profile, Inventory, Messaging, Transactions, Verification, Referrals, Auctions, Platform Payments, Connections, Credits, Deals, Disputes, Activities, and Gem Knowledge.
- **User Model**: Differentiates user types (`b2b_trader`, `retailer`, `miner`, `manufacturer`) with `email_verified`, `verification_status`, `subscription_plan`, `credits`, and `preferred_language` fields.
- **Referral System**: Generates unique referral codes, tracks referrals, and awards listing credits.
- **Gem Auctions System**: Supports creation, bidding, and auto-ending of auctions with seller and plan-based limitations.
- **Send on Approval**: Dashboard listing cards include a teal "🤝 Send on Approval" button that opens a modal. The modal lets the seller pick a CRM contact, set an approval duration (3/7/14/30 days), and customize a message. On submit: enables `approval_enabled` on the listing, creates a CRM deal in the "Proposal" stage linked to the contact and listing, and generates a WhatsApp deep-link if the contact has a phone number.
- **Deal Form Enhancements**: The CRM Deal modal now includes a Contact picker and a Listing picker. Selecting a listing auto-fills the deal title (stone_type + carat), deal value, and currency. The Contacts tab has a green "+ Deal" button per row that switches to the Deals tab and opens the Add Deal modal pre-filled with that contact.
- **Monetization**: Implements verification tiers, subscription plans, and boost packs.
- **Pricing**: Includes a rule-based market price engine for 22 stone types and Rapaport lookup for diamonds.
- **Internationalization**: 8-language system (en, hi, th, ar, ru, fa, ur, zh) via `i18n.ts` + `useI18n.ts` hook; RTL support for Arabic, Farsi, Urdu; language saved to localStorage `gw_lang` on login/profile save. Single footer language selector in `App.tsx` only. `MarketplacePage`, `ListingPage`, `AuthPage` fully wired with `useI18n()` + gem term translations (`translateStoneType`, `translateOrigin`, `translateTreatment` from `gemTerms.ts`).
- **WhatsApp Contact Button**: `CompanyPage` shows WhatsApp button based on whether seller has a phone number (regardless of `whatsapp_opt_in` flag). `formatWaNumber()` helper converts local-format numbers (leading `0`) to international format using per-country calling codes (supports Thailand, India, China, Myanmar, etc.).
- **AstroBotWidget**: Floating button is draggable via pointer events — users can move the widget anywhere on screen. Drag detection threshold of 5px prevents accidental drags from blocking click-to-open.
- **Trade Hub (Phases 4–7, 10)**: Connections system, Credit wallet (50 starter credits, deal earn/spend), Deal proposals/tracking, Activity feed, all on user ProfilePage with tabbed UI.
- **Disputes System (Phase 7)**: Users file disputes on deals; Admin resolves via Disputes tab in admin panel with status filter + resolution modal.
- **Gem Knowledge (Phase 16)**: 50+ gem trade terms organized by category (gemstone/quality/treatment/trade/grading/cut/origin); searchable `/api/gem-knowledge/terms` endpoint; Terms tab on GemKnowledgePage.
- **Trust Score**: Formula: deals×5×0.30 + paymentRate×0.30 + endorsements×10×0.20 + profileCompleteness×0.10 + responseRate×0.10 − disputes×20 − delayed×10, clamped 0–100.
- **Trade Manager CRM (Module 10, Pro+)**: Full CRM at `/trade-manager` with 9 tabs: My Store, Analytics, Contacts, Sales, Approvals, Receivables, Payables, Invoices, Payments. Plan gate (pro/premium) via profile API fetch using `gw_user_id`. Auth: `useCurrentUser()` hook reads `gw_user_id` from localStorage and fetches profile for plan check.
- **Invoicing (Module 10 - Enhanced)**: `TradeInvoice` has `contact_id` (links to CRM contact) + `status: "cancelled"`. Invoices support full create/edit (only when not paid), cancel (any unpaid), and delete. PDF generation via print-to-new-window with styled HTML. The invoice list uses mobile card layout (sm+ shows table). Contact picker auto-fills buyer details from CRM. Invoices linked to a contact appear under that contact's detail panel in the Contacts tab.
- **Module 11 — Sales Ledger (Receivables)**: `POST /api/sales-ledger`, payment tracking via `POST /api/sales-ledger/:id/payments`, WhatsApp/email reminders, summary endpoint. Shared `ledgerPayments` store with Payables.
- **Module 12 — Payables Ledger**: `POST /api/payables-ledger`, payment tracking, supplier notifications, summary endpoint. Imports `ledgerPayments` from sales-ledger.ts.
- **Module 13 — External Contact Support**: `TradeContact` type has `type: buyer|supplier|partner`, `source: platform|external`, `is_platform_user`, `platform_user_id`. ContactsTab shows Platform User/External Contact badges, invite modal with WhatsApp link + email delivery. Invite endpoint: `POST /api/trade-crm/invite`.

### Feature Specifications
- **Multi-media Listings**: Up to 10 images/videos per listing.
- **Secure B2B Profiles**: Email verification and messaging with zero-commission.
- **Location-aware Search**: `/api/inventory/search` uses Haversine formula to sort sellers by distance.
- **Admin Actions**: Approve/reject verifications, manage user plans, extend subscriptions, approve/remove/feature listings, send reminders, trigger automation.
- **Payment Processing**: Razorpay integration for real-time payments, supporting USD to INR conversion.
- **Data Persistence**: All critical data (`users.json`, `inventory.json`, `messages.json`, etc.) is persisted to Google Cloud Storage (GCS) and periodically backed up.

## External Dependencies
- **Replit Object Storage**: For storing media files (images, videos).
- **Google Cloud Storage (GCS)**: For all critical data persistence (`users.json`, `inventory.json`, `messages.json`, `support_tickets.json`, `ticket_responses.json`, `transactions.json`, `sales.json`, `auctions.json`, `bids.json`, `platform_payments.json`, `referrals.json`).
- **Razorpay**: For payment gateway processing in live mode, handling verification tiers, subscriptions, and boost pack purchases.