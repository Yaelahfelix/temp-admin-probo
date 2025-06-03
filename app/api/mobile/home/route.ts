import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import { trimDataPelanggan } from "@/lib/utils";
import db from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    const session = await validateSessionToken(token);

    if (!session.session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const [pelangganRes] = await db.query<RowDataPacket[]>(
      `
      SELECT 
        webnomor.nosamb, 
        webnomor.id_user, 
        pelanggan.nama, 
        pelanggan.alamat, 
        pelanggan.aktif
      FROM web_nomor_pelanggan AS webnomor
      INNER JOIN pelanggan ON pelanggan.nosamb = webnomor.nosamb
      WHERE webnomor.id_user = ?
      `,
      [session.user.id]
    );

    const finalResData = pelangganRes.map((p: any) => ({
      ...trimDataPelanggan(p),
    }));

    return NextResponse.json(
      { success: true, data: finalResData },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
