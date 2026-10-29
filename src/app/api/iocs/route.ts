import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalize, detectType } from "@/lib/ioc";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tag = searchParams.get("tag") ?? undefined;
  const type = searchParams.get("type") ?? undefined;

  const iocs = await prisma.ioc.findMany({
    where: {
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
    },
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    iocs.map((ioc) => ({
      id: ioc.id,
      value: ioc.value,
      type: ioc.type,
      note: ioc.note,
      createdAt: ioc.createdAt,
      tags: ioc.tags.map((t) => t.tag.name),
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { value, note, tags } = body as {
    value: string;
    note?: string;
    tags?: string[];
  };

  if (!value || typeof value !== "string") {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  const normalized = normalize(value);
  const type = detectType(normalized);

  if (!type) {
    return NextResponse.json(
      { error: `"${value}" is not a recognised IOC type (ipv4, domain, url, md5, sha1, sha256)` },
      { status: 422 }
    );
  }

  // Check for duplicate
  const existing = await prisma.ioc.findUnique({ where: { normalized } });
  if (existing) {
    return NextResponse.json(
      {
        error: `Duplicate: this indicator already exists as entry #${existing.id} ("${existing.value}")`,
        existingId: existing.id,
      },
      { status: 409 }
    );
  }

  const tagNames: string[] = Array.isArray(tags)
    ? tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const ioc = await prisma.ioc.create({
    data: {
      value,
      normalized,
      type,
      note: note ?? null,
      tags: {
        create: tagNames.map((name) => ({
          tag: {
            connectOrCreate: { where: { name }, create: { name } },
          },
        })),
      },
    },
    include: { tags: { include: { tag: true } } },
  });

  return NextResponse.json(
    {
      id: ioc.id,
      value: ioc.value,
      type: ioc.type,
      note: ioc.note,
      createdAt: ioc.createdAt,
      tags: ioc.tags.map((t) => t.tag.name),
    },
    { status: 201 }
  );
}
