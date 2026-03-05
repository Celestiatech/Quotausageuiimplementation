import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  BookOpen,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Save,
  Trash2,
} from "lucide-react";
import ReactQuill from "react-quill-new";
import { slugifyBlogTitle, stripHtmlToText } from "src/lib/blog";

type BlogStatus = "draft" | "published";
type BlogFilter = "all" | BlogStatus;

type BlogSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  status: BlogStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

type BlogDetail = BlogSummary & {
  contentHtml: string;
  keywordsJson?: unknown;
};

type BlogForm = {
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  contentHtml: string;
  keywords: string;
  status: BlogStatus;
};

const EMPTY_FORM: BlogForm = {
  title: "",
  slug: "",
  excerpt: "",
  coverImage: "",
  contentHtml: "<p></p>",
  keywords: "",
  status: "draft",
};

function keywordsFromJson(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((v) => String(v || "").trim()).filter(Boolean).join(", ");
}

function parseKeywordsInput(value: string) {
  return String(value || "")
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export default function AdminBlogs() {
  const [posts, setPosts] = useState<BlogSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BlogFilter>("all");
  const [form, setForm] = useState<BlogForm>(EMPTY_FORM);
  const [slugDirty, setSlugDirty] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedId) || null,
    [posts, selectedId],
  );

  const postStats = useMemo(
    () => ({
      total: posts.length,
      published: posts.filter((post) => post.status === "published").length,
      draft: posts.filter((post) => post.status === "draft").length,
    }),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesStatus = statusFilter === "all" ? true : post.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        String(post.title || "").toLowerCase().includes(q) ||
        String(post.slug || "").toLowerCase().includes(q) ||
        String(post.excerpt || "").toLowerCase().includes(q)
      );
    });
  }, [posts, searchQuery, statusFilter]);

  const applyDetailToForm = (post: BlogDetail) => {
    setForm({
      title: post.title || "",
      slug: post.slug || "",
      excerpt: post.excerpt || "",
      coverImage: post.coverImage || "",
      contentHtml: post.contentHtml || "<p></p>",
      keywords: keywordsFromJson(post.keywordsJson),
      status: post.status || "draft",
    });
    setSlugDirty(true);
  };

  const loadPosts = async (pickFirst = false) => {
    try {
      setLoadingList(true);
      setError("");
      const res = await fetch("/api/admin/blogs?limit=200", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to load blog posts");
      const nextPosts = Array.isArray(data?.data?.posts) ? (data.data.posts as BlogSummary[]) : [];
      setPosts(nextPosts);
      if (pickFirst && nextPosts.length > 0) {
        setSelectedId(nextPosts[0].id);
      } else if (selectedId && !nextPosts.find((post) => post.id === selectedId)) {
        setSelectedId(nextPosts[0]?.id || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load blog posts");
    } finally {
      setLoadingList(false);
    }
  };

  const loadPost = async (id: string) => {
    try {
      setLoadingDetail(true);
      setError("");
      const res = await fetch(`/api/admin/blogs/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to load blog post");
      const post = data?.data?.post as BlogDetail;
      if (post) applyDetailToForm(post);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load blog post");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    void loadPosts(true);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadPost(selectedId);
  }, [selectedId]);

  const onCreateNew = () => {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setSlugDirty(false);
    setError("");
    setMessage("Creating a new blog post.");
  };

  const onTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugDirty ? prev.slug : slugifyBlogTitle(value),
    }));
  };

  const onSave = async () => {
    const plainText = stripHtmlToText(form.contentHtml);
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!plainText) {
      setError("Content is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        excerpt: form.excerpt.trim(),
        coverImage: form.coverImage.trim(),
        contentHtml: form.contentHtml,
        keywords: parseKeywordsInput(form.keywords),
        status: form.status,
      };
      const isEdit = Boolean(selectedId);
      const endpoint = isEdit ? `/api/admin/blogs/${selectedId}` : "/api/admin/blogs";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to save blog post");
      const savedPostId = data?.data?.post?.id as string | undefined;
      await loadPosts(false);
      if (savedPostId) {
        setSelectedId(savedPostId);
      }
      setMessage(isEdit ? "Blog post updated." : "Blog post created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save blog post");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm("Delete this blog post? This cannot be undone.")) return;
    try {
      setDeleting(true);
      setError("");
      setMessage("");
      const res = await fetch(`/api/admin/blogs/${selectedId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to delete blog post");
      setMessage("Blog post deleted.");
      setSelectedId(null);
      setForm(EMPTY_FORM);
      setSlugDirty(false);
      await loadPosts(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete blog post");
    } finally {
      setDeleting(false);
    }
  };

  const previewUrl = form.slug.trim() ? `/blog/${form.slug.trim()}` : "";
  const plainContentLength = stripHtmlToText(form.contentHtml).length;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Blog Management</h1>
          <p className="text-gray-600">Create and publish blog posts from admin panel.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCreateNew}
            className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
          <button
            onClick={() => void loadPosts(false)}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </motion.div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total Posts</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{postStats.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-emerald-700">Published</div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{postStats.published}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-amber-700">Draft</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{postStats.draft}</div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-gray-700">Posts</div>
              <div className="text-xs text-gray-500">{filteredPosts.length} result(s)</div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, slug, excerpt..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "published", "draft"] as BlogFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    statusFilter === filter
                      ? "border-purple-300 bg-purple-100 text-purple-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[780px] overflow-y-auto divide-y divide-gray-100">
            {loadingList ? (
              <div className="p-4 text-sm text-gray-500">Loading posts...</div>
            ) : filteredPosts.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No blog posts yet.</div>
            ) : (
              filteredPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => setSelectedId(post.id)}
                  className={`w-full text-left p-4 transition-colors border-l-2 ${
                    selectedId === post.id
                      ? "bg-purple-50 border-purple-400"
                      : "hover:bg-gray-50 border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900 line-clamp-2">{post.title}</div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                        post.status === "published"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-amber-100 text-amber-700 border-amber-200"
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>
                  {post.excerpt ? (
                    <div className="text-xs text-gray-600 mt-1.5 line-clamp-2">{post.excerpt}</div>
                  ) : null}
                  <div className="text-xs text-gray-500 mt-1">/{post.slug}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center justify-between gap-2">
                    <span>Updated {new Date(post.updatedAt).toLocaleDateString()}</span>
                    {post.publishedAt ? <span>Published {new Date(post.publishedAt).toLocaleDateString()}</span> : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 space-y-5">
          {loadingDetail ? <div className="text-sm text-gray-500">Loading post details...</div> : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
              <BookOpen className="w-4 h-4" />
              {selectedPost ? "Edit Blog Post" : "Create Blog Post"}
            </div>
            <div className="flex gap-2">
              {previewUrl ? (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview
                </a>
              ) : null}
              {selectedId ? (
                <button
                  onClick={() => void onDelete()}
                  disabled={deleting || saving}
                  className="px-3 py-2 text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50">
              Slug: /{form.slug || "your-post-slug"}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full border font-semibold ${
                form.status === "published"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {form.status}
            </span>
            <span className="px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700">
              Content: {plainContentLength} chars
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
              <input
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Blog title"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugDirty(true);
                  setForm((prev) => ({ ...prev, slug: slugifyBlogTitle(e.target.value) }));
                }}
                placeholder="blog-post-slug"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as BlogStatus }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none bg-white"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cover Image URL</label>
              <input
                value={form.coverImage}
                onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Excerpt</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value.slice(0, 400) }))}
              placeholder="Short description for blog cards and SEO snippets."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Keywords</label>
            <input
              value={form.keywords}
              onChange={(e) => setForm((prev) => ({ ...prev, keywords: e.target.value }))}
              placeholder="keyword one, keyword two, keyword three"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none"
            />
          </div>

          <div className="admin-blog-editor">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Content</label>
            <ReactQuill
              theme="snow"
              value={form.contentHtml}
              onChange={(value) => setForm((prev) => ({ ...prev, contentHtml: value }))}
              modules={{
                toolbar: [
                  [{ header: [1, 2, 3, false] }],
                  ["bold", "italic", "underline", "strike"],
                  [{ list: "ordered" }, { list: "bullet" }],
                  ["blockquote", "code-block", "link", "image"],
                  [{ align: [] }],
                  ["clean"],
                ],
              }}
              placeholder="Write your blog content..."
            />
          </div>

          <div className="pt-2 flex flex-wrap justify-end gap-2">
            <button
              onClick={onCreateNew}
              className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold"
            >
              Reset
            </button>
            <button
              onClick={() => void onSave()}
              disabled={saving || deleting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {selectedId ? "Update Post" : "Create Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
