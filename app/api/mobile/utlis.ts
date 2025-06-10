import db from "@/lib/db";
import { MobileUser } from "@/types/mobile";
import { sha256 } from "@oslojs/crypto/sha2";

export async function getUserBySession(
  token: string
): Promise<Partial<MobileUser> | null> {
  const sessionId = new TextEncoder().encode(token);
  const sessionHash = Buffer.from(sha256(sessionId)).toString("hex");
  console.log(sessionHash);
  const [rows]: any = await db.query(
    `SELECT u.id, u.email, u.nama, u.image, u.alamat, u.password, u.nomor_telepon
     FROM session_user s
     JOIN web_public_user u ON u.id = s.userid
     WHERE s.id = ? AND s.expires_at > NOW()`,
    [sessionHash]
  );

  if (!rows || rows.length === 0) return null;

  const data = rows[0];
  return {
    id: data.id,
    email: data.email,
    nama: data.nama,
    image: data.image,
    alamat: data.alamat,
    password: data.password,
    nomor_telepon: data.nomor_telepon,
  };
}

export async function getUserFromEmail(
  email: string
): Promise<Partial<MobileUser> | null> {
  const [data]: any = await db.query(
    "SELECT id, email, nama, image, alamat, nomor_telepon FROM web_public_user WHERE email = ?",
    [email]
  );

  if (data.length === 0) {
    return null;
  }

  return {
    id: data[0].id,
    email: data[0].email,
    nama: data[0].nama,
    image: data[0].image,
    alamat: data[0].alamat,
    nomor_telepon: data[0].nomor_telepon,
  };
}

export async function checkSessionUserId(
  userId: number
): Promise<{ session: any; user: any }> {
  const [sessionData]: any = await db.query(
    "SELECT * FROM session_user WHERE userid = ? AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1",
    [userId]
  );

  if (sessionData.length === 0) {
    return { session: null, user: null };
  }

  const user = await getUserFromEmail("");
  return {
    session: sessionData[0],
    user: user,
  };
}
