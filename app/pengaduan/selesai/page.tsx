"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect, Fragment } from "react";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  CalendarIcon,
  Check,
  ChevronsUpDown,
  CircleAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  createData,
  editData,
  postpenyelesaian,
} from "@/lib/actions/pengaduanAction";

import { serialize } from "object-to-formdata";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import axios from "axios";
import useSWR from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import useFetch from "@/hooks/useFetch";
// import { Calendar } from "@/components/ui/Calendar"
import { format } from "date-fns";
import { Combobox } from "@/components/combobox";
import PelangganCombobox from "@/components/combobox-pelanggan";
import { Textarea } from "@/components/ui/textarea";
import { decrypt, encrypt } from "@/lib/crypto";
import { DateTimePicker24h } from "@/components/datetime-picker";

const fetcher = (url: any) => axios.get(url).then((res) => res.data);
type JenisAduan = {
  id: string;
  nama: string;
  aktif: string;
};

type Pelanggan = {
  no_pelanggan: string;
  nama: string;
  alamat: string;
};

type ComboBoxItemType = {
  value: string;
  label: string;
};

export default function PengaduanSelesaiForm() {
  const searchParams = useSearchParams();
  const paramsIdValue: string = searchParams.get("id") || "";
  const id = decrypt(decodeURIComponent(paramsIdValue));
  const {
    data: UserData,
    isLoading: UserLoading,
    isError: UserError,
    mutate: UserMutate,
  } = useFetch(`/api/pengaduan/detail/${id}`);
  const {
    data: JenisAduan,
    isLoading: JenisLoading,
    isError: JenisError,
  } = useFetch("/api/jenis-penyelesaian");
  const [openJenisAduan, setOpenJenisAduan] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const formSchema = z.object({
    tanggal: z.coerce.date(),
    jenis_penyelesaian_id: z.coerce.string().min(1, "Jenis Aduan Id required"),
    ket_penyelesaian: z.string().min(3, "Ket Aduan is required"),
    foto_aduan: z
      .instanceof(File)
      .refine((file) => file?.size <= 5 * 1024 * 1024, `Max image size is 5MB.`)
      .refine(
        (file) =>
          ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
            file?.type
          ),
        "Only .jpg, .jpeg, .png and .webp formats are supported."
      )
      .nullable()
      .optional(),
  });

  // useEffect(() => {
  //   const fetchData = async () => {
  //     const divisi = await getData()
  //     setDivisi(divisi.data)
  //   }

  //   fetchData()
  // }, [])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tanggal: new Date(),
      jenis_penyelesaian_id: "",
      ket_penyelesaian: "",
      foto_aduan: undefined,
    },
  });

  const [isPending, startTransition] = useTransition();

  if (JenisError)
    return (
      <main className="flex flex-col gap-5 justify-center content-center p-5">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Pengaduan</CardTitle>
            <CardDescription>Pengaduan</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Fetching Data</AlertTitle>
              <AlertDescription>{JenisError}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter></CardFooter>
        </Card>
      </main>
    );
  if (JenisLoading)
    return (
      <main className="flex flex-col gap-5 justify-center content-center p-5">
        <Card className="w-full">
          <CardHeader></CardHeader>
          <CardContent>
            <Skeleton className="flex w-full m-1 h-[20px] rounded-full" />
            <Skeleton className="flex w-full m-1 h-[20px] rounded-full" />
            <Skeleton className="flex w-full m-1 h-[20px] rounded-full" />
          </CardContent>
          <CardFooter></CardFooter>
        </Card>
      </main>
    );
  if (!JenisAduan) {
    <main className="flex flex-col gap-5 justify-center content-center p-5">
      <Card className="w-full">
        <CardHeader></CardHeader>
        <CardContent>
          <Skeleton className="flex w-full m-1 h-[20px] rounded-full" />
          <Skeleton className="flex w-full m-1 h-[20px] rounded-full" />
          <Skeleton className="flex w-full m-1 h-[20px] rounded-full" />
        </CardContent>
        <CardFooter></CardFooter>
      </Card>
    </main>;
  }

  const JenisAduanData: JenisAduan[] = JenisAduan.data;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(form.getValues(), "from onsubmit");

    startTransition(async () => {
      const formData = serialize(values);
      const data = await postpenyelesaian(parseInt(id || "0"), formData);
      if (data.success) {
        toast({
          variant: "default",
          description: (
            <div className="flex gap-2 items-start">
              <div className="flex flex-col justify-start ">
                <Check className="w-10 h-10" />
              </div>
              <div>
                <p className="font-bold text-lg">Success</p>
                <p>{data.message}</p>
              </div>
            </div>
          ),
        });
        router.refresh();
        router.push(
          `/admin/pengaduan/detail?id=${encodeURIComponent(encrypt(id || ""))}`
        );
      } else {
        toast({
          variant: "destructive",
          description: (
            <div className="flex gap-2 items-start">
              <div className="flex flex-col justify-start ">
                <CircleAlert className="w-10 h-10" />
              </div>
              <div>
                <p className="font-bold text-lg">{data.message}</p>
                {/* <ul className="list-disc pl-5">
                  {data.data.map((val: any, key: number) => (
                    <li key={key}>{val.message}</li>
                  ))}
                </ul> */}
              </div>
            </div>
          ),
        });
      }
    });
  }

  console.log(form.getValues());
  return (
    <main className="flex flex-col gap-5 justify-center content-center p-5">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Penyelesaian Pengaduan</CardTitle>
          <CardDescription>Penyelesaian Pengaduan Pelanggan</CardDescription>
        </CardHeader>
        <CardContent className="py-0">
          <div className="grid grid-cols-7 grid-rows-2 gap-4">
            <div className="col-span-3 row-span-2 flex flex-col w-full justify-start border-r-2">
              <h1 className="p-2 underline font-bold text-center">
                DETAIL ADUAN
              </h1>
              <div className="flex flex-row w-full justify-start items-center gap-2 py-0 px-2">
                <p className="w-32">Nomor</p>
                <p>:</p>
                <p className={`p-1 flex-grow`}>{UserData.data.nomor}</p>
              </div>
              <div className="flex flex-row w-full justify-start items-center gap-2 py-0 px-2">
                <p className="w-32">Status</p>
                <p>:</p>
                <p
                  className={`${UserData.data.status.warna} p-1 rounded-md w-36 text-center`}
                >
                  {UserData.data.status.value}
                </p>
              </div>
              <div className="flex flex-row w-full justify-start items-center gap-2 py-0 px-2">
                <p className="w-32">Tanggal</p>
                <p>:</p>
                <p className={`p-1 flex-grow`}>{UserData.data.tanggal}</p>
              </div>
              <div className="flex flex-row w-full justify-start items-center gap-2 py-0 px-2">
                <p className="w-32 ">Sumber Laporan</p>
                <p>:</p>
                <p className={`p-1 flex-grow`}>
                  {UserData.data.sumber_laporan}
                </p>
              </div>
              <div className="flex flex-row w-full justify-start items-center gap-2 py-0 px-2">
                <p className="w-32">Nama</p>
                <p>:</p>
                <p className={`p-1 flex-grow`}>{UserData.data.nama}</p>
              </div>
              <div className="flex flex-row  w-full justify-start items-center gap-2 py-0 px-2">
                <p className="w-32">Alamat</p>
                <p>:</p>
                <p className={`p-1  flex-grow`}>{UserData.data.alamat}</p>
              </div>
              <div className="flex flex-row w-full justify-start items-center gap-2 py-0 px-2">
                <p className="w-32">No HP</p>
                <p>:</p>
                <p className={`p-1 flex-grow`}>{UserData.data.no_hp}</p>
              </div>
              <div className="flex flex-row w-full justify-start items-center gap-2 py-0 px-2">
                <p className="w-32">Jenis Aduan</p>
                <p>:</p>
                <p className={`p-1 flex-grow`}>{UserData.data.jenis_aduan}</p>
              </div>
              <div className="flex flex-row  w-full justify-start items-center gap-2 py-0 px-2">
                <p className="w-32">Ket Aduan</p>
                <p>:</p>
                <p className={`p-1 flex-grow`}>{UserData.data.ket_aduan}</p>
              </div>
            </div>
            <div className="col-span-4 row-span-2 col-start-4 flex flex-col w-full">
              <h1 className="mb-2 underline font-bold">Post Penyelesaian</h1>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-5"
                >
                  <div className="flex w-full justify-start gap-4">
                    <FormField
                      control={form.control}
                      name="tanggal"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Tanggal Penyelesaian</FormLabel>
                          <FormControl>
                            <DateTimePicker24h
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jenis_penyelesaian_id"
                      render={({ field }) => (
                        <FormItem className="flex flex-col grow">
                          <FormLabel>Jenis Penyelesaian</FormLabel>
                          <Popover
                            open={openJenisAduan}
                            onOpenChange={setOpenJenisAduan}
                          >
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value
                                    ? JenisAduanData.find(
                                        (jenisAduan) =>
                                          jenisAduan.id === field.value
                                      )?.nama
                                    : "Select Jenis Aduan"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="p-1">
                              <Command>
                                <CommandInput placeholder="Search Jenis Aduan..." />
                                <CommandList>
                                  <CommandEmpty>
                                    No Jenis Aduan Found.
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {JenisAduanData.map((jenisAduan) => (
                                      <CommandItem
                                        value={jenisAduan.nama}
                                        key={jenisAduan.id.toString()}
                                        onSelect={() => {
                                          form.setValue(
                                            "jenis_penyelesaian_id",
                                            jenisAduan.id
                                          );
                                          form.trigger("jenis_penyelesaian_id");
                                          setOpenJenisAduan(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            jenisAduan.id === field.value
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                        />
                                        {jenisAduan.nama}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="ket_penyelesaian"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Keterangan Penyelesaian</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Keterangan Penyelesaian"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="foto_aduan"
                    render={({ field: { value, onChange, ...fieldProps } }) => (
                      <FormItem>
                        <FormLabel>Foto Penyelesaian</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              onChange(
                                event.target.files && event.target.files[0]
                              )
                            }
                            {...fieldProps}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isPending}>
                      Submit
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </CardContent>
        <CardFooter></CardFooter>
      </Card>
    </main>
  );
}
