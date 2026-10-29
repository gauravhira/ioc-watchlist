import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const RETENTION_DAYS = 7;

export async function GET() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Purge anything past 7 days on every read
  await prisma.ioc.deleteMany({ where: { deletedAt: { lt: cutoff } } });

  const iocs = await prisma.ioc.findMany({
    where: { deletedAt: { not: null } },
    include: { tags: { include: { tag: true } } },
    orderBy: { deletedAt: "desc" },
  });

  return NextResponse.json(
    iocs.map((ioc) => ({
      id: ioc.id,
      value: ioc.value,
      type: ioc.type,
      note: ioc.note,
      deletedAt: ioc.deletedAt,
      expiresAt: new Date(ioc.deletedAt!.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
      tags: ioc.tags.map((t) => t.tag.name),
    }))
  );
}
