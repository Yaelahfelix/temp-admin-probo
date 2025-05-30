"use client";

import { useRouter } from "next/navigation";
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
import { createData, editData } from "@/lib/actions/pengaduanAction";

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
import { DateTimePicker24h as DateTimePicker } from "@/components/datetime-picker";
import { Combobox } from "@/components/combobox";
import PelangganCombobox from "@/components/combobox-pelanggan";
import { Textarea } from "@/components/ui/textarea";

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

export default function PengaduanForm({ pengaduan }: { pengaduan?: any }) {
  const {
    data: JenisAduan,
    isLoading: JenisLoading,
    isError: JenisError,
  } = useFetch("/api/jenis-aduan");
  const [openJenisAduan, setOpenJenisAduan] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const formSchema = z.object({
    tanggal: z.coerce.date(),
    sumber_laporan: z.string().min(3, "Sumber Aduan is required"),
    no_pelanggan: z.string().nullable().optional(),
    nama: z.string().min(3, "Name is required"),
    alamat: z.string().min(3, "Alamat is Requered"),
    no_hp: z.string().min(5, "No Telp is required"),
    nomor: z.string().nullable().optional(),
    jenis_aduan_id: z.coerce.string().min(1, "Jenis Aduan Id required"),
    ket_aduan: z.string().min(3, "Ket Aduan is required"),
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
    defaultValues: pengaduan
      ? {
          tanggal: pengaduan.tanggal ?? "",
          sumber_laporan: pengaduan.sumber_laporan ?? "",
          no_pelanggan: pengaduan.no_pelanggan ?? "",
          nama: pengaduan.nama ?? "",
          alamat: pengaduan.alamat ?? "",
          no_hp: pengaduan.no_hp ?? "",
          nomor: pengaduan.nomor ?? "",
          jenis_aduan_id: pengaduan.jenis_aduan_id ?? "",
          ket_aduan: pengaduan.ket_aduan ?? "",
          foto_aduan: undefined,
        }
      : {
          tanggal: "",
          sumber_laporan: "",
          no_pelanggan: "",
          nama: "",
          alamat: "",
          no_hp: "",
          jenis_aduan_id: "",
          nomor: "",
          ket_aduan: "",
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
      const data = pengaduan
        ? await editData(pengaduan.id, formData)
        : await createData(formData);

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
        router.push("/admin/pengaduan");
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex w-full justify-start gap-4">
          <FormField
            control={form.control}
            name="tanggal"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Tanggal Aduan</FormLabel>
                <FormControl>
                  <DateTimePicker
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
            name="sumber_laporan"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Sumber Laporan</FormLabel>
                <FormControl>
                  <div className="relative">
                    {/* <Input
                      type={showPasswordConfirmation ? "text" : "password"}
                      placeholder="Password Confirmation"
                      {...field}
                    /> */}

                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a Sumber Laporan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Sumber Laporan</SelectLabel>
                          <SelectItem value="MOBILE">MOBILE</SelectItem>
                          <SelectItem value="KANTOR">KANTOR</SelectItem>
                          <SelectItem value="TELPON">TELPON</SelectItem>
                          <SelectItem value="WHATSAPP">WHATSAPP</SelectItem>
                          <SelectItem value="SOSMED">SOSMED</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="jenis_aduan_id"
          render={({ field }) => (
            <FormItem className="flex flex-col grow">
              <FormLabel>Jenis Aduan</FormLabel>
              <Popover open={openJenisAduan} onOpenChange={setOpenJenisAduan}>
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
                            (jenisAduan) => jenisAduan.id === field.value
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
                      <CommandEmpty>No Jenis Aduan Found.</CommandEmpty>
                      <CommandGroup>
                        {JenisAduanData.map((jenisAduan) => (
                          <CommandItem
                            value={jenisAduan.nama}
                            key={jenisAduan.id.toString()}
                            onSelect={() => {
                              form.setValue("jenis_aduan_id", jenisAduan.id);
                              form.trigger("jenis_aduan_id");
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

        <FormField
          control={form.control}
          name="no_pelanggan"
          render={({ field }) => (
            <FormItem className="flex flex-col grow">
              <FormLabel>No Pelanggan</FormLabel>
              <PelangganCombobox
                defaultValue={field.value || ""}
                defaultLabel={`${field.value}-${form.getValues("nama")}-${form.getValues("alamat")}`}
                onValueChange={(value) => {
                  const arrValue = value.split(";");
                  field.onChange(arrValue[0]);
                  form.setValue("nama", arrValue[1]);
                  form.setValue("alamat", arrValue[2]);
                }}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nama"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input type="text" placeholder="nama" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="alamat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alamat</FormLabel>
              <FormControl>
                <Input type="text" placeholder="alamat" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="no_hp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>No HP</FormLabel>
              <FormControl>
                <Input type="number" placeholder="no_hp" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ket_aduan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Keterangan Aduan</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Keterangan Aduan Pelanggan"
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
              <FormLabel>Foto Aduan</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    onChange(event.target.files && event.target.files[0])
                  }
                  {...fieldProps}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* <div className="flex w-full justify-start gap-4">

          
 
        </div> */}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            Submit
          </Button>
        </div>
      </form>
    </Form>
  );
}
