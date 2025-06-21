import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import db from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { getUserBySession } from "../utlis";
import { verifyApiSecret } from "@/lib/verifyApiSecret";

export async function POST(req: NextRequest) {
  try {
    if (!verifyApiSecret(req.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    const session = await getUserBySession(token);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired session" },
        { status: 401 }
      );
    }
    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { status: 400, message: "field ga lengkap" },
        { status: 400 }
      );
    }

    const queryUser = `SELECT id, password FROM web_admin_user WHERE id = ?`;
    const [users] = await db.query<RowDataPacket[]>(queryUser, [session.id]);

    if (users.length === 0) {
      return NextResponse.json(
        { status: 404, message: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    const user = users[0];
    if (!user.password) {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { status: 401, message: "Password lama tidak cocok" },
          { status: 401 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateQuery = `UPDATE web_admin_user SET password = ? WHERE id = ?`;
    await db.query(updateQuery, [hashedPassword, session.id]);

    return NextResponse.json({
      status: 200,
      message: "Password berhasil diubah",
    });
  } catch (err) {
    return NextResponse.json(
      { status: 500, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
