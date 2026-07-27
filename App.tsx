import { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { api, fetchPendingConnections, acceptConnection, rejectConnection, type Connection, type ApprovalRequest } from "@/lib/api";
import AuthPage from "@/pages/AuthPage";
import MarketplacePage from "@/pages/MarketplacePage";
import DashboardPage from "@/pages/DashboardPage";
import TransactionPage from "@/pages/TransactionPage";
import MessagesPage from "@/pages/MessagesPage";
import ProfilePage from "@/pages/ProfilePage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import AdminPage from "@/pages/AdminPage";
import SalesPage from "@/pages/SalesPage";
import ContactPage from "@/pages/ContactPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsPage from "@/pages/TermsPage";
import MarketplacePolicyPage from "@/pages/MarketplacePolicyPage";
import CompanyPage from "@/pages/CompanyPage";
import StorePage from "@/pages/StorePage";
import ListingPage from "@/pages/ListingPage";
import GemKnowledgePage from "@/pages/GemKnowledgePage";
import GemPostPage from "@/pages/GemPostPage";
import PlansPage from "@/pages/PlansPage";
import UpgradePlanPage from "@/pages/UpgradePlanPage";
import VerificationUpgradePage from "@/pages/VerificationUpgradePage";
import AstroBotPage from "@/pages/AstroBotPage";
import GemAuctionsPage from "@/pages/GemAuctionsPage";
import GemAuctionDetailPage from "@/pages/GemAuctionDetailPage";
import TradeManagerPage from "@/pages/TradeManagerPage";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } });

