import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import db from "@/lib/db";
import { OkPacket, RowDataPacket } from "mysql2";
import path from "path";
import { format } from "date-fns";

export async function POST(request: NextRequest) {
  try {
    const headers = request.headers;
    console.log(headers);

    const timestamp = headers.get("X-Timestamp");
    const signature = headers.get("X-Signature");
    const partnerId = headers.get("X-Partner-ID");
    let user_id;

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
    // const body = {
    //   originalReferenceNo: "119445",
    //   originalPartnerReferenceNo: "INV-250616-MXHIMB",
    //   latestTransactionStatus: "00",
    //   amount: { value: "92500.00", currency: "IDR" },
    //   additionalInfo: {
    //     channel: "QRIS",
    //     contractId: "qr8baac16b-ecff-42a9-b105-e045622bb842",
    //     brandName: "DANA",
    //     rrn: "922514877152",
    //     buyerRef: "PDAM Probolinggo",
    //     terminalId: null,
    //   },
    // };

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
      const user_id = transaction.user_id;

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
              console.log(`Processing tagihan for id: ${tagihan.id}}`);

              const [drdRows] = await db.execute<RowDataPacket[]>(
                "SELECT * FROM drd WHERE id = ?",
                [tagihan.id]
              );

              const drd = drdRows.length > 0 ? drdRows[0] : null;

              if (drd && drd.flaglunas == 1) {
                console.log(`Double payment detected for id: ${tagihan.id}`);

                // await db.execute("UPDATE drd SET nolpp = ? WHERE kode = ?", [
                //   body.originalPartnerReferenceNo,
                //   kode,
                // ]);

                await db.execute(
                  "UPDATE payment_transaction SET is_double = 1 WHERE no_invoice = ?",
                  [body.originalPartnerReferenceNo]
                );
              } else {
                console.log(`Processing normal payment for id: ${tagihan.id}`);

                const [rowsDrd] = await db.query<RowDataPacket[]>(
                  "select id, denda1, denda2, totalrekening, materai from drd where id = ?",
                  [tagihan.id]
                );
                const drd = rowsDrd[0];

                const updateQuery = `
        UPDATE sipamit_billing.drd 
        SET 
          flaglunas = 1,
          tglbayar = ?,
          user_id = ?,
          nama_user = ?,
          loket_id = ?,
          nama_loket = ?,
          denda = ?,
          meterai = ?,
          totalrekening = ?
        WHERE id = ? AND flaglunas = "0"
      `;

                const todayHourFormatted = format(
                  new Date(),
                  "yyyy-MM-dd HH:mm:ss"
                );

                const [result] = await db.query<OkPacket>(updateQuery, [
                  todayHourFormatted,
                  user_id,
                  userAkses?.username || "mkr",
                  loketData?.id,
                  loketData?.kodeloket,
                  Number(drd.denda1) + Number(drd.denda2),
                  drd.materai,
                  drd.totalrekening,
                  drd.id,
                ]);
              }
            })
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

      return NextResponse.json({
        responseCode: "2005200",
        responseMessage: "Successful",
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
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
