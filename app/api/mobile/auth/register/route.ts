import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { verifyApiSecret } from "@/lib/verifyApiSecret";

// Helper function untuk validasi email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function formatPhoneNumber(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) {
    return "62" + cleanPhone.slice(1);
  }
  if (cleanPhone.startsWith("62")) {
    return cleanPhone;
  }
  return "62" + cleanPhone;
}
async function checkExistingPhone(nomor_telepon: string): Promise<boolean> {
  const [data]: any = await db.query(
    "SELECT id FROM web_public_user WHERE nomor_telepon = ?",
    [nomor_telepon]
  );
  return data.length > 0;
}
async function checkExistingUser(email: string): Promise<boolean> {
  const [data]: any = await db.query(
    "SELECT id FROM web_public_user WHERE email = ?",
    [email]
  );
  return data.length > 0;
}

function validateInput(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { email, password, nama } = body;

  if (!email || typeof email !== "string" || email.trim() === "") {
    errors.push("Email is required!");
  } else if (!isValidEmail(email)) {
    errors.push("Email tidak valid!");
  } else if (
    !password ||
    typeof password !== "string" ||
    password.trim() === ""
  ) {
    errors.push("Password is required");
  } else if (password.length < 8) {
    errors.push("Panjang password minimal 8 karakter");
  } else if (!nama || typeof nama !== "string" || nama.trim() === "") {
    errors.push("Name is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyApiSecret(req.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      email,
      password,
      nama,
      provider,
      provider_id,
      nomor_telepon,
      image,
      alamat,
    } = body;

    const validation = validateInput(body);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: validation.errors.join(", "),
          errors: validation.errors,
        },
        { status: 422 }
      );
    }

    const userExists = await checkExistingUser(email);
    const phoneExists = await checkExistingPhone(nomor_telepon);
    if (userExists) {
      return NextResponse.json(
        {
          success: false,
          message: "Email sudah ada, coba email yang lain!",
        },
        { status: 422 }
      );
    }
    if (phoneExists) {
      return NextResponse.json(
        {
          success: false,
          message: "No hp sudah ada, coba no hp yang lain!",
        },
        { status: 422 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result]: any = await db.execute(
      "INSERT INTO web_public_user (email, nama, password, provider, provider_id, nomor_telepon, image, alamat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        email,
        nama,
        hashedPassword,
        provider || null,
        provider_id || null,
        nomor_telepon || null,
        image || null,
        alamat || null,
      ]
    );

    const userId = result.insertId;

    return NextResponse.json(
      {
        success: true,
        message: "User registered successfully",
        data: {
          id: userId,
          email,
          nama,
          provider: provider || null,
          provider_id: provider_id || null,
          nomor_telepon: nomor_telepon || null,
          image: image || null,
          alamat: alamat || null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Server error",
      },
      { status: 500 }
    );
  }
}
