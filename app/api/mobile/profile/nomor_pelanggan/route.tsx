import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { getUserBySession } from "../../utlis";

function compareArrays(arr1: string[], arr2: string[]): boolean {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, index) => val === arr2[index]);
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

    const { no_pelanggan } = await request.json();

    if (!no_pelanggan || !Array.isArray(no_pelanggan)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid no_pelanggan data",
        },
        { status: 422 }
      );
    }

    const bodyNopel = no_pelanggan;
    const jmlCountbodyNopel = bodyNopel.length;

    const placeholders = bodyNopel.map(() => "?").join(",");
    const [pelangganRes] = await db.query<RowDataPacket[]>(
      `SELECT * FROM pelanggan WHERE no_pelanggan IN (${placeholders})`,
      bodyNopel
    );

    const jmlCountpelangganRes = pelangganRes.length;

    if (jmlCountbodyNopel !== jmlCountpelangganRes) {
      return NextResponse.json(
        {
          success: false,
          message: "Pelanggan Invalid",
        },
        { status: 422 }
      );
    }

    const [pelangganProfile] = await db.query<RowDataPacket[]>(
      "SELECT nomor_pelanggan FROM web_nomor_pelanggan WHERE id_user = ? ORDER BY nomor_pelanggan ASC",
      [user.id]
    );

    const pelangganCompare = pelangganProfile.map(
      (val: any) => val.no_pelanggan
    );
    const isArrayValid = compareArrays(bodyNopel.sort(), pelangganCompare);

    if (!isArrayValid) {
      await db.query("START TRANSACTION");

      try {
        await db.query("DELETE FROM web_nomor_pelanggan WHERE id_user = ?", [
          user.id,
        ]);

        if (bodyNopel.length > 0) {
          const valInsert = bodyNopel.map((val: string) => [val, user.id]);
          const placeholdersInsert = valInsert.map(() => "(?, ?)").join(",");
          const flatValues = valInsert.flat();

          await db.query(
            `INSERT INTO web_nomor_pelanggan (nomor_pelanggan, id_user) VALUES ${placeholdersInsert}`,
            flatValues
          );
        }

        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }
    }

    const pelres = pelangganRes.map((val: any) => {
      const res = {
        no_pelanggan: val.no_pelanggan?.trim() || "",
        nama: val.nama?.trim() || "",
        alamat: val.alamat?.trim() || "",
        aktif: val.aktif,
      };
      return res;
    });

    return NextResponse.json(
      {
        success: true,
        data: pelres,
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
