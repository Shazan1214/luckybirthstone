import { useState, useEffect } from "react";
import { Link } from "wouter";
import { GEM_POSTS, GEM_CATEGORIES, getAllGems, type GemPost } from "@/data/gemPosts";
import { fetchGemTerms, searchGemTerms, type GemTerm, GEM_TERM_CATEGORY_LABELS, type GemTermCategory } from "@/lib/api";

const GEM_ICONS: Record<string, string> = {
  Diamond: "💎", Ruby: "❤️", Sapphire: "💙", Emerald: "💚", Alexandrite: "✨",
  Spinel: "🔴", Tanzanite: "🟣", Tourmaline: "🌈", Aquamarine: "🩵",
  Amethyst: "💜", Opal: "🌟", Pearl: "🤍", Garnet: "🍷", Peridot: "🍃",
  Topaz: "🟡", Jade: "🟢", Morganite: "🌸", Phenomenal: "👁️",
};

function PostCard({ post }: { post: GemPost }) {
  return (
    <Link href={`/gems/${post.slug}`}>
      <article className="group bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col h-full">
        <div className="aspect-[16/9] overflow-hidden bg-slate-100 shrink-0">
          <img
            src={post.coverImage}
            alt={post.gem}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>
        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold bg-primary/8 text-primary px-2.5 py-1 rounded-full">
              {GEM_ICONS[post.gem] ?? "💎"} {post.gem}
            </span>
            <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">{post.category}</span>
            <span className="text-xs text-muted-foreground ml-auto">{post.readingMinutes} min read</span>
          </div>
          <h3 className="font-bold text-base leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
            {post.subtitle}
          </p>
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="text-xs font-semibold text-primary group-hover:underline">Read more →</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function TermCard({ term }: { term: GemTerm }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-border rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setExpanded((v) => !v)}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-bold text-base">{term.term}</h3>
          <span className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-full font-medium">
            {GEM_TERM_CATEGORY_LABELS[term.category] ?? term.category}
          </span>
        </div>
        <svg className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
      <p className={`text-sm text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>{term.definition}</p>
      {expanded && (
        <div className="mt-3 space-y-2">
          {term.properties && (
            <div className="text-xs bg-slate-50 rounded-lg p-3 font-mono text-muted-foreground">{term.properties}</div>
          )}
          {term.example && (
            <p className="text-xs text-slate-600 italic border-l-2 border-primary/30 pl-3">{term.example}</p>
          )}
          {term.related_terms && term.related_terms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground">See also:</span>
              {term.related_terms.map((r) => (
                <span key={r} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{r.replace(/-/g, " ")}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GemKnowledgePage() {
  const [pageTab, setPageTab] = useState<"articles" | "terms">("articles");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeGem, setActiveGem] = useState("All");
  const [search, setSearch] = useState("");
  const [apiPosts, setApiPosts] = useState<GemPost[]>([]);

  // Trade Terminology state
  const [termCategory, setTermCategory] = useState<GemTermCategory | "all">("all");
  const [termSearch, setTermSearch] = useState("");
  const [gemTerms, setGemTerms] = useState<GemTerm[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((data: GemPost[]) => setApiPosts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pageTab !== "terms") return;
    setTermsLoading(true);
    const load = termSearch.trim()
      ? searchGemTerms(termSearch)
      : fetchGemTerms(termCategory !== "all" ? termCategory : undefined);
    load.then(setGemTerms).catch(() => {}).finally(() => setTermsLoading(false));
  }, [pageTab, termCategory, termSearch]);

  const apiSlugs = new Set(apiPosts.map((p) => p.slug));
  const allPosts: GemPost[] = [
    ...apiPosts,
    ...GEM_POSTS.filter((p) => !apiSlugs.has(p.slug)),
  ];

  const allGems = ["All", ...Array.from(new Set(allPosts.map((p) => p.gem))).sort()];

  const filtered = allPosts.filter((p) => {
    if (activeCategory !== "All" && p.category !== activeCategory) return false;
    if (activeGem !== "All" && p.gem !== activeGem) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.gem.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Hero */}
      <div className="text-center mb-10 max-w-2xl mx-auto">
        <div className="text-5xl mb-3">📚</div>
        <h1 className="text-3xl font-extrabold mb-3">Gemstone Knowledge Base</h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Expert guides on the world's finest gemstones — origins, quality factors, treatments, rarity and trade insights from industry professionals.
        </p>
      </div>

      {/* Page Tabs */}
      <div className="flex gap-2 justify-center mb-8">
        {(["articles", "terms"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setPageTab(tab)}
            className={`px-5 py-2 rounded-full text-sm font-semibold border transition-colors ${
              pageTab === tab
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "articles" ? "📚 Gem Articles" : "📖 Trade Terminology"}
          </button>
        ))}
      </div>

      {/* ── Trade Terminology Tab ── */}
      {pageTab === "terms" && (
        <div>
          <div className="relative max-w-xl mx-auto mb-6">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              value={termSearch}
              onChange={(e) => setTermSearch(e.target.value)}
              placeholder="Search trade terms, gemstones, treatments…"
              className="form-input pl-10 w-full"
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            <button
              onClick={() => { setTermCategory("all"); setTermSearch(""); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${termCategory === "all" && !termSearch ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border text-muted-foreground hover:text-foreground"}`}
            >
              All Terms
            </button>
            {(Object.keys(GEM_TERM_CATEGORY_LABELS) as GemTermCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => { setTermCategory(cat); setTermSearch(""); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${termCategory === cat && !termSearch ? "bg-slate-800 text-white border-slate-800" : "bg-white border-border text-muted-foreground hover:text-foreground"}`}
              >
                {GEM_TERM_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          {termsLoading ? (
            <div className="text-center py-16 text-muted-foreground">
              <span className="spinner" /> Loading…
            </div>
          ) : gemTerms.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-medium">No terms match your search</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gemTerms.map((term) => (
                <TermCard key={term.id} term={term} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Articles Tab ── */}
      {pageTab === "articles" && (
        <>
      {/* Search bar */}
      <div className="relative max-w-xl mx-auto mb-8">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search gemstones, topics, origins…"
          className="form-input pl-10 w-full"
        />
      </div>

      {/* Gem filter pills */}
      <div className="flex flex-wrap gap-2 mb-5 justify-center">
        {allGems.map((gem) => (
          <button
            key={gem}
            onClick={() => { setActiveGem(gem); setActiveCategory("All"); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${activeGem === gem && activeCategory === "All" ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border text-muted-foreground hover:text-foreground hover:border-slate-300"}`}
          >
            {gem === "All" ? "All Gemstones" : `${GEM_ICONS[gem] ?? "💎"} ${gem}`}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {GEM_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setActiveGem("All"); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${activeCategory === cat && activeGem === "All" ? "bg-slate-800 text-white border-slate-800" : "bg-white border-border text-muted-foreground hover:text-foreground"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-6 text-center">
        {filtered.length} {filtered.length === 1 ? "article" : "articles"}{activeGem !== "All" ? ` about ${activeGem}` : ""}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-medium">No articles match your search</p>
          <button onClick={() => { setSearch(""); setActiveGem("All"); setActiveCategory("All"); }} className="mt-4 text-sm text-primary hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-16 text-center bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-8 max-w-2xl mx-auto">
        <div className="text-3xl mb-3">💎</div>
        <h2 className="font-bold text-lg mb-2">Ready to Trade?</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Browse verified gemstone listings from professional B2B traders, miners and manufacturers worldwide.
        </p>
        <Link href="/marketplace">
          <span className="inline-block px-6 py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity cursor-pointer">
            Browse Marketplace
          </span>
        </Link>
      </div>
      </>
      )}
    </main>
  );
}
