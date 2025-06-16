import { NextRequest, NextResponse } from "next/server";

const pushNotificationUrl = process.env.EXPO_API_PUSH_NOTIFICATION;
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.isSendNotification === "false") {
      return NextResponse.json({
        message:
          "Deteksi blog baru berhasil, tapi notifikasi tidak dikirim karena permintaan dari cliet",
      });
    }
    const payload = {
      to: process.env.EXPO_PUSH_NOTIFICATION_TOKEN,
      sound: "default",
      title: body.title,
      body: body.description,
      data: {
        slug: body.slug.current,
      },
    };
    const res = await fetch(pushNotificationUrl!, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
    });
    return NextResponse.json({
      message: "Berhasil mengirimkan notifikasi",
      data: res,
    });
  } catch (err) {
    return NextResponse.json(
      {
        message: "Terjadi kesalahan! tidak dapat mengirim notifikasi",
        err,
      },
      { status: 500 }
    );
  }
}
