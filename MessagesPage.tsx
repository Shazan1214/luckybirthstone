import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
import { api, type Conversation, type Message, type Gemstone } from "@/lib/api";

function BadgeIcon({ badge }: { badge: string }) {
  if (badge === "premium_verified") return <span title="Premium Verified" className="text-amber-500 text-xs">★</span>;
  if (badge === "basic_verified") return <span title="Basic Verified" className="text-green-500 text-xs">✓</span>;
  return null;
}

function OnlineDot({ online }: { online: boolean }) {
  return <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${online ? "bg-green-400" : "bg-slate-300"}`} />;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0`}>
      {name[0].toUpperCase()}
    </div>
  );
}

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
}

/** Compact card shown in the compose area and pinned at top of chat. */
function ListingRefCard({ gem, compact = false }: { gem: Gemstone; compact?: boolean }) {
  const thumb = gem.images?.[0]?.image_url;
  return (
    <Link href={`/listing/${gem.id}`}>
      <div className={`flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl cursor-pointer hover:bg-primary/10 transition-colors ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
        {thumb ? (
          <img src={thumb} alt={gem.stone_type} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border/40" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-lg">💎</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-primary">{gem.stone_type}</span>
            <span className="text-xs text-muted-foreground">{gem.carat} ct</span>
            {gem.color && <span className="text-xs text-muted-foreground">· {gem.color}</span>}
            {gem.clarity && <span className="text-xs text-muted-foreground">/ {gem.clarity}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-semibold text-foreground">{fmt(gem.base_price_usd)}</span>
            {gem.certificate_number && (
              <span className="text-[10px] text-muted-foreground">Cert: {gem.certificate_number}</span>
            )}
            {gem.origin && <span className="text-[10px] text-muted-foreground">· {gem.origin}</span>}
          </div>
        </div>
        <svg className="text-primary shrink-0" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M7 17L17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}

/** Small pill shown on the first message that referenced a listing. */
function ListingPill({ gem }: { gem: Gemstone }) {
  return (
    <Link href={`/listing/${gem.id}`}>
      <div className="inline-flex items-center gap-1.5 bg-primary/8 border border-primary/20 rounded-full px-2.5 py-1 text-xs font-medium text-primary cursor-pointer hover:bg-primary/15 transition-colors mb-1">
        <span>💎</span>
        <span>{gem.stone_type} {gem.carat}ct — {fmt(gem.base_price_usd)}</span>
        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M7 17L17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}

export default function MessagesPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselect = params.get("with");
  const urlListingId = params.get("listing");
  const userId = localStorage.getItem("gw_user_id");
  const emailVerified = localStorage.getItem("gw_email_verified") === "true";
  if (!userId) { navigate("/"); return null; }
  if (!emailVerified) { navigate("/verify-email"); return null; }

  const qc = useQueryClient();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(preselect);
  const [message, setMessage] = useState("");
  const [sendError, setSendError] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Inbox ───────────────────────────────────────────────────────────────
  const { data: inboxData, isLoading: loadingInbox } = useQuery({
    queryKey: ["inbox", userId],
    queryFn: () => api.getInbox(userId),
    refetchInterval: 10_000,
  });

  // ── Conversation thread ─────────────────────────────────────────────────
  const { data: convData, isLoading: loadingConv } = useQuery({
    queryKey: ["conversation", userId, selectedPartnerId],
    queryFn: () => api.getConversation(userId, selectedPartnerId!),
    enabled: !!selectedPartnerId,
    refetchInterval: 5_000,
  });

  const conversations = inboxData?.conversations ?? [];
  const messages = convData?.messages ?? [];
  const selectedConv = conversations.find((c) => c.partner_id === selectedPartnerId);

  // Resolve which listing ID is relevant for the current chat:
  // prefer URL param (fresh contact action), fallback to conv's stored listing_id
  const activeListingId = urlListingId || selectedConv?.listing_id || null;

  // ── Fetch listing details for reference card ────────────────────────────
  const { data: listingGem } = useQuery<Gemstone>({
    queryKey: ["listing", activeListingId],
    queryFn: () => api.getListing(activeListingId!),
    enabled: !!activeListingId,
    staleTime: 60_000,
  });

  // ── Auto-fill message with inquiry template ─────────────────────────────
  // Only fires when the user clicked "Contact Seller" (?listing= param present),
  // NOT when a seller opens the same conversation from their inbox.
  useEffect(() => {
    if (listingGem && selectedPartnerId && !autoFilled && !message && urlListingId) {
      const gradeStr = [listingGem.color, listingGem.clarity].filter(Boolean).join("/");
      const grade = gradeStr ? ` (${gradeStr})` : "";
      const template = `Hi, I'm interested in your ${listingGem.stone_type} ${listingGem.carat}ct${grade} listed at $${listingGem.base_price_usd.toLocaleString()}. Could we discuss the details further?`;
      setMessage(template);
      setAutoFilled(true);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = "auto";
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
          inputRef.current.focus();
          inputRef.current.setSelectionRange(template.length, template.length);
        }
      }, 50);
    }
  }, [listingGem, selectedPartnerId, autoFilled, message]);

  // ── Send ────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: () =>
      api.sendMessage({
        sender_id: userId,
        receiver_id: selectedPartnerId!,
        message_text: message,
        ...(activeListingId && !messages.length ? { listing_id: activeListingId } : {}),
      }),
    onSuccess: () => {
      setMessage("");
      setSendError("");
      qc.invalidateQueries({ queryKey: ["conversation", userId, selectedPartnerId] });
      qc.invalidateQueries({ queryKey: ["inbox", userId] });
    },
    onError: (err: Error) => setSendError(err.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convData?.messages]);

  function selectConv(partnerId: string) {
    setSelectedPartnerId(partnerId);
    setMessage("");
    setSendError("");
    setAutoFilled(false);
  }

  function goBack() {
    setSelectedPartnerId(null);
    setMessage("");
    setSendError("");
    setAutoFilled(false);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !selectedPartnerId || sendMutation.isPending) return;
    sendMutation.mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  // Find the first message in the thread that has listing_id (for the pill)
  const firstListingMsg = messages.find((m) => m.listing_id);

  const chatOpen = !!selectedPartnerId;

  return (
    <main className="max-w-6xl mx-auto px-0 sm:px-6 py-0 sm:py-8">
      {/* Desktop page header */}
      <h1 className="hidden sm:block text-2xl font-bold mb-6 px-0">Messages</h1>

      {/* Mobile page header */}
      {!chatOpen && (
        <div className="sm:hidden flex items-center gap-3 px-4 py-4 border-b border-border bg-white">
          <h1 className="text-xl font-bold">Messages</h1>
        </div>
      )}

      <div
        className="flex bg-white sm:border sm:border-border sm:rounded-2xl sm:shadow-sm overflow-hidden"
        style={{ minHeight: "calc(100vh - 8rem)" }}
      >
        {/* ── Conversation list ──────────────────────────────────────────── */}
        <div
          className={`flex flex-col border-r border-border ${chatOpen ? "hidden sm:flex" : "flex"} w-full sm:w-72 sm:shrink-0`}
        >
          <div className="hidden sm:flex px-4 py-3 border-b border-border items-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversations</p>
          </div>

          {loadingInbox && (
            <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground text-sm">
              <span className="spinner" /> Loading…
            </div>
          )}

          {!loadingInbox && conversations.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3 text-muted-foreground py-20">
              <span className="text-4xl">💬</span>
              <p className="font-medium text-base">No conversations yet</p>
              <p className="text-sm leading-relaxed">Contact a seller from the marketplace to get started.</p>
              <button
                onClick={() => navigate("/marketplace")}
                className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Browse Marketplace
              </button>
            </div>
          )}

          <div className="overflow-y-auto flex-1">
            {conversations.map((conv) => {
              const isSelected = selectedPartnerId === conv.partner_id;
              return (
                <button
                  key={conv.partner_id}
                  onClick={() => selectConv(conv.partner_id)}
                  className={`w-full text-left px-4 py-4 border-b border-border/50 hover:bg-slate-50 active:bg-slate-100 transition-colors ${isSelected ? "bg-primary/5 border-l-[3px] border-l-primary" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <Avatar name={conv.partner_company ?? conv.partner_name} />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white flex items-center justify-center">
                        <OnlineDot online={conv.partner_is_online} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold truncate flex items-center gap-1 ${isSelected ? "text-primary" : ""}`}>
                          {conv.partner_company ?? conv.partner_name}
                          <BadgeIcon badge={conv.partner_verification_badge} />
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {conv.last_message ? timeAgo(conv.last_message.sent_at) : ""}
                        </span>
                      </div>
                      {/* Listing tag in sidebar */}
                      {conv.listing_id && (
                        <div className="flex items-center gap-1 mt-0.5 mb-0.5">
                          <span className="text-[10px] bg-primary/8 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            💎 Gem inquiry
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.last_message
                            ? `${conv.last_message.is_mine ? "You: " : ""}${conv.last_message.text}`
                            : conv.partner_user_type ?? ""}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="shrink-0 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg className="sm:hidden text-muted-foreground shrink-0" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Chat panel ────────────────────────────────────────────────── */}
        <div
          className={`flex-1 flex flex-col min-w-0 ${chatOpen ? "flex" : "hidden sm:flex"} w-full`}
        >
          {!selectedPartnerId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-6">
              <span className="text-5xl">💬</span>
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm text-center max-w-xs">
                Or contact a seller from the{" "}
                <button onClick={() => navigate("/marketplace")} className="text-primary hover:underline">
                  marketplace
                </button>
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-white shrink-0">
                <button
                  onClick={goBack}
                  className="sm:hidden -ml-1 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
                  aria-label="Back to conversations"
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <Avatar name={selectedConv?.partner_company ?? selectedConv?.partner_name ?? "?"} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-1.5 truncate">
                    {selectedConv?.partner_company ?? selectedConv?.partner_name}
                    <BadgeIcon badge={selectedConv?.partner_verification_badge ?? "none"} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <OnlineDot online={selectedConv?.partner_is_online ?? false} />
                    <span>{selectedConv?.partner_is_online ? "Online" : "Offline"}</span>
                    {selectedConv?.partner_user_type && (
                      <span className="hidden sm:inline"> · {selectedConv.partner_user_type}</span>
                    )}
                  </div>
                </div>
                {/* Listing ref badge in header (desktop) */}
                {listingGem && (
                  <Link href={`/listing/${listingGem.id}`}>
                    <div className="hidden sm:flex items-center gap-1.5 bg-primary/8 border border-primary/20 text-primary text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-primary/15 transition-colors shrink-0">
                      <span>💎</span>
                      <span className="truncate max-w-[120px]">{listingGem.stone_type} {listingGem.carat}ct</span>
                    </div>
                  </Link>
                )}
              </div>


              {/* Listing reference card — shown when listing is linked and thread is new/empty */}
              {listingGem && messages.length === 0 && (
                <div className="px-4 pt-4 shrink-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Inquiring about</p>
                  <ListingRefCard gem={listingGem} />
                </div>
              )}

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/50">
                {loadingConv && (
                  <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                    <span className="spinner" /> Loading…
                  </div>
                )}
                {!loadingConv && messages.length === 0 && !listingGem && (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground gap-2">
                    <span className="text-3xl">👋</span>
                    <p className="text-sm font-medium">No messages yet</p>
                    <p className="text-xs">Say hello!</p>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isMine = msg.sender_id === userId;
                  const isFirstWithListing = msg.listing_id && msg.id === firstListingMsg?.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                      {/* Listing pill on first message that references a listing */}
                      {isFirstWithListing && listingGem && (
                        <ListingPill gem={listingGem} />
                      )}
                      {/* Show listing ref card above if this is the first message and we have gem data */}
                      {idx === 0 && msg.listing_id && !listingGem && (
                        <div className="text-[10px] text-muted-foreground bg-primary/5 border border-primary/10 px-2 py-1 rounded-lg mb-1 flex items-center gap-1">
                          <span>💎</span> Gem inquiry
                        </div>
                      )}
                      <div
                        className={`
                          max-w-[80%] sm:max-w-[70%] px-4 py-2.5 text-sm break-words
                          ${isMine
                            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                            : "bg-white text-foreground rounded-2xl rounded-bl-sm border border-border/50 shadow-sm"
                          }
                        `}
                      >
                        <p className="leading-relaxed">{msg.message_text}</p>
                        <p className={`text-[10px] mt-1.5 ${isMine ? "text-primary-foreground/60 text-right" : "text-muted-foreground"}`}>
                          {timeAgo(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Listing ref card above compose — shown when there are existing messages and a listing is linked */}
              {listingGem && messages.length > 0 && (
                <div className="px-4 pt-3 pb-0 shrink-0">
                  <ListingRefCard gem={listingGem} compact />
                </div>
              )}

              {/* Send form */}
              <div className="px-4 py-3 border-t border-border bg-white shrink-0">
                {sendError && (
                  <div className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2 mb-2">
                    {sendError}
                  </div>
                )}
                <form onSubmit={handleSend} className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={listingGem ? `Ask about ${listingGem.stone_type} ${listingGem.carat}ct…` : "Type a message…"}
                    rows={1}
                    className="flex-1 px-4 py-3 rounded-2xl border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition resize-none bg-slate-50 focus:bg-white leading-relaxed"
                    style={{ minHeight: 44, maxHeight: 120 }}
                  />
                  <button
                    type="submit"
                    disabled={sendMutation.isPending || !message.trim()}
                    className="h-11 w-11 flex items-center justify-center bg-primary text-primary-foreground rounded-2xl hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
                    aria-label="Send"
                  >
                    {sendMutation.isPending ? (
                      <span className="spinner w-4 h-4" />
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M22 2L15 22 11 13 2 9l20-7z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </form>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center hidden sm:block">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
