import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { generateSessionToken, Session } from "@/lib/session"; // sesuaikan path
import { UserGet } from "@/lib/server/user";
import db from "@/lib/db";
import { MobileUser } from "@/types/mobile";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import validator from "validator";

async function getUserFromEmail(email: string): Promise<MobileUser | null> {
  const [data]: any = await db.query(
    "SELECT a.id, a.email, a.nama, a.image, a.password, a.alamat, a.nomor_telepon, a.provider FROM web_public_user a WHERE a.email = ?",
    [email]
  );
  if (data.length === 0) {
    return null;
  }

  const user: MobileUser = {
    id: data[0].id,
    email: data[0].email,
    nama: data[0].nama,
    image: data[0].image,
    nomor_telepon: data[0].nomor_telepon,
    alamat: data[0].alamat,
    password: data[0].password,
    provider: data[0].provider,
  };
  return user;
}

async function getUserFromPhone(
  nomor_telepon: string
): Promise<MobileUser | null> {
  const [data]: any = await db.query(
    "SELECT a.id, a.email, a.nama, a.image, a.password, a.alamat, a.nomor_telepon FROM web_public_user a WHERE a.nomor_telepon = ?",
    [nomor_telepon]
  );
  console.log(nomor_telepon);
  if (data.length === 0) {
    return null;
  }

  const user: MobileUser = {
    id: data[0].id,
    email: data[0].email,
    nama: data[0].nama,
    image: data[0].image,
    nomor_telepon: data[0].nomor_telepon,
    alamat: data[0].alamat,
    password: data[0].password,
  };
  return user;
}

async function getUserFromEmailOrPhone(
  emailOrPhone: string
): Promise<MobileUser | null> {
  if (validator.isEmail(emailOrPhone)) {
    return await getUserFromEmail(emailOrPhone);
  } else {
    return await getUserFromPhone(emailOrPhone);
  }
}

export async function createSession(
  token: string,
  userId: number
): Promise<Session> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  };
  await db.execute(
    "INSERT INTO session_user (id, userid, expires_at) VALUES (?, ?, ?)",
    [session.id, session.userId, session.expiresAt]
  );
  return session;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyApiSecret(req.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();

    const { email, nomor_telepon, password } = body;
    const emailOrPhone = email || nomor_telepon;

    if (typeof emailOrPhone !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { message: "Invalid or missing fields" },
        { status: 400 }
      );
    }

    if (emailOrPhone === "" || password === "") {
      return NextResponse.json(
        { message: "Please enter your email/nomor_telepon and password." },
        { status: 400 }
      );
    }

    const user = await getUserFromEmailOrPhone(emailOrPhone);
    if (!user) {
      return NextResponse.json(
        { message: "Email/nomor telepon atau password salah" },
        { status: 404 }
      );
    }

    console.log(user);
    if (
      validator.isEmail(user.email) &&
      user.provider === "google" &&
      !user.password
    ) {
      return NextResponse.json(
        {
          message:
            "Pengguna ini masuk lewat google dan tidak ada password yang tersimpan!",
        },
        { status: 401 }
      );
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return NextResponse.json(
        { message: "Email/nomor telepon atau password salah" },
        { status: 401 }
      );
    }

    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, user.id);

    return NextResponse.json({
      message: "Login successful",
      token: sessionToken,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.nama,
        nomor_telepon: user.nomor_telepon,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
