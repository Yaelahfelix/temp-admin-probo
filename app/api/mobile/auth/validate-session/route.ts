import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { decodeHex } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { MobileUser } from "@/types/mobile";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { getUserBySession } from "../../utlis";

export async function GET(req: NextRequest) {
  try {
    if (!verifyApiSecret(req.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const user = await getUserBySession(token);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      message: "Session valid",
      user: {
        id: user.id,
        email: user.email,
        name: user.nama,
      },
    });
  } catch (error) {
    console.error("Validate session error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
