import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import { trimDataPelanggan, formatNumber } from "@/lib/utils";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { getUserBySession } from "../../utlis";
import { format } from "date-fns";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ no_pelanggan: string }> }
) {
  try {
    // if (!verifyApiSecret(request.headers)) {
    //   return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    // }
    // const token = request.headers.get("Authorization")?.replace("Bearer ", "");

    // if (!token) {
    //   console.log("unauthorizde");

    //   return NextResponse.json(
    //     { success: false, message: "Unauthorized" },
    //     { status: 401 }
    //   );
    // }

    // console.log(token);
    // const user = await getUserBySession(token);
    // console.log(user);

    // if (!user) {
    //   console.log("unauthorizde");
    //   return NextResponse.json(
    //     { success: false, message: "Unauthorized" },
    //     { status: 401 }
    //   );
    // }

    const { no_pelanggan } = await params;

    // if (!token) {
    //   return NextResponse.json(
    //     { success: false, message: "Unauthorized: No token provided" },
    //     { status: 401 }
    //   );
    // }

    const tglSkrg = format(new Date(), "yyyy-MM-dd");
    const [resTagihan] = await db.query<RowDataPacket[]>(
      "CALL infotag_desk(?,?)",
      [no_pelanggan, tglSkrg]
    );

    const [pelangganRows] = await db.query<RowDataPacket[]>(
      "SELECT nama, alamat,  no_pelanggan FROM pelanggan WHERE no_pelanggan = ?",
      [no_pelanggan]
    );

    const pelanggan = pelangganRows[0];

    let totalTagihan = 0;
    let strvalue = "Sudah Terbayarkan";

    if (resTagihan[0] && resTagihan[0].length > 0) {
      resTagihan[0].forEach((x: any) => {
        totalTagihan += Number(x.totalrek);
      });
    }

    if (totalTagihan > 0) {
      strvalue = formatNumber(totalTagihan);
    } else {
      //   if (pelanggan?.aktif === "0") {
      //     strvalue = "Pelanggan Non Aktif";
      //   }
    }

    const pelangganRes = trimDataPelanggan(pelanggan as any);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...pelangganRes,
          total_tagihan: strvalue,
        },
      },
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
