import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";
import path from "path";
function base64ToPEMPublicKey(base64Key: string) {
  const decoded = Buffer.from(base64Key, "base64").toString("utf8");
  const cleaned = decoded
    .replace(/-----(BEGIN|END)( RSA)? PUBLIC KEY-----/g, "")
    .trim();
  return `-----BEGIN PUBLIC KEY-----\n${cleaned}\n-----END PUBLIC KEY-----`;
}
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
    const url = "/v1.0/qr/qr-mpm-notify";
    const httpMethod = "POST";

    console.log(body);
    const payload = JSON.stringify(body);
    const stringToSignArr = [
      httpMethod,
      url,
      crypto.createHash("sha256").update(payload).digest("hex").toLowerCase(),
      timestamp,
    ];
    const stringToSign = stringToSignArr.join(":");

    console.log(stringToSign);

    const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCEQMj6S4fW3ePLnwYd32cBcHV4
yaTRFxWziGltZ7N60ubAvETscFxhdtNolud3jeAZd2o+OgrT8tlOITqkXjl3VwSs
UKbm4p9q6steQH5G/CgHIAvf0bOPm100K7jkEWdbS/mT+Y2mMkcCnqo8DmzRuJ/T
uacarRYO0vNhjy5AnwIDAQAB
-----END PUBLIC KEY-----`;

    console.log("Public Key:", publicKey);
    console.log(stringToSign);
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
