import { Prisma } from "@prisma/client";
import { fail, handleApiError, ok, parsePagination } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { STATIC_BLOG_POSTS } from "src/content/blogPosts";
import { withCacheControl } from "src/lib/http-cache";

export async function GET(req: Request) {
  const { page, limit, skip } = parsePagination(req, { defaultLimit: 12, maxLimit: 100 });
  const now = new Date();

  try {
    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where: {
          status: "published",
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          keywordsJson: true,
          publishedAt: true,
          createdAt: true,
          author: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.blogPost.count({
        where: {
          status: "published",
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        },
      }),
    ]);

    if (total === 0) {
      const staticTotal = STATIC_BLOG_POSTS.length;
      const staticPosts = STATIC_BLOG_POSTS.slice(skip, skip + limit).map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        coverImage: p.coverImage,
        keywordsJson: p.keywordsJson,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
        author: p.author,
      }));
      return ok("Public blog posts fetched", {
        posts: staticPosts,
        pagination: {
          page,
          limit,
          total: staticTotal,
          totalPages: Math.ceil(staticTotal / limit),
        },
      });
    }

    return withCacheControl(ok("Public blog posts fetched", {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }), { maxAge: 120, staleWhileRevalidate: 600 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return ok("Public blog posts fetched", {
        posts: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      const staticTotal = STATIC_BLOG_POSTS.length;
      const staticPosts = STATIC_BLOG_POSTS.slice(skip, skip + limit).map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        coverImage: p.coverImage,
        keywordsJson: p.keywordsJson,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
        author: p.author,
      }));
      return ok("Public blog posts fetched", {
        posts: staticPosts,
        pagination: {
          page,
          limit,
          total: staticTotal,
          totalPages: Math.ceil(staticTotal / limit),
        },
      });
    }

    return handleApiError(error, "Failed to fetch public blog posts");
  }
}
