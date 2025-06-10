import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { QueryResult, ResultSetHeader, RowDataPacket } from "mysql2";
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

    const [bcmRes] = await db.query<RowDataPacket[]>(
      `SELECT 
        a.id,
        a.stanskrg,
        a.periode,
        a.no_pelanggan,
        a.alamat,
        a.nama,
        a.pakaiskrg
      FROM web_user_bcmandiri as a 
      WHERE a.user_id = ? 
      ORDER BY periode DESC 
      LIMIT 12`,
      [user.id]
    );

    const dataOlahbcm = bcmRes.map((val: any) => {
      const valMaster = {
        id: val.id,
        periode: val.periode,
        no_pelanggan: val.no_pelanggan,
        nama: val.nama,
        alamat: val.alamat?.trim() || "",
        stan: val.stanskrg,
        pakaim3: val.pakaiskrg,
        url_foto: `${process.env.URL_FOTO_BACAMETER}/${val.periode}/foto_meter/${val.no_pelanggan}.jpg`,
      };

      return valMaster;
    });

    return NextResponse.json(
      {
        success: true,
        data: dataOlahbcm,
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

export async function POST(request: NextRequest) {
  try {
    // Verify API secret
    if (!verifyApiSecret(request.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Get token from Authorization header
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
    // Parse request body
    const body = await request.json();
    const { stanskrg, periode, no_pelanggan, nama, alamat, pakaiskrg } = body;

    // Validation - check if required fields are present
    if (
      !stanskrg ||
      !periode ||
      !no_pelanggan ||
      !nama ||
      !alamat ||
      !pakaiskrg
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields",
        },
        { status: 422 }
      );
    }

    // Check if customer exists
    const [oldpelanggan] = await db.query<RowDataPacket[]>(
      "SELECT no_pelanggan FROM pelanggan WHERE no_pelanggan = ?",
      [no_pelanggan]
    );

    if (oldpelanggan.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "pelanggan tidak terdaftar",
        },
        { status: 422 }
      );
    }

    // Insert BCM data
    const [bcmResult] = await db.query<ResultSetHeader>(
      `INSERT INTO web_user_bcmandiri (user_id, stanskrg, periode, no_pelanggan, nama, alamat, pakaiskrg) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, stanskrg, periode, no_pelanggan, nama, alamat, pakaiskrg]
    );

    const dataRespons = {
      id: bcmResult.insertId,
      stanskrg,
      periode,
      no_pelanggan,
      nama,
      alamat,
      pakaiskrg,
    };

    return NextResponse.json(
      {
        success: true,
        data: dataRespons,
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
