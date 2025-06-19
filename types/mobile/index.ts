export interface MobileUser {
  id: number;
  email: string;
  nama: string;
  image: string;
  password: string;
  alamat: string;
  provider?: string;
  nomor_telepon: string;
}
