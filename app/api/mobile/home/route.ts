import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import { trimDataPelanggan } from "@/lib/utils";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { getUserBySession } from "../utlis";

export async function GET(request: NextRequest) {
  try {
    if (!verifyApiSecret(request.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    const user = await getUserBySession(token);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const [pelangganRes] = await db.query<RowDataPacket[]>(
      `
      SELECT 
        webnomor.nomor_pelanggan as no_pelanggan, 
        webnomor.id_user, 
        pelanggan.nama, 
        pelanggan.alamat 
      FROM web_nomor_pelanggan AS webnomor
      INNER JOIN pelanggan ON pelanggan.no_pelanggan = webnomor.nomor_pelanggan
      WHERE webnomor.id_user = ?
      `,
      [user.id]
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
