import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { getUserBySession } from "@/app/api/mobile/utlis";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoice: string }> }
) {
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

    const { invoice } = await params;

    const [paymentRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM payment_transaction WHERE no_invoice = ?",
      [invoice]
    );

    if (paymentRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment transaction tidak ditemukan",
        },
        { status: 404 }
      );
    }

    const paymentTransaction = paymentRows[0];

    const responseData = {
      id: paymentTransaction.id,
      contract_id: paymentTransaction.contract_id,
      no_invoice: paymentTransaction.no_invoice,
      no_pelanggan: paymentTransaction.no_pelanggan,
      detail_tagihan_array: paymentTransaction.detail_tagihan_array,
      total_biaya: Number(paymentTransaction.total_biaya),
      payment_type: paymentTransaction.payment_type,
      bank_name: paymentTransaction.bank_name,
      transaction_status: paymentTransaction.transaction_status,
      transaction_time: paymentTransaction.transaction_time,
      settlement_time: paymentTransaction.settlement_time,
      is_double: paymentTransaction.is_double,
      expired_at: paymentTransaction.expired_at,
      user_id: paymentTransaction.user_id,
      qris_url: paymentTransaction.qris_url,
    };

    console.log(responseData);
    return NextResponse.json(
      responseData,

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
