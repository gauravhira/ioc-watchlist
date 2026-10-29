import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function parseId(id: string) {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

// Soft-delete
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    await prisma.ioc.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

// Restore from trash
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const ioc = await prisma.ioc.update({
      where: { id },
      data: { deletedAt: null },
      include: { tags: { include: { tag: true } } },
    });
    return NextResponse.json({
      id: ioc.id,
      value: ioc.value,
      type: ioc.type,
      note: ioc.note,
      createdAt: ioc.createdAt,
      tags: ioc.tags.map((t) => t.tag.name),
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

// Permanent delete
export async function PUT(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    await prisma.ioc.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
