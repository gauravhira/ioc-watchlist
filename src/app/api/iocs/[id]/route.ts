import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const iocId = parseInt(id, 10);
  if (isNaN(iocId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  try {
    await prisma.ioc.delete({ where: { id: iocId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
