import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";
import path from "path";
import { format } from "date-fns";

export async function POST(request: NextRequest) {
  try {
    const headers = request.headers;
    console.log(headers);

    const timestamp = headers.get("X-Timestamp");
    const signature = headers.get("X-Signature");
    const partnerId = headers.get("X-Partner-ID");

    console.log("Timestamp: ", timestamp);
    console.log("Signature: ", signature);
    console.log("partnet ID: ", partnerId);

    if (!timestamp || !signature) {
      return NextResponse.json(
        {
          responseCode: "4005200",
          responseMessage: "Missing required headers",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    console.log(body);
    const url = "/v1.0/qr/qr-mpm-notify";
    const httpMethod = "POST";

    const payload = JSON.stringify(body);
    const stringToSignArr = [
      httpMethod,
      url,
      crypto
        .createHash("sha256")
        .update(payload)
        .digest()
        .toString("hex")
        .toLowerCase(),
      timestamp,
    ];
    const stringToSign = stringToSignArr.join(":");

    const base64Key = process.env.BASE64_PUBLIC_KEY!;
    const publicKey = Buffer.from(base64Key, "base64").toString("utf-8");
    console.log(publicKey);

    const verify = crypto
      .createVerify("sha256")
      .update(stringToSign)
      .verify(publicKey, Buffer.from(signature, "base64"));
    console.log("Hasil verify:", verify);

    if (!verify) {
      return NextResponse.json(
        {
          responseCode: "4015200",
          responseMessage: "Invalid signature",
        },
        { status: 401 }
      );
    }

    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        "SELECT * FROM payment_transaction WHERE no_invoice = ?",
        [body.originalPartnerReferenceNo]
      );

      if (rows.length === 0) {
        await db.end();
        return NextResponse.json(
          {
            responseCode: "4045200",
            responseMessage: "Transaction not found",
          },
          { status: 404 }
        );
      }

      const transaction = rows[0];
      const tagihan_array = transaction.detail_tagihan_array;

      console.log("checking transaction status");
      if (body.latestTransactionStatus === "00") {
        console.log("status success");

        const currentTime = format(new Date(), "yyyy-MM-dd HH:mm:ss");

        await db.execute(
          `
          UPDATE payment_transaction 
          SET 
            settlement_time = ?,
            bank_name = ?,
            transaction_status = ?
          WHERE no_invoice = ?
        `,
          [
            currentTime,
            body.additionalInfo.brandName,
            "success",
            body.originalPartnerReferenceNo,
          ]
        );

        try {
          const [userAksesRows] = await db.execute<RowDataPacket[]>(
            "SELECT * FROM users WHERE username = ?",
            ["mrk"]
          );

          const userAkses = userAksesRows[0];

          const [loketRows] = await db.execute<RowDataPacket[]>(
            "SELECT * FROM loket WHERE kodeloket = ?",
            ["BAYUANGGA"]
          );

          const loketData = loketRows.length > 0 ? loketRows[0] : null;

          await Promise.all(
            tagihan_array.map(async (tagihan: any) => {
              const periode = tagihan.periode;
              const nopel = transaction.no_pelanggan;
              const total = Number(tagihan.total);
              const denda = Number(tagihan.dendatunggakan);
              const kode = `${periode}.${nopel}`;

              console.log(`Processing tagihan for kode: ${kode}`);

              const tglSkrg = format(new Date(), "yyyy-MM-dd HH:mm:ss");

              const updateData = {
                loketbayar: userAkses.kodeloket || "",
                tglbayar: tglSkrg,
                nolpp: body.originalPartnerReferenceNo,
                kasir: userAkses.nama || "",
                ppn: 0,
                persenppn: 0,
                flaglunas: 1,
                flagbatal: 0,
                sudahupload: true,
                dendatunggakan: denda,
                total: total,
                totalloket: total,
                jasaloket: 0,
                waktuupdate: tglSkrg,
                loketupdate: userAkses.kodeloket || "",
                namaloket: loketData?.loket || "",
              };

              const [drdRows] = await db.execute<RowDataPacket[]>(
                "SELECT * FROM drd WHERE kode = ?",
                [kode]
              );

              const drd = drdRows.length > 0 ? drdRows[0] : null;

              if (drd && drd.flaglunas === "1") {
                console.log(`Double payment detected for kode: ${kode}`);

                await db.execute("UPDATE drd SET nolpp = ? WHERE kode = ?", [
                  body.originalPartnerReferenceNo,
                  kode,
                ]);

                await db.execute(
                  "UPDATE payment_transaction SET is_double = 1 WHERE no_invoice = ?",
                  [body.originalPartnerReferenceNo]
                );
              } else {
                console.log(`Processing normal payment for kode: ${kode}`);

                await db.execute(
                  `UPDATE drd SET 
                   loketbayar = ?, tglbayar = ?, nolpp = ?, kasir = ?, ppn = ?, 
                   persenppn = ?, flaglunas = ?, flagbatal = ?, sudahupload = ?, 
                   dendatunggakan = ?, total = ?, totalloket = ?, jasaloket = ?, 
                   waktuupdate = ?, loketupdate = ?, namaloket = ?
                   WHERE kode = ?`,
                  [
                    updateData.loketbayar,
                    updateData.tglbayar,
                    updateData.nolpp,
                    updateData.kasir,
                    updateData.ppn,
                    updateData.persenppn,
                    updateData.flaglunas,
                    updateData.flagbatal,
                    updateData.sudahupload,
                    updateData.dendatunggakan,
                    updateData.total,
                    updateData.totalloket,
                    updateData.jasaloket,
                    updateData.waktuupdate,
                    updateData.loketupdate,
                    updateData.namaloket,
                    kode,
                  ]
                );
              }
            })
          );

          console.log(
            `Successfully processed all tagihan for order: ${body.originalPartnerReferenceNo}`
          );
        } catch (error) {
          console.error(
            `Error processing tagihan array for order ${body.originalPartnerReferenceNo}:`,
            error
          );
          throw error;
        }
      } else if (body.latestTransactionStatus === "01") {
        await db.execute(
          "UPDATE payment_transaction SET transaction_status = ? WHERE no_invoice = ?",
          ["pending", body.originalPartnerReferenceNo]
        );
      } else {
        await db.execute(
          "UPDATE payment_transaction SET transaction_status = ? WHERE no_invoice = ?",
          ["failed", body.originalPartnerReferenceNo]
        );
      }

      await db.end();

      return NextResponse.json({
        responseCode: "2005200",
        responseMessage: "Successful",
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      await db.end();
      return NextResponse.json(
        {
          responseCode: "5005200",
          responseMessage: "Database error",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.log(error);
    return NextResponse.json(
      {
        responseCode: "5005200",
        responseMessage: "Internal server error: " + error.message,
      },
      { status: 500 }
    );
  }
}
