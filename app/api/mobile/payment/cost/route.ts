import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";

const formatDecimal = (value: string) => {
  return Number(parseFloat(value).toFixed(6)).toString();
};

export async function GET(request: NextRequest) {
  try {
    if (!verifyApiSecret(request.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const [costs] = await db.query<RowDataPacket[]>(
      "SELECT * FROM payment_cost_description"
    );

    const data = costs.map((cost: any) => ({
      ...cost,
      value: formatDecimal(cost.value),
    }));

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        message: `Error fetching payment costs: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
