import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";
import path from "path";
export async function POST(request: NextRequest) {
  try {
    const headers = request.headers;
    const timestamp = headers.get("X-Timestamp");
    const signature = headers.get("X-Signature");
    const partnerId = headers.get("X-Partner-ID");

    if (!timestamp || !signature || !partnerId) {
      return NextResponse.json(
        {
          responseCode: "4005200",
          responseMessage: "Missing required headers",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const url = "/sandbox_prod/url_listener.php/v1.0/qr/qr-mpm-notify";
    const httpMethod = "POST";

    const payload = JSON.stringify(body);
    const stringToSignArr = [
      httpMethod,
      url,
      crypto.createHash("sha256").update(payload).digest("hex").toLowerCase(),
      timestamp,
    ];
    const stringToSign = stringToSignArr.join(":");

    const base64Key = process.env.BASE64_PUBLIC_KEY!;

    const publicKey = Buffer.from(base64Key, "base64");

    const verify = crypto
      .createVerify("sha256")
      .update(stringToSign)
      .verify(publicKey, Buffer.from(signature, "base64"));

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

      const currentTime = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

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

      await db.end();

      return NextResponse.json({
        responseCode: "2005200",
        responseMessage: "Successful",
      });
    } catch (dbError) {
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
