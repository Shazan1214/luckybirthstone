import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { getPostBySlug, getPostsByGem, GEM_POSTS, type GemPost } from "@/data/gemPosts";

const GEM_ICONS: Record<string, string> = {
  Diamond: "💎", Ruby: "❤️", Sapphire: "💙", Emerald: "💚", Alexandrite: "✨",
  Spinel: "🔴", Tanzanite: "🟣", Tourmaline: "🌈", Aquamarine: "🩵",
  Amethyst: "💜", Opal: "🌟", Pearl: "🤍", Garnet: "🍷", Peridot: "🍃",
  Topaz: "🟡", Jade: "🟢", Morganite: "🌸", Phenomenal: "👁️",
};

function ShareButton({ post }: { post: GemPost }) {
  const url = window.location.href;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const handleShare = async () => {
    if (canShare) {
      try { await navigator.share({ title: post.title, text: post.subtitle, url }); return; } catch {}
    }
    navigator.clipboard.writeText(url);
  };
  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
    >
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      Share
    </button>
  );
}

function RelatedCard({ post }: { post: GemPost }) {
  return (
    <Link href={`/gems/${post.slug}`}>
      <div className="group flex gap-3 items-start p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
        <img src={post.coverImage} alt={post.gem} className="w-16 h-12 object-cover rounded-lg shrink-0" loading="lazy" />
        <div>
          <p className="text-xs text-primary font-medium mb-0.5">{GEM_ICONS[post.gem] ?? "💎"} {post.gem}</p>
          <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">{post.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{post.readingMinutes} min read</p>
        </div>
      </div>
    </Link>
  );
}

export default function GemPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [apiPost, setApiPost] = useState<GemPost | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) { setApiPost(null); return; }
    fetch(`/api/posts/${encodeURIComponent(slug)}`)
      .then((r) => r.ok ? r.json() as Promise<GemPost> : Promise.reject())
      .then((data) => setApiPost(data))
      .catch(() => setApiPost(null));
  }, [slug]);

  const staticPost = getPostBySlug(slug ?? "");
  const post: GemPost | undefined = (apiPost ?? staticPost) ?? undefined;

  if (apiPost === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4 animate-pulse">💎</div>
        <p className="text-muted-foreground">Loading article…</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
        <p className="text-muted-foreground mb-6">We couldn't find this knowledge base article.</p>
        <Link href="/gems"><span className="btn-primary cursor-pointer">Back to Knowledge Base</span></Link>
      </div>
    );
  }

  const related = [
    ...getPostsByGem(post.gem).filter((p) => p.slug !== post.slug),
    ...GEM_POSTS.filter((p) => p.category === post.category && p.gem !== post.gem && p.slug !== post.slug),
  ].slice(0, 4);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap">
        <Link href="/marketplace"><span className="hover:text-primary cursor-pointer">Marketplace</span></Link>
        <span>/</span>
        <Link href="/gems"><span className="hover:text-primary cursor-pointer">Gem Guide</span></Link>
        <span>/</span>
        <Link href={`/gems?gem=${post.gem}`}><span className="hover:text-primary cursor-pointer">{post.gem}</span></Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">{post.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main content */}
        <article className="lg:col-span-3">
          {/* Category + gem badge */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-sm font-semibold bg-primary/8 text-primary px-3 py-1 rounded-full">
              {GEM_ICONS[post.gem] ?? "💎"} {post.gem}
            </span>
            <span className="text-xs bg-slate-100 text-muted-foreground px-2.5 py-1 rounded-full">{post.category}</span>
            <span className="text-xs text-muted-foreground ml-auto">{post.readingMinutes} min read</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3">{post.title}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">{post.subtitle}</p>

          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pb-5 border-b border-border mb-6">
            <span>Published {new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
            <ShareButton post={post} />
          </div>

          {/* Hero image */}
          <div className="rounded-2xl overflow-hidden aspect-[21/9] bg-slate-100 mb-8">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Quick facts */}
          {post.facts.length > 0 && (
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5 mb-8">
              <h2 className="font-bold text-base mb-4 flex items-center gap-2">
                <span>⚡</span> Quick Facts
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {post.facts.map((f, i) => (
                  <div key={i} className="flex flex-col">
                    <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{f.label}</dt>
                    <dd className="text-sm font-medium text-foreground mt-0.5">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Article sections */}
          <div className="prose-custom space-y-8">
            {post.sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-xl font-bold mb-3 text-foreground flex items-start gap-2">
                  <span className="text-primary shrink-0 mt-0.5">●</span>
                  {section.heading}
                </h2>
                <p className="text-base text-foreground/80 leading-relaxed">{section.body}</p>
              </section>
            ))}
          </div>

          {/* Tags */}
          <div className="mt-10 pt-6 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Topics</p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Link key={tag} href={`/gems?q=${tag}`}>
                  <span className="text-xs bg-slate-100 hover:bg-slate-200 text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-full cursor-pointer transition-colors">
                    #{tag}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-10 bg-slate-50 border border-border rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">{GEM_ICONS[post.gem] ?? "💎"}</div>
            <h3 className="font-bold text-base mb-1">Looking for {post.gem}?</h3>
            <p className="text-sm text-muted-foreground mb-4">Browse verified {post.gem.toLowerCase()} listings from professional B2B traders worldwide.</p>
            <Link href={`/marketplace?gem=${post.gem.toLowerCase()}`}>
              <span className="inline-block px-5 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity cursor-pointer">
                Browse {post.gem} Listings
              </span>
            </Link>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            {/* Table of contents */}
            <div className="bg-white border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">In This Article</p>
              <ol className="space-y-2">
                {post.sections.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span className="text-primary font-bold shrink-0 text-xs mt-0.5">{i + 1}.</span>
                    <span className="line-clamp-2 leading-snug">{s.heading}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Related articles */}
            {related.length > 0 && (
              <div className="bg-white border border-border rounded-2xl p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Related Articles</p>
                <div className="space-y-1">
                  {related.map((r) => (
                    <RelatedCard key={r.slug} post={r} />
                  ))}
                </div>
              </div>
            )}

            {/* All gems link */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold mb-1">Explore All Gems</p>
              <p className="text-xs text-muted-foreground mb-3">30+ expert articles on the world's finest gemstones.</p>
              <Link href="/gems">
                <span className="text-sm font-semibold text-primary hover:underline cursor-pointer">View Knowledge Base →</span>
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
