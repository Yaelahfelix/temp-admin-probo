import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";
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
    if (user === null) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const order_id = searchParams.get("order_id");

    const user_id = user.id;
    let result: RowDataPacket[];

    if (order_id) {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM payment_transaction WHERE order_id = ?",
        [order_id]
      );
      result = rows;
    } else {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT *, 
         IF(transaction_status = 'pending', 
            IF(NOW() > expired_at, 'failed', 'pending'), 
            transaction_status) AS status 
         FROM payment_transaction 
         WHERE user_id = ? 
         ORDER BY FIELD(
           IF(transaction_status = 'pending', 
              IF(NOW() > expired_at, 'failed', 'pending'), 
              transaction_status), 
           'pending', 'success', 'failed'
         )`,
        [user_id]
      );
      result = rows;
    }

    return NextResponse.json(result, { status: 200 });
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