// ─── Notification Bell ────────────────────────────────────────────────────────
function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  // ── Seen-IDs: persisted per user in localStorage ──────────────────────────
  const storageKey = `gw_seen_notifs_${userId}`;
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  // Snapshot of unseen count captured when panel opens (so "X new" stays visible while panel is open)
  const [openSnapshotCount, setOpenSnapshotCount] = useState(0);

  function markSeen(ids: string[]) {
    setSeenIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const { data: pendingConnections = [] } = useQuery<Connection[]>({
    queryKey: ["pending-connections", userId],
    queryFn: () => fetchPendingConnections(userId),
    refetchInterval: 30_000,
    enabled: !!userId,
  });

  const { data: incomingApprovals = [] } = useQuery<ApprovalRequest[]>({
    queryKey: ["incoming-approvals-bell", userId],
    queryFn: () => api.getIncomingApprovals(userId),
    refetchInterval: 30_000,
    enabled: !!userId,
  });

  const { data: msgCountData } = useQuery<{ user_id: string; total_inquiries: number; unread: number }>({
    queryKey: ["unread-message-count", userId],
    queryFn: () => api.getInquiryCount(userId),
    refetchInterval: 30_000,
    enabled: !!userId,
  });
  const unreadMessages = msgCountData?.unread ?? 0;

  const pendingApprovals = incomingApprovals.filter((a) => a.status === "pending" || a.status === "in_approval");

  // Badge count: unseen approvals/connections + server-side unread messages
  const unseenConnections = pendingConnections.filter((c) => !seenIds.has(c.id));
  const unseenApprovals = pendingApprovals.filter((a) => !seenIds.has(a.id));
  const totalUnseenCount = unseenConnections.length + unseenApprovals.length + unreadMessages;

  const acceptMut = useMutation({
    mutationFn: (connId: string) => acceptConnection(connId, userId),
    onSuccess: (_, connId) => {
      markSeen([connId]);
      qc.invalidateQueries({ queryKey: ["pending-connections", userId] });
    },
  });
  const rejectMut = useMutation({
    mutationFn: (connId: string) => rejectConnection(connId, userId),
    onSuccess: (_, connId) => {
      markSeen([connId]);
      qc.invalidateQueries({ queryKey: ["pending-connections", userId] });
    },
  });

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function openPanel() {
    // Snapshot unseen count (including unread messages) before marking approvals/connections as seen
    const allIds = [
      ...pendingConnections.map((c) => c.id),
      ...pendingApprovals.map((a) => a.id),
    ];
    setOpenSnapshotCount(totalUnseenCount);
    if (allIds.length > 0) markSeen(allIds);
    setOpen(true);
  }

  function handleApprovalClick(id: string) {
    markSeen([id]);
    setOpen(false);
    navigate("/approvals");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => open ? setOpen(false) : openPanel()}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {totalUnseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {totalUnseenCount > 99 ? "99+" : totalUnseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-bold text-slate-800">Notifications</p>
            {openSnapshotCount > 0 && (
              <span className="text-[11px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">{openSnapshotCount} new</span>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {/* Connection / Network Requests */}
            {pendingConnections.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-2 bg-slate-50">Network Requests</p>
                {pendingConnections.map((conn) => (
                  <div key={conn.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                      {(conn.other_name ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{conn.other_name ?? "Unknown"}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Wants to connect with you</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => acceptMut.mutate(conn.id)}
                          disabled={acceptMut.isPending}
                          className="flex-1 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-60"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => rejectMut.mutate(conn.id)}
                          disabled={rejectMut.isPending}
                          className="flex-1 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unread Messages */}
            {unreadMessages > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-2 bg-slate-50">Messages</p>
                <div
                  className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => { setOpen(false); navigate("/messages"); }}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                      {unreadMessages} unread {unreadMessages === 1 ? "message" : "messages"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">You have new messages waiting</p>
                    <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">Open Messages →</span>
                  </div>
                </div>
              </div>
            )}

            {/* Approval Requests */}
            {pendingApprovals.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 py-2 bg-slate-50">Approval Requests</p>
                {pendingApprovals.map((req) => {
                  const ls = req.listing_snapshot;
                  const label = ls ? `${ls.carat}ct ${ls.stone_type}` : "A stone";
                  return (
                    <div
                      key={req.id}
                      className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => handleApprovalClick(req.id)}
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{label} approval request</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {req.status === "in_approval" ? "Currently in your hands" : "Awaiting your action"}
                        </p>
                        <span className="text-[10px] text-primary font-semibold mt-1 block">View in Approvals →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pendingConnections.length === 0 && pendingApprovals.length === 0 && unreadMessages === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-sm font-semibold text-slate-600">You're all caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">No pending requests at the moment.</p>
              </div>
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5 bg-slate-50">
            <button
              onClick={() => { setOpen(false); navigate("/business-manager"); }}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Open Business Manager →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Nav() {
  const [loc, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const userId = localStorage.getItem("gw_user_id") ?? "";
  const loggedIn = !!userId;
  const emailVerified = localStorage.getItem("gw_email_verified") === "true";
  async function logout() {
    const id = localStorage.getItem("gw_user_id");
    if (id) {
      try { await api.logout(id); } catch {}
    }
    localStorage.removeItem("gw_user_id");
    localStorage.removeItem("gw_email_verified");
    localStorage.removeItem("gw_verify_email");
    localStorage.removeItem("gw_verify_code");
    localStorage.removeItem("gw_lang");
    document.documentElement.removeAttribute("dir");
    setMenuOpen(false);
    navigate("/");
  }

  const navLink = (href: string, label: string, mobile = false) => (
    <Link href={href} onClick={() => setMenuOpen(false)}>
      <span className={`${mobile ? "block w-full px-4 py-3 text-base" : "px-3 py-1.5 text-sm"} rounded-md font-medium cursor-pointer transition-colors ${loc === href || loc.startsWith(href + "/") ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
        {label}
      </span>
    </Link>
  );

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href={loggedIn ? "/marketplace" : "/"}>
          <span className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight cursor-pointer">
            <span className="text-2xl">💎</span> LuckyBirthstone
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {navLink("/marketplace", "Marketplace")}
          {loggedIn && navLink("/business-manager", "My Business")}
          {loggedIn && emailVerified && navLink("/messages", "Messages")}
          {loggedIn && emailVerified && navLink("/profile", "Profile")}
          {loggedIn && <NotificationBell userId={userId} />}
          {loggedIn && (
            <button
              onClick={logout}
              className="ml-1 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Logout
            </button>
          )}
          {!loggedIn && loc !== "/" && (
            <Link href="/">
              <span className="ml-3 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 cursor-pointer transition-opacity">
                Login
              </span>
            </Link>
          )}
        </div>

        {/* Mobile right side */}
        <div className="flex sm:hidden items-center gap-2">
          {loggedIn && <NotificationBell userId={userId} />}
          {!loggedIn && loc !== "/" && (
            <Link href="/">
              <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground cursor-pointer">
                Sign in
              </span>
            </Link>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-white shadow-lg">
          <div className="px-2 py-2 space-y-0.5">
            {navLink("/marketplace", "Marketplace", true)}
            {loggedIn && navLink("/business-manager", "My Business", true)}
            {loggedIn && emailVerified && navLink("/messages", "Messages", true)}
            {loggedIn && emailVerified && navLink("/profile", "Profile", true)}
            {loggedIn && (
              <button
                onClick={logout}
                className="block w-full text-left px-4 py-3 text-base rounded-md font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 font-bold text-base text-primary mb-3">
              <span className="text-xl">💎</span> LuckyBirthstone
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Zero-commission B2B gemstone marketplace. Connect verified traders, miners, and manufacturers globally.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Company</p>
            <ul className="space-y-2">
              <li>
                <Link href="/contact">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">Contact Us</span>
                </Link>
              </li>
              <li>
                <Link href="/marketplace">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">Marketplace</span>
                </Link>
              </li>
              <li>
                <Link href="/plans">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">Plans & Pricing</span>
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Learn</p>
            <ul className="space-y-2">
              <li>
                <Link href="/gems">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">📚 Gem Guide</span>
                </Link>
              </li>
              <li>
                <Link href="/gems/diamond-4cs-quality-guide">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">Diamond 4Cs</span>
                </Link>
              </li>
              <li>
                <Link href="/gems/burmese-ruby-guide">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">Ruby Guide</span>
                </Link>
              </li>
              <li>
                <Link href="/gems/colombian-emerald-guide">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">Emerald Guide</span>
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Legal</p>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link href="/terms">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">Terms & Conditions</span>
                </Link>
              </li>
              <li>
                <Link href="/marketplace-policy">
                  <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors">Marketplace Policy</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} LuckyBirthstone. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium">Follow us</span>
              <a href="https://www.instagram.com/luckybirthstone_com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-muted-foreground hover:text-pink-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://www.facebook.com/share/1LC8jUYXJb/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-muted-foreground hover:text-blue-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              B2B Gemstone Marketplace · 0% Commission
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ScrollToTop() {
  const [loc] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [loc]);
  return null;
}

function MainApp() {
  const [loc] = useLocation();
  const isAuthPage = loc === "/";
  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      {!isAuthPage && <Nav />}
      <div className="flex-1">
        <Switch>
          <Route path="/" component={AuthPage} />
          <Route path="/marketplace" component={MarketplacePage} />
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/transaction/:gemId" component={TransactionPage} />
          <Route path="/messages" component={MessagesPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/verify-email" component={VerifyEmailPage} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/privacy" component={PrivacyPolicyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/marketplace-policy" component={MarketplacePolicyPage} />
          <Route path="/company/:id" component={CompanyPage} />
          <Route path="/store/:slug" component={StorePage} />
          <Route path="/listing/:id" component={ListingPage} />
          <Route path="/plans" component={PlansPage} />
          <Route path="/upgrade-plan" component={UpgradePlanPage} />
          <Route path="/verification-upgrade" component={VerificationUpgradePage} />
          <Route path="/astrobot" component={AstroBotPage} />
          <Route path="/gem-auctions/:id" component={GemAuctionDetailPage} />
          <Route path="/gem-auctions" component={GemAuctionsPage} />
          <Route path="/gems/:slug" component={GemPostPage} />
          <Route path="/gems" component={GemKnowledgePage} />
          <Route path="/approvals">{() => { window.location.replace(import.meta.env.BASE_URL.replace(/\/$/, "") + "/business-manager"); return null; }}</Route>
          <Route path="/trade-manager">{() => { window.location.replace(import.meta.env.BASE_URL.replace(/\/$/, "") + "/business-manager"); return null; }}</Route>
          <Route path="/business-manager" component={TradeManagerPage} />
          <Route>
            <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
              Page not found
            </div>
          </Route>
        </Switch>
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Switch>
          <Route path="/admin" component={AdminPage} />
          <Route path="/sales-agent" component={SalesPage} />
          <Route component={MainApp} />
        </Switch>
      </WouterRouter>
      <SpeedInsights />
    </QueryClientProvider>
  );
}

export default App;
