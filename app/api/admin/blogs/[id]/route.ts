import { z } from "zod";
import { prisma } from "src/lib/prisma";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import { normalizeBlogKeywords, slugifyBlogTitle, stripHtmlToText } from "src/lib/blog";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const updateBlogSchema = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),
    slug: z.string().trim().max(180).optional(),
    excerpt: z.string().trim().max(400).optional(),
    coverImage: z.string().trim().url().max(500).optional().or(z.literal("")),
    contentHtml: z.string().min(1).optional(),
    keywords: z.array(z.string().trim().max(80)).optional(),
    status: z.enum(["draft", "published"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

async function resolveUniqueSlug(baseSlug: string, excludeId = "") {
  const base = slugifyBlogTitle(baseSlug);
  let slug = base;
  let index = 2;
  while (index < 200) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || (excludeId && existing.id === excludeId)) return slug;
    const suffix = `-${index}`;
    slug = `${base.slice(0, Math.max(1, 160 - suffix.length))}${suffix}`;
    index += 1;
  }
  return `${base}-${Date.now().toString().slice(-6)}`;
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { id } = await params;
    if (!id) return fail("Blog id is required", 400, "VALIDATION_ERROR");

    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    if (!post) return fail("Blog post not found", 404, "NOT_FOUND");

    return ok("Blog post fetched", { post });
  } catch (error) {
    return handleApiError(error, "Failed to fetch blog post");
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { id } = await params;
    if (!id) return fail("Blog id is required", 400, "VALIDATION_ERROR");

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return fail("Blog post not found", 404, "NOT_FOUND");

    const payload = updateBlogSchema.parse(await req.json());
    const nextTitle = payload.title?.trim() || existing.title;
    const nextContent = payload.contentHtml?.trim() ?? existing.contentHtml;
    const requestedSlug = payload.slug !== undefined ? payload.slug.trim() : existing.slug;
    const slug = await resolveUniqueSlug(requestedSlug || nextTitle, existing.id);

    const status = payload.status || existing.status;
    const publishedAt =
      status === "published"
        ? existing.publishedAt || new Date()
        : null;
    const excerpt =
      payload.excerpt !== undefined
        ? payload.excerpt.trim() || stripHtmlToText(nextContent).slice(0, 220)
        : existing.excerpt || stripHtmlToText(nextContent).slice(0, 220);
    const keywords =
      payload.keywords !== undefined
        ? normalizeBlogKeywords(payload.keywords)
        : Array.isArray(existing.keywordsJson)
        ? normalizeBlogKeywords(existing.keywordsJson)
        : [];

    const post = await prisma.blogPost.update({
      where: { id: existing.id },
      data: {
        title: nextTitle,
        slug,
        excerpt: excerpt || null,
        coverImage:
          payload.coverImage !== undefined
            ? payload.coverImage.trim() || null
            : existing.coverImage,
        contentHtml: nextContent,
        keywordsJson: keywords,
        status,
        publishedAt,
      },
    });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "admin.blog_update",
      targetType: "blog_post",
      targetId: post.id,
      metadataJson: {
        slug: post.slug,
        status: post.status,
      },
    });

    return ok("Blog post updated", { post });
  } catch (error) {
    return handleApiError(error, "Failed to update blog post");
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const { id } = await params;
    if (!id) return fail("Blog id is required", 400, "VALIDATION_ERROR");

    const existing = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, slug: true, title: true },
    });
    if (!existing) return fail("Blog post not found", 404, "NOT_FOUND");

    await prisma.blogPost.delete({ where: { id: existing.id } });

    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: "admin.blog_delete",
      targetType: "blog_post",
      targetId: existing.id,
      metadataJson: {
        slug: existing.slug,
        title: existing.title,
      },
    });

    return ok("Blog post deleted");
  } catch (error) {
    return handleApiError(error, "Failed to delete blog post");
  }
}
