import { Prisma } from "@prisma/client";
import { fail, handleApiError, ok, parsePagination } from "src/lib/api";
import { prisma } from "src/lib/prisma";

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

    return ok("Public blog posts fetched", {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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
      return fail("Blog service temporarily unavailable", 503, "SERVICE_UNAVAILABLE");
    }

    return handleApiError(error, "Failed to fetch public blog posts");
  }
}
