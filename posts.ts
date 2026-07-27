import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { users } from "./users.js";
import { loadPersistedPosts, savePosts } from "../lib/persist.js";
import { logger } from "../lib/logger.js";

export interface ApiPost {
  slug: string;
  gem: string;
  category: string;
  title: string;
  subtitle: string;
  coverImage: string;
  seoDescription: string;
  readingMinutes: number;
  publishedAt: string;
  facts: { label: string; value: string }[];
  sections: { heading: string; body: string }[];
  tags: string[];
  updatedAt?: string;
}

export let apiPosts: ApiPost[] = [];

export async function initPosts(): Promise<void> {
  const data = await loadPersistedPosts();
  apiPosts = data as ApiPost[];
  logger.info({ count: apiPosts.length }, "posts: initialized");
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminId = req.headers["x-admin-id"] as string | undefined;
  if (!adminId) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  const admin = users.find((u) => u.id === adminId);
  if (!admin || !admin.is_admin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

const router: IRouter = Router();

router.get("/posts", (_req, res) => {
  res.json(apiPosts);
});

router.get("/posts/:slug", (req, res) => {
  const post = apiPosts.find((p) => p.slug === req.params["slug"]);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(post);
});

router.post("/admin/posts", requireAdmin, (req, res) => {
  const body = req.body as Partial<ApiPost>;
  if (!body.slug || !body.title) {
    res.status(400).json({ error: "slug and title are required" });
    return;
  }
  const exists = apiPosts.find((p) => p.slug === body.slug);
  if (exists) {
    res.status(409).json({ error: "A post with this slug already exists. Use PUT to update." });
    return;
  }
  const post: ApiPost = {
    slug: body.slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    gem: body.gem ?? "Other",
    category: body.category ?? "Industry Insights",
    title: body.title,
    subtitle: body.subtitle ?? "",
    coverImage: body.coverImage ?? "",
    seoDescription: body.seoDescription ?? "",
    readingMinutes: typeof body.readingMinutes === "number" ? body.readingMinutes : 5,
    publishedAt: body.publishedAt ?? new Date().toISOString().split("T")[0],
    facts: Array.isArray(body.facts) ? body.facts : [],
    sections: Array.isArray(body.sections) ? body.sections : [],
    tags: Array.isArray(body.tags) ? body.tags : [],
    updatedAt: new Date().toISOString(),
  };
  apiPosts.push(post);
  savePosts(apiPosts);
  res.status(201).json(post);
});

router.put("/admin/posts/:slug", requireAdmin, (req, res) => {
  const idx = apiPosts.findIndex((p) => p.slug === req.params["slug"]);
  if (idx === -1) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const body = req.body as Partial<ApiPost>;
  const post = apiPosts[idx]!;
  if (body.gem !== undefined) post.gem = body.gem;
  if (body.category !== undefined) post.category = body.category;
  if (body.title !== undefined) post.title = body.title;
  if (body.subtitle !== undefined) post.subtitle = body.subtitle;
  if (body.coverImage !== undefined) post.coverImage = body.coverImage;
  if (body.seoDescription !== undefined) post.seoDescription = body.seoDescription;
  if (body.readingMinutes !== undefined) post.readingMinutes = body.readingMinutes;
  if (body.publishedAt !== undefined) post.publishedAt = body.publishedAt;
  if (body.facts !== undefined) post.facts = body.facts;
  if (body.sections !== undefined) post.sections = body.sections;
  if (body.tags !== undefined) post.tags = body.tags;
  post.updatedAt = new Date().toISOString();
  savePosts(apiPosts);
  res.json(post);
});

router.delete("/admin/posts/:slug", requireAdmin, (req, res) => {
  const idx = apiPosts.findIndex((p) => p.slug === req.params["slug"]);
  if (idx === -1) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const deleted = apiPosts.splice(idx, 1)[0]!;
  savePosts(apiPosts);
  res.json({ success: true, slug: deleted.slug });
});

export default router;
