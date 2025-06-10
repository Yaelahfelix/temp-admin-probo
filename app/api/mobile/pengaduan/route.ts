import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { format, isValid, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { getUserBySession } from "../utlis";
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
    const [aduanRows] = await db.query<RowDataPacket[]>(
      `
      SELECT 
        a.id,
        a.tanggal,
        a.nomor,
        a.no_pelanggan,
        c.no_pelanggan,
        c.nama as namapel,
        c.alamat as alamatpel,
        a.jenis_aduan_id,
        b.nama as jenis_aduan,
        a.nama,
        a.no_hp,
        a.alamat,
        a.ket_aduan,
        a.url_foto_aduan,
        a.sumber_laporan,
        a.is_processed,
        a.processed_at,
        a.processed_by_id,
        f.nama as nama_memproses,
        a.processed_number,
        a.processed_to_divisi_id,
        d.nama as nama_divisi,
        a.processed_to_petugas_id,
        e.nama as nama_petugas,
        a.is_complete,
        a.completed_at,
        a.jenis_penyelesaian_id,
        g.nama_penyelesaian,
        a.ket_penyelesaian,
        a.url_foto_penyelesaian,
        a.is_canceled,
        a.cancel_reason,
        a.updated_at
      FROM web_aduan as a
      LEFT JOIN jenis_aduan as b ON a.jenis_aduan_id = b.id
      LEFT JOIN pelanggan as c ON a.no_pelanggan = c.no_pelanggan
      LEFT JOIN divisi as d ON a.processed_to_divisi_id = d.id
      LEFT JOIN petugas as e ON a.processed_to_petugas_id = e.id
      LEFT JOIN web_admin_user as f ON a.processed_by_id = f.id
      LEFT JOIN jenis_penyelesaian as g ON a.jenis_penyelesaian_id = g.id
      WHERE a.user_web_id = ?
      ORDER BY a.tanggal ASC
      LIMIT 12
      `,
      [user.id]
    );

    const dataOlahAduan = aduanRows.map((val: any) => {
      let tracking_aduan: any[] = [];

      const dataMasuk = {
        judul: `DATA MASUK NOMOR : ${val.nomor}`,
        tanggal: val.tanggal,
        deskripsi: `Data aduan masuk ke server di input oleh ${user.nama}`,
        url_foto: val.url_foto_aduan,
      };
      tracking_aduan.push(dataMasuk);

      if (val.is_processed) {
        const dataDitugasi = {
          judul: `ADUAN DI PROSES NOMOR: ${val.processed_number}`,
          tanggal: val.processed_at,
          deskripsi: `aduan telah diteruskan kepada Divisi : ${val.nama_divisi} , Oleh ${val.nama_memproses}`,
          url_foto: null,
        };
        tracking_aduan.push(dataDitugasi);
      }

      if (val.processed_to_petugas_id != null) {
        const dataDitugasi2 = {
          judul: `ADUAN DI PROSES NOMOR: ${val.processed_number}`,
          tanggal: val.updated_at,
          deskripsi: `aduan telah diteruskan kepada Petugas : ${val.nama_petugas}`,
          url_foto: null,
        };
        tracking_aduan.push(dataDitugasi2);
      }

      if (val.is_complete) {
        const dataComplet = {
          judul: `ADUAN SELESAI`,
          tanggal: val.completed_at,
          deskripsi: `aduan telah diselesaikan oleh Petugas : ${val.nama_petugas} ket : ${val.nama_penyelesaian} , ${val.ket_penyelesaian}  `,
          url_foto: val.url_foto_penyelesaian,
        };
        tracking_aduan.push(dataComplet);
      }

      if (val.is_canceled) {
        const iscancel = {
          judul: `ADUAN CANCEL`,
          tanggal: val.updated_at,
          deskripsi: `aduan telah di cancel dengan alasan : ${val.cancel_reason} `,
          url_foto: null,
        };
        tracking_aduan.push(iscancel);
      }

      let no_pelangganval = null;
      let alamatval = null;
      let namaval = null;
      if (val.no_pelanggan != null) {
        no_pelangganval = val.no_pelanggan?.trim();
        alamatval = val.alamatpel?.trim();
        namaval = val.namapel?.trim();
      }

      const valMaster = {
        id: val.id,
        tanggal: format(new Date(val.tanggal), "dd MMMM yyyy", { locale: id }),
        tanggal_value: val.tanggal,
        nommor_aduan: val.nomor,
        pelanggan: {
          no_pelanggan: no_pelangganval,
          namapel: namaval,
          alamatpel: alamatval,
        },
        jenis_aduan: {
          jenis_aduan_id: val.jenis_aduan_id,
          jenis_aduan: val.jenis_aduan,
        },
        nama: val.nama?.trim(),
        no_hp: val.no_hp,
        alamat: val.alamat?.trim(),
        ket_aduan: val.ket_aduan,
        url_foto_aduan: val.url_foto_aduan,
        sumber_laporan: val.sumber_laporan,
        status_aduan: val.is_processed + val.is_complete,
        is_canceled: val.is_canceled,
        cancel_reason: val.cancel_reason,
        tracking_aduan: tracking_aduan,
      };

      return valMaster;
    });

    // Sort by tanggal_value descending
    dataOlahAduan.sort(
      (a, b) =>
        new Date(b.tanggal_value).getTime() -
        new Date(a.tanggal_value).getTime()
    );

    return NextResponse.json(
      {
        success: true,
        data: dataOlahAduan,
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

    const jenis_aduan_id = formData.get("jenis_aduan_id") as string;
    const tanggal = formData.get("tanggal") as string;
    const nopel = formData.get("no_pelanggan") as string;
    const nama = formData.get("nama") as string;
    const alamat = formData.get("alamat") as string;
    const no_hp = formData.get("no_hp") as string;
    const ket_aduan = formData.get("ket_aduan") as string;
    const latitude = formData.get("latitude") as string;
    const longitude = formData.get("longitude") as string;
    const file = formData.get("image_aduan") as File | null;

    if (
      !jenis_aduan_id ||
      !tanggal ||
      !nama ||
      !alamat ||
      !no_hp ||
      !ket_aduan
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields",
        },
        { status: 422 }
      );
    }

    const isValidDate = isValid(parseISO(tanggal));
    if (!isValidDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Tanggal Invalid",
        },
        { status: 422 }
      );
    }

    // Check jenis aduan exists
    const [jenisAduanRes] = await db.query<RowDataPacket[]>(
      "SELECT id FROM jenis_aduan WHERE id = ?",
      [jenis_aduan_id]
    );

    if (jenisAduanRes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Jenis Aduan ID Tidak Terdaftar",
        },
        { status: 422 }
      );
    }

    let no_pelanggan = null;
    if (nopel && nopel !== "") {
      const [pelangganRes] = await db.query<RowDataPacket[]>(
        "SELECT no_pelanggan FROM pelanggan WHERE no_pelanggan = ?",
        [nopel]
      );

      if (pelangganRes.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "No Pelanggan Tidak Terdaftar",
          },
          { status: 422 }
        );
      }
      no_pelanggan = nopel;
    }

    // Generate nomor aduan
    const [nomorRes] = await db.query<RowDataPacket[]>(
      "SELECT noautoaduan() as nomor",
      []
    );
    const nomor = nomorRes[0].nomor;
    console.log(nomor);

    // Handle file upload
    let imageUrl = null;
    if (file) {
      const fileName = nomor + "_" + file.name.replace(/ /g, "_");
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const blob = await put(fileName, buffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      imageUrl = blob.url;
    }

    // Insert aduan
    const [insertResult] = await db.query<any>(
      `INSERT INTO web_aduan (
        jenis_aduan_id, 
        nomor, 
        user_web_id, 
        tanggal, 
        no_pelanggan, 
        nama, 
        url_foto_aduan, 
        alamat, 
        no_hp, 
        ket_aduan, 
        sumber_laporan, 
        latitude, 
        longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jenis_aduan_id,
        nomor,
        user_id,
        tanggal,
        no_pelanggan,
        nama,
        imageUrl,
        alamat,
        no_hp,
        ket_aduan,
        "MOBILE",
        latitude,
        longitude,
      ]
    );

    const data = {
      id: insertResult.insertId,
      jenis_aduan_id,
      nomor,
      no_pelanggan,
      nama,
      alamat,
      no_hp,
      ket_aduan,
      latitude,
      longitude,
    };

    return NextResponse.json(
      {
        success: true,
        data: data,
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
