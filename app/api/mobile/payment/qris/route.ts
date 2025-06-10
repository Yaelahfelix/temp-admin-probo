import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { getUserBySession } from "../../utlis";
import db from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { format } from "date-fns";

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `INV-${year}${month}${day}-${randomPart}`;
}

function toISOWithOffset(hoursOffset = 7) {
  const date = new Date(Date.now() + 1 * 60 * 60 * 1000);
  const offsetDate = new Date(date.getTime() + hoursOffset * 60 * 60 * 1000);
  const isoString = offsetDate.toISOString().split(".")[0];
  return isoString.replace("T", "T") + `+0${hoursOffset}:00`;
}

export async function POST(request: NextRequest) {
  try {
    const {
      amount,
      no_pelanggan,
      admin_cost_value,
      admin_cost_type,
      costlimit_qris_value,
    } = await request.json();
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

    const user_id = user.id;
    const customerName = user.nama;
    const customerEmail = user.email;
    const tglSkrg = format(new Date(), "yyyy-MM-dd");

    const [tagihanRes] = await db.query<RowDataPacket[]>(
      "CALL infotag_desk(?,?)",
      [no_pelanggan, tglSkrg]
    );
    const tagihanBlmLunas = tagihanRes[0].map((tagihan: any) => {
      return {
        no_pelanggan: tagihan.no_pelanggan,
        periode: tagihan.periode,
        total: Number(tagihan.totalrek),
        dendatunggakan: tagihan.dendatunggakan,
      };
    });
    console.log(tagihanBlmLunas);

    const totalTagihan = tagihanBlmLunas.reduce(
      (sum: any, tagihan: any) => sum + Number(tagihan.total),
      0
    );

    let admin_cost;
    if (admin_cost_type === "percentage") {
      const cost = Math.round(totalTagihan * admin_cost_value);
      if (cost < 2500) {
        admin_cost = 2500;
      } else {
        admin_cost = cost + Number(costlimit_qris_value);
      }
    } else if (admin_cost_type === "fixed") {
      admin_cost = Number(admin_cost_value);
    } else {
      return NextResponse.json(
        { message: "admin cost type is invalid" },
        { status: 402 }
      );
    }

    if (totalTagihan + admin_cost !== amount) {
      console.log("total tagihan:", totalTagihan);
      console.log("admin:", admin_cost);
      console.log("tagihan dari client:", amount);
      return NextResponse.json(
        {
          message: "total tagihan is not valid!",
        },
        { status: 402 }
      );
    }

    const invoice = generateInvoiceNumber();

    const partnerId = process.env.WINPAY_PARTNER_ID;
    const externalId = invoice;
    const channelId = "QRIS";

    const privateKeyPath = path.join(process.cwd(), "./private-key.pem");

    let privateKey;
    try {
      privateKey = fs.readFileSync(privateKeyPath, "utf8");

      if (!privateKey.includes("-----BEGIN RSA PRIVATE KEY-----")) {
        throw new Error(
          "File harus berisi RSA private key dengan format yang benar"
        );
      }
    } catch (error) {
      console.error("Error reading RSA private key file:", error);
      return NextResponse.json(
        { message: "RSA private key file not found or invalid format" },
        { status: 500 }
      );
    }

    // Validasi environment variables
    if (!partnerId || !externalId || !channelId) {
      return NextResponse.json(
        { message: "Missing required environment variables" },
        { status: 500 }
      );
    }

    const url = "https://sandbox-api.bmstaging.id/snap/v1.0/qr/qr-mpm-generate";

    const expired_at = toISOWithOffset(7);
    const body = {
      partnerReferenceNo: invoice,
      amount: { value: amount, currency: "IDR" },
      validityPeriod: expired_at,
      additionalInfo: { isStatic: false },
    };

    console.log(body);
    const payload = JSON.stringify(body);

    const minifiedPayload = JSON.stringify(body, null, 0);
    const bodyHash = crypto
      .createHash("sha256")
      .update(minifiedPayload)
      .digest("hex")
      .toLowerCase();

    const timestamp = new Date().toISOString();
    const endpointPath = "/v1.0/qr/qr-mpm-generate";
    const stringToSign = ["POST", endpointPath, bodyHash, timestamp].join(":");

    console.log("Request body:", JSON.stringify(body, null, 2));
    console.log("Minified payload:", minifiedPayload);
    console.log("Body hash:", bodyHash);
    console.log("Timestamp:", timestamp);
    console.log("String to sign:", stringToSign);

    let signature;
    try {
      const signer = crypto.createSign("RSA-SHA256");
      signer.update(stringToSign);
      signature = signer.sign(privateKey, "base64");

      console.log("Generated signature:", signature);
    } catch (signError) {
      console.error("Error creating signature:", signError);
      return NextResponse.json(
        { message: "Failed to create signature" },
        { status: 500 }
      );
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-TIMESTAMP": timestamp,
        "X-PARTNER-ID": partnerId,
        "X-EXTERNAL-ID": externalId,
        "CHANNEL-ID": channelId,
        "X-SIGNATURE": signature,
      },
      body: minifiedPayload,
    });

    const data = await response.json();

    if (response.ok && data) {
      try {
        const insertQuery = `
          INSERT INTO payment_transaction (
            transaction_id,
            order_id,
            no_samb,
            detail_tagihan_array,
            total_biaya,
            payment_type,
            bank_name,
            transaction_status,
            transaction_time,
            settlement_time,
            is_double,
            expired_at,
            user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertValues = [
          "",
          invoice,
          no_pelanggan,
          JSON.stringify(tagihanBlmLunas),
          amount,
          "qris",
          null,
          "pending",
          timestamp,
          null,
          0,
          expired_at,
          user_id,
        ];

        await db.query(insertQuery, insertValues);
      } catch (dbError) {
        console.error("Error inserting transaction data:", dbError);
        return NextResponse.json(
          { message: "ERR_INSERT_MYSQL - Internal Server Error" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
