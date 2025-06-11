import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { NextRequest, NextResponse } from "next/server";
import { getUserBySession } from "../../utlis";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";

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
    if (user === null) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const [paymentRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM payment_transaction WHERE user_id = ? ORDER BY created_at DESC",
      [user.id]
    );

    if (paymentRows.length === 0) {
      return NextResponse.json(
        {
          message: "Tidak ada transaksi pembayaran untuk user ini",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(paymentRows, { status: 200 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        message: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
