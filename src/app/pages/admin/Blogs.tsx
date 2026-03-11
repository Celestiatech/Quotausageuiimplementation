import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  BookOpen,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
} from "lucide-react";
import { BlogFilter, BlogSummary, formatBlogDate } from "./blogs/shared";

type FlashState = {
  message?: string;
} | null;

export default function AdminBlogs() {
  const [posts, setPosts] = useState<BlogSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BlogFilter>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/blogs?limit=200", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to load blog posts");
      const nextPosts = Array.isArray(data?.data?.posts) ? (data.data.posts as BlogSummary[]) : [];
      setPosts(nextPosts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  useEffect(() => {
    const flash = (location.state as FlashState)?.message;
    if (!flash) return;
    setMessage(flash);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

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

  const postStats = useMemo(
    () => ({
      total: posts.length,
      published: posts.filter((post) => post.status === "published").length,
      draft: posts.filter((post) => post.status === "draft").length,
      autoPost: posts.filter((post) => post.socialAutoPostEnabled).length,
      facebookPosted: posts.filter((post) => Boolean(post.facebookPostId)).length,
    }),
    [posts],
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-100">
              <BookOpen className="h-3.5 w-3.5" />
              BLOG CMS
            </div>
            <h1 className="mt-3 text-3xl font-bold">Blog Listing</h1>
            <p className="mt-1 max-w-2xl text-sm text-indigo-100">
              Manage published and draft posts from one listing view, then open dedicated add and edit screens when needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadPosts()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <Link
              to="/admin/blogs/new"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-semibold text-slate-900 transition hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4" />
              Add Post
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-indigo-100">Total Posts</div>
            <div className="mt-1 text-2xl font-bold">{postStats.total}</div>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-100">Published</div>
            <div className="mt-1 text-2xl font-bold">{postStats.published}</div>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
            <div className="text-xs uppercase tracking-wide text-amber-100">Drafts</div>
            <div className="mt-1 text-2xl font-bold">{postStats.draft}</div>
          </div>
          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
            <div className="text-xs uppercase tracking-wide text-sky-100">Auto Post Enabled</div>
            <div className="mt-1 text-2xl font-bold">{postStats.autoPost}</div>
          </div>
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
            <div className="text-xs uppercase tracking-wide text-blue-100">Posted To Facebook</div>
            <div className="mt-1 text-2xl font-bold">{postStats.facebookPosted}</div>
          </div>
        </div>
      </motion.div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, slug, or excerpt"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "published", "draft"] as BlogFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === filter
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Post</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Author</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3">Facebook</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    Loading blog posts...
                  </td>
                </tr>
              ) : filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    No posts matched the current filters.
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <tr key={post.id} className="align-top">
                    <td className="px-5 py-4">
                      <div className="max-w-xl">
                        <div className="font-semibold text-slate-900">{post.title}</div>
                        {post.excerpt ? (
                          <div className="mt-1 line-clamp-2 text-sm text-slate-600">{post.excerpt}</div>
                        ) : (
                          <div className="mt-1 text-sm text-slate-400">No excerpt added</div>
                        )}
                        <div className="mt-2 text-xs text-slate-500">/{post.slug}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          post.status === "published"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <div>{post.author?.name || "Admin"}</div>
                      <div className="text-xs text-slate-400">{post.author?.email || "No email"}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <div>{formatBlogDate(post.updatedAt)}</div>
                      <div className="text-xs text-slate-400">
                        {post.publishedAt ? `Published ${formatBlogDate(post.publishedAt)}` : "Not published"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            post.facebookPostId
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : post.facebookPostError
                              ? "border-red-200 bg-red-50 text-red-700"
                              : post.socialAutoPostEnabled
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          {post.facebookPostId
                            ? "Posted"
                            : post.facebookPostError
                            ? "Retry needed"
                            : post.socialAutoPostEnabled
                            ? "Pending"
                            : "Off"}
                        </span>
                        {post.facebookPostedAt ? (
                          <div className="text-xs text-slate-500">{formatBlogDate(post.facebookPostedAt)}</div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {post.slug ? (
                          <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Preview
                          </a>
                        ) : null}
                        <Link
                          to={`/admin/blogs/${post.id}/edit`}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
