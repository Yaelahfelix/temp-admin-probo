import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { getUserBySession } from "../utlis";

export async function GET(request: NextRequest) {
  try {
    if (!verifyApiSecret(request.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const [settingRes] = await db.query<RowDataPacket[]>(
      `SELECT 
        no_whatsapp,
        email,
        alamat1,
        alamat2,
        no_telp,
        link_maps,
        link_ig
      FROM settingdesktop
      LIMIT 1`
    );

    if (!settingRes || settingRes.length === 0) {
      return NextResponse.json(
        { success: false, message: "Setting data not found" },
        { status: 404 }
      );
    }

    const settingData = {
      no_whatsapp: settingRes[0].no_whatsapp?.trim() || "",
      email: settingRes[0].email?.trim() || "",
      alamat1: settingRes[0].alamat1?.trim() || "",
      alamat2: settingRes[0].alamat2?.trim() || "",
      no_telp: settingRes[0].no_telp?.trim() || "",
      link_maps: settingRes[0].link_maps?.trim() || "",
      link_ig: settingRes[0].link_ig?.trim() || "",
    };

    return NextResponse.json(
      {
        success: true,
        data: settingData,
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
