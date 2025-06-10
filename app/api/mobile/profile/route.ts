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
      `SELECT 
        webnomor.id as idnomoruser,
        webnomor.nomor_pelanggan as no_pelanggan,
        webnomor.id_user,
        pelanggan.nama,
        pelanggan.alamat
      FROM web_nomor_pelanggan as webnomor
      INNER JOIN pelanggan ON pelanggan.no_pelanggan = webnomor.nomor_pelanggan
      WHERE webnomor.id_user = ?`,
      [user.id]
    );

    const pelangganResTrim = pelangganRes.map((val: any) => {
      const result = {
        idnomoruser: val.idnomoruser,
        no_pelanggan: val.no_pelanggan?.trim() || "",
        nama: val.nama?.trim() || "",
        alamat: val.alamat?.trim() || "",
        aktif: val.aktif,
      };
      return result;
    });

    const dataRespons = {
      ...user,
      pelanggan: pelangganResTrim,
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

export async function PUT(request: NextRequest) {
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

    const bodyData = await request.json();
    if (!bodyData || Object.keys(bodyData).length === 0) {
      return NextResponse.json(
        { success: false, message: "No data provided for update" },
        { status: 422 }
      );
    }

    if (bodyData.email) {
      const [emailCheck] = await db.query<RowDataPacket[]>(
        "SELECT id FROM web_public_user WHERE email = ? AND id != ? LIMIT 1",
        [bodyData.email, user.id]
      );
      if (emailCheck.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Email sudah digunakan, coba email lain!",
          },
          { status: 409 }
        );
      }
    }

    if (bodyData.nomor_telepon) {
      const [phoneCheck] = await db.query<RowDataPacket[]>(
        "SELECT id FROM web_public_user WHERE nomor_telepon = ? AND id != ? LIMIT 1",
        [bodyData.nomor_telepon, user.id]
      );
      if (phoneCheck.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Nomor telp sudah digunakan, silahkan coba yang lain",
          },
          { status: 409 }
        );
      }
    }

    const fields = Object.keys(bodyData);
    const values = Object.values(bodyData);
    const setClause = fields.map((field) => `${field} = ?`).join(", ");

    await db.query(`UPDATE web_public_user SET ${setClause} WHERE id = ?`, [
      ...values,
      user.id,
    ]);

    return NextResponse.json(
      {
        success: true,
        message: "Update Data Successful",
        data: bodyData,
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
