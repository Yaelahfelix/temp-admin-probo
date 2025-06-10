import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { getUserBySession } from "../utlis";
import moment from "moment";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { put } from "@vercel/blob";

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

    // Get PSB data
    const [psbRes] = await db.query<RowDataPacket[]>(
      `SELECT 
        a.id,
        a.created_at as tanggal,
        a.nama,
        a.no_hp,
        a.alamat,
        a.flaghub,
        a.hub_at,
        a.hub_by,
        a.flagproses,
        a.proses_at,
        a.proses_by,
        a.updated_at,
        a.is_canceled,
        a.cancel_reason
      FROM web_user_daftarpsb as a 
      WHERE a.user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 12`,
      [user.id]
    );

    const dataOlahpsb = psbRes.map((val: any) => {
      let tracking_psb = [];

      const dataMasuk = {
        judul: `DATA MASUK`,
        tanggal: val.tanggal,
        deskripsi: `Data aduan masuk ke server di input oleh ${user.nama}`,
      };
      tracking_psb.push(dataMasuk);

      if (val.flaghub) {
        const dataDihub = {
          judul: `TELAH DIHUBUNGI`,
          tanggal: val.hub_at,
          deskripsi: `calon pelanggan telah di hub oleh perusahaan a.n : ${val.hub_by}`,
        };
        tracking_psb.push(dataDihub);
      }

      if (val.flagproses) {
        const dataComplet = {
          judul: `TELAH DI PROSES`,
          tanggal: val.proses_at,
          deskripsi: `pendaftaran calon pelanggan telah di proses oleh : ${val.proses_by} `,
        };
        tracking_psb.push(dataComplet);
      }

      if (val.is_canceled) {
        const iscancel = {
          judul: `CANCEL`,
          tanggal: val.updated_at,
          deskripsi: `pendaftaran calon pelanggan telah di cancel dengan alasan : ${val.cancel_reason} `,
        };
        tracking_psb.push(iscancel);
      }

      const valMaster = {
        id: val.id,
        tanggal: format(new Date(val.tanggal), "dd MMMM yyyy", { locale: id }),
        nama: val.nama,
        no_hp: val.no_hp,
        alamat: val.alamat?.trim() || "",
        status_psb: val.flaghub + val.flagproses,
        is_canceled: val.is_canceled,
        cancel_reason: val.cancel_reason,
        tracking_psb: tracking_psb,
      };

      return valMaster;
    });

    return NextResponse.json(
      {
        success: true,
        data: dataOlahpsb,
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
    let user_id = null;
    if (user) {
      user_id = user.id;
    }

    const formData = await request.formData();

    const nama = formData.get("nama") as string;
    const alamat = formData.get("alamat") as string;
    const no_hp = formData.get("no_hp") as string;
    const latitude = formData.get("latitude") as string;
    const longitude = formData.get("longitude") as string;
    const file = formData.get("file") as File | null;

    if (!nama || !alamat || !no_hp) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: nama, alamat, no_hp",
        },
        { status: 422 }
      );
    }

    if (user_id) {
      const [oldDaftarRes] = await db.query<RowDataPacket[]>(
        "SELECT id FROM web_user_daftarpsb WHERE user_id = ? AND flagproses = 0 AND is_canceled = 0",
        [user_id]
      );

      if (oldDaftarRes.length > 0) {
        console.log("Existing unprocessed registration found");
        return NextResponse.json(
          {
            success: false,
            message: "Masih Ada Data Pendaftaran yang belum diproses",
          },
          { status: 422 }
        );
      }
    }

    let imageUrl = null;
    if (file) {
      const fileName = file.name;
      console.log("UPLOADING " + fileName);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const blob = await put(fileName, buffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      console.log("success uploading");
      console.log(blob);
      imageUrl = blob.url;
    }

    console.log("Image url: " + imageUrl);

    // Insert PSB registration
    const [insertResult] = await db.query<any>(
      `INSERT INTO web_user_daftarpsb (
        user_id, 
        nama, 
        alamat, 
        no_hp, 
        foto_tempat_url, 
        latitude, 
        longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, nama, alamat, no_hp, imageUrl, latitude, longitude]
    );

    const dataRespons = {
      id: insertResult.insertId,
      nama,
      alamat,
      no_hp,
      latitude,
      longitude,
      imageUrl,
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
