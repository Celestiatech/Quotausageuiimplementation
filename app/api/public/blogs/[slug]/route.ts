import { fail, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;
  const cleanSlug = String(slug || "").trim().toLowerCase();
  if (!cleanSlug) return fail("Blog slug is required", 400, "VALIDATION_ERROR");

  const now = new Date();
  const post = await prisma.blogPost.findUnique({
    where: { slug: cleanSlug },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      contentHtml: true,
      keywordsJson: true,
      publishedAt: true,
      createdAt: true,
      author: {
        select: {
          name: true,
        },
      },
      status: true,
    },
  });

  if (!post) return fail("Blog post not found", 404, "NOT_FOUND");
  if (post.status !== "published") return fail("Blog post not found", 404, "NOT_FOUND");
  if (post.publishedAt && post.publishedAt > now) return fail("Blog post not found", 404, "NOT_FOUND");

  return ok("Public blog post fetched", { post });
}
