import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Google } from "arctic";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET_KEY;
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(number: number) {
  return new Intl.NumberFormat("de-DE").format(number);
}

export const google = new Google(
  process.env.GOOGLE_CLIENT_ID || "",
  process.env.GOOGLE_CLIENT_SECRET || "",
  `${process.env.BASE_URL || ""}/login/google/callback`
);

export const convertStatusAduan = (sts: string) => {
  console.log(sts);
  if (sts == "1") {
    return {
      warna: "bg-amber-500",
      value: "Processed",
    };
  } else if (sts == "2") {
    return {
      warna: "bg-green-500",
      value: "Completed",
    };
  } else {
    return {
      warna: "bg-red-500",
      value: "Unprosses",
    };
  }
};
const urlDefaultImage: string = process.env.NEXT_PUBLIC_URL_NO_IMAGE || "#";

export const converUrlFotoAduan = (url: string | null) => {
  if (url == null) {
    return urlDefaultImage;
  }
  return url;
};
export function generateToken(): string {
  return sign({}, JWT_SECRET!);
}
export function generateEmbedUrl(url: string) {
  if (url.includes("watch?v=")) {
    return url.replace("watch?v=", "embed/");
  } else if (url.includes("youtu.be/")) {
    const videoId = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return url;
}

export function trimDataPelanggan(pelangganObj: {
  nosamb: string;
  nama: string;
  alamat: string;
  aktif: number;
}) {
  return {
    nosamb: pelangganObj.nosamb.trim(),
    nama: pelangganObj.nama.trim(),
    alamat: pelangganObj.alamat.trim(),
    aktif: pelangganObj.aktif,
  };
}
