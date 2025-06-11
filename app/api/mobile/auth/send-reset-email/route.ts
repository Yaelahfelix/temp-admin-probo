import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import crypto from "crypto";
import db from "@/lib/db";
import { auth } from "./firebase";
import nodemailer from "nodemailer";
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "ffelixhermawan@gmail.com",
    pass: "ikzvuxcbzbwrmagu",
  },
});

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  try {
    // Create reset tokens table if not exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_expires (expires_at),
        FOREIGN KEY (user_id) REFERENCES web_public_user(id) ON DELETE CASCADE
      )
    `);

    // Find user by email
    const [rows]: any = await db.execute(
      "SELECT id, email FROM web_public_user WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Email tidak ditemukan" },
        { status: 404 }
      );
    }

    const user = rows[0];

    const resetToken = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [
      user.id,
    ]);

    await db.execute(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, resetToken, expiresAt]
    );

    const resetUrl = `http://192.168.1.5:3001/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: "ffelixhermawan@gmail.com",
      to: email,
      subject: "Reset Password - PUDAM Bayuangga",
      html: `
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.1); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <div style="width: 40px; height: 40px; background-color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <span style="color: #2563eb; font-size: 20px; font-weight: bold;"></span>
                </div>
              </div>
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Reset Password</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">PUDAM Bayuangga</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 24px; font-weight: 600;">Permintaan Reset Password</h2>
                <p style="color: #64748b; margin: 0; font-size: 16px; line-height: 1.6;">
                  Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah untuk melanjutkan proses reset password.
                </p>
              </div>

              <!-- Reset Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3); transition: all 0.3s ease;">
                  Reset Password Sekarang
                </a>
              </div>

              <!-- Alternative Link -->
              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="color: #475569; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">
                  Atau salin link berikut ke browser Anda:
                </p>
                <p style="color: #2563eb; margin: 0; font-size: 14px; word-break: break-all; font-family: monospace;">
                  ${resetUrl}
                </p>
              </div>

              <!-- Security Notice -->
              <div style="border-left: 4px solid #f59e0b; background-color: #fffbeb; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                <div style="display: flex; align-items: flex-start;">
                  <span style="color: #f59e0b; font-size: 20px; margin-right: 12px;">⚠️</span>
                  <div>
                    <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">Penting untuk Diketahui:</h3>
                    <ul style="color: #92400e; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.5;">
                      <li>Link reset password berlaku selama <strong>1 jam</strong></li>
                      <li>Jika Anda tidak meminta reset password, abaikan email ini</li>
                      <li>Jangan bagikan link ini kepada siapa pun</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; margin: 0 0 10px 0; font-size: 14px;">
                Email ini dikirim secara otomatis, mohon tidak membalas email ini.
              </p>
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                © 2025 PUDAM Bayuangga. Semua hak dilindungi.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({
      success: true,
      message:
        "Email reset password telah dikirim. Silakan cek email Anda dan ikuti instruksi untuk mereset password.",
    });
  } catch (err) {
    console.error("Password reset error:", err);

    return NextResponse.json(
      { error: "Gagal mengirim email reset. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
