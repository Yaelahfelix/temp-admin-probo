import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";

export async function GET(request: NextRequest) {
  try {
    if (!verifyApiSecret(request.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const [jenisAduanRes] = await db.query<RowDataPacket[]>(
      "SELECT id, nama as jenis_aduan FROM jenis_aduan WHERE is_active = '1' ORDER BY nama ASC"
    );

    return NextResponse.json(
      {
        success: true,
        data: jenisAduanRes,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
