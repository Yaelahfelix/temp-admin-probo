import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import type { RowDataPacket } from "mysql2";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { getUserBySession } from "../../utlis";

function convertPeriodetoStr(periode: string): string {
  const year = periode.substring(0, 4);
  const month = periode.substring(4, 6);

  // Create date from year and month (day 1)
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);

  return format(date, "MMMM yyyy", { locale: id });
}

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
    //   return NextResponse.json(
    //     { success: false, message: "Unauthorized: No token provided" },
    //     { status: 401 }
    //   );
    // }

    // const user = await getUserBySession(token);
    // if (user === null) {
    //   return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    // }

    const { no_pelanggan } = await params;
    const [pelangganRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM pelanggan WHERE no_pelanggan = ?",
      [no_pelanggan]
    );

    const pelanggan = pelangganRows[0];

    if (!pelanggan) {
      return NextResponse.json(
        {
          success: false,
          message: "Pelanggan Tidak Terdaftar",
        },
        { status: 404 }
      );
    }

    let resTagihan: any[] = [];

    const tglSkrg = format(new Date(), "yyyy-MM-dd");

    const [resTagihanSdhLunas] = await db.query<RowDataPacket[]>(
      "CALL infobayar_deskinfo(?)",
      [no_pelanggan]
    );
    const tagihanSdhLunas = resTagihanSdhLunas[0] as any[];

    const hostUrlBacameter = process.env.URL_FOTO_BACAMETER;

    tagihanSdhLunas.forEach((tagihan: any) => {
      const retTagihan = {
        nosamb: tagihan.no_pelanggan,
        nama: tagihan.nama.trim(),
        alamat: tagihan.alamat.trim(),
        periode: convertPeriodetoStr(tagihan.periode_rek),
        periode_number: Number(tagihan.periode_rek),
        kodegol: tagihan.kodegol,
        status: pelanggan.aktif,
        total: Number(tagihan.total),
        flaglunas: true,
        detail_tagihan: {
          stanlalu: Number(tagihan.stanlalu),
          stanskrg: Number(tagihan.stanskrg),
          stanangkat: Number(tagihan.stanangkat),
          pakai: Number(tagihan.pakaiskrg),
          tanggal_bayar: format(
            new Date(tagihan.tglbayar),
            "dd MMMM yyyy HH:mm:ss",
            { locale: id }
          ),
          loket_bayar: tagihan.nama_loket,
          harga_air: Number(tagihan.harga_air),
          denda: Number(tagihan.denda),
          administrasi: Number(tagihan.administrasi),
          retribusi: Number(tagihan.retribusi),
          pemeliharaan: Number(tagihan.pemeliharaan),
          pelayanan: Number(tagihan.pelayanan),
          angsuran: Number(tagihan.angsuran),
          materai: Number(tagihan.meterai),
          ppn: Number(tagihan.admin_ppob || 0),
          total: Number(tagihan.total),
          url_foto_meter: `${hostUrlBacameter}/${tagihan.periode}/foto_meter/${tagihan.no_pelanggan}.jpg`,
        },
      };
      resTagihan.push(retTagihan);
    });

    const [resTagihanBlmLunas] = await db.query<RowDataPacket[]>(
      "CALL infotag_desk(?,?)",
      [no_pelanggan, tglSkrg]
    );
    const tagihanBlmLunas = resTagihanBlmLunas[0] as any[];

    tagihanBlmLunas.forEach((tagihan: any) => {
      const retTagihan = {
        nosamb: tagihan.no_pelanggan,
        nama: tagihan.nama.trim(),
        alamat: tagihan.alamat.trim(),
        periode: convertPeriodetoStr(tagihan.periode_rek),
        periode_number: Number(tagihan.periode_rek),
        kodegol: tagihan.kodegol,
        status: pelanggan.aktif,
        total: Number(tagihan.totalrek),
        flaglunas: false,
        detail_tagihan: {
          stanlalu: Number(tagihan.stanlalu),
          stanskrg: Number(tagihan.stanskrg),
          stanangkat: Number(tagihan.stanangkat),
          pakai: Number(tagihan.pakaiskrg),
          tanggal_bayar: "-",
          loket_bayar: "-",
          harga_air: Number(tagihan.harga_air),
          denda: Number(tagihan.denda),
          administrasi: Number(tagihan.administrasi),
          retribusi: Number(tagihan.retribusi),
          pemeliharaan: Number(tagihan.pemeliharaan),
          pelayanan: Number(tagihan.pelayanan),
          angsuran: Number(tagihan.angsuran),
          materai: Number(tagihan.meterai),
          ppn: Number(tagihan.admin_ppob || 0),
          total: Number(tagihan.totalrek),
          url_foto_meter: `${hostUrlBacameter}/${tagihan.periode}/foto_meter/${tagihan.no_pelanggan}.jpg`,
        },
      };
      resTagihan.push(retTagihan);
    });

    // Sort by periode_number descending
    resTagihan.sort((a, b) => b.periode_number - a.periode_number);

    return NextResponse.json(
      {
        success: true,
        data: resTagihan,
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
