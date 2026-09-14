## INSTALATION GUIDE UNTUK DEVELOPMENT APLIKASI LAPOR LAPANGAN

Lapor Lapangan adalah aplikasi mobile untuk petugas lapangan yang digunakan untuk:
   - Login melalui Supabase Authentication.
   - Melihat daftar pekerjaan.
   - Melihat detail pekerjaan dan target lokasi.
   - Mengambil lokasi GPS petugas.
   - Mengirim status dan catatan pekerjaan.
   - Mengunggah foto bukti.
   - Menyimpan data sementara saat offline.
   - Melakukan sinkronisasi otomatis saat koneksi kembali.

<img width="1080" height="2400" alt="Screenshot_1789066747" src="https://github.com/user-attachments/assets/9ae51a48-0b82-44b7-a29d-c43c4302a4e5" />

#### Requirement:
- Git
- Node.js LTS
- npm
- VS Code
- Android Studio
- Android SDK
- Android Emulator atau perangkat Android fisik
- Akun Expo/EAS
- Akses ke project Supabase
- Untuk iOS native, diperlukan macOS dan Xcode.

#### How to install:

1. Clone repository
   ```
   git clone https://github.com/Satya-Raditya-051/L-Lapangan-app.git
   ```
2. Install dependencies 
   ```
   npm install
   ```
3. buat file .env dan masukkan url supabase
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://project-id.supabase.co //masukkan URL supabase yang sudah dibuat
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key //this too

   ```
   Anon key diambil di project settings > API keys > Legacy anon, service_role API keys
   
5. di app.json, masukkan API key google map
   ```
   "android": {
     "config": {
       "googleMaps": {
         "apiKey": "..." //PUT UR API KEYS HERE
       }
     }
   }
   ```
6. set database di supabase
   copy query ini:
   ```
      -- Diperlukan untuk gen_random_uuid()
   create extension if not exists pgcrypto;

   -- Membuat enum role pengguna
   do $$
   begin
     create type public.user_role as enum ('admin', 'teknisi');
   exception
     when duplicate_object then null;
   end
   $$;

   -- Tabel petugas
   create table if not exists public.petugas (
     id uuid primary key default auth.uid(),
     created_at timestamptz not null default now(),
     nama_petugas text,
     role public.user_role default 'teknisi',
     is_active boolean default true,

     constraint petugas_id_fkey
       foreign key (id)
       references auth.users (id)
   );

   -- Tabel pekerjaan
   create table if not exists public.pekerjaan (
     id uuid primary key default gen_random_uuid(),
     judul_pekerjaan varchar not null,
     deskripsi text,
     lokasi text not null,
     status_terkini varchar,
     created_at timestamptz default now(),
     target_latitude numeric,
     target_longitude numeric,
     petugas_id uuid,
     updated_at timestamptz default now(),

     constraint pekerjaan_petugas_id_fkey
       foreign key (petugas_id)
       references public.petugas (id)
   );

   -- Tabel progres pekerjaan
   create table if not exists public.progres_pekerjaan (
     id uuid primary key default gen_random_uuid(),
     pekerjaan_id uuid,
     status_progress varchar not null,
     catatan_petugas text,
     foto_bukti_url text,
     created_at timestamptz default now(),
     longitude numeric,
     latitude numeric,
     nama_petugas text,

     constraint progres_pekerjaan_pekerjaan_id_fkey
       foreign key (pekerjaan_id)
       references public.pekerjaan (id)
   );

   -- Mengaktifkan Row Level Security
   alter table public.petugas enable row level security;
   alter table public.pekerjaan enable row level security;
   alter table public.progres_pekerjaan enable row level security;
 
   ```
   the database should be looking like this
   <img width="940" height="450" alt="image" src="https://github.com/user-attachments/assets/53b99752-5b74-4c15-99d4-895c97df563c" />

7. tambahkan policies:
   
   Policies untuk tabel pekerjaan:
   
   - policy untuk lihat pekerjaan user sendiri
   ```
      
      alter policy "Lihat tugas sendiri"
      on "public"."pekerjaan"
      to public
      using (
         (auth.uid() = petugas_id)
      );
   ```
   - policy untuk menambahkan update untuk tugas sendiri
   ```
      
      alter policy "Update tugas sendiri"
      on "public"."pekerjaan"
      to public
      using (
         (auth.uid() = petugas_id)
      );
   ```
   policy untuk tabel progress_pekerjaan:
   - Policy lihat progress sendiri
   ```
      alter policy "Lihat progress sendiri"
      on "public"."progres_pekerjaan"
      to public
      using (
         (EXISTS ( SELECT 1
      FROM pekerjaan
        WHERE ((pekerjaan.id = progres_pekerjaan.pekerjaan_id) AND (pekerjaan.petugas_id = auth.uid()))))
      );

   ```
   - policy tambah progress tugas sendiri
   ```
      alter policy "Tambah progress untuk tugas sendiri"
      on "public"."progres_pekerjaan"
      to public
      with check (
      (EXISTS ( SELECT 1
         FROM pekerjaan
        WHERE ((pekerjaan.id = progres_pekerjaan.pekerjaan_id) AND (pekerjaan.petugas_id = auth.uid()))))
      );

   ```

8. Tambahkan bucket photo di storage supabase:
      1.	masuk ke Storage > files > buckets > new bucket
      2.	aktifkan restrict file size aktif dan restrict MIME/media type (opsional)
         <img width="528" height="586" alt="image" src="https://github.com/user-attachments/assets/844182cf-7304-402e-ac66-96bc9557fe9e" />
         
9. Insert policies untuk storage:
    <img width="940" height="478" alt="image" src="https://github.com/user-attachments/assets/c56a3448-d8a1-4cb8-97fa-7e8febebba15" />
    <img width="940" height="495" alt="image" src="https://github.com/user-attachments/assets/46264af1-fea3-4545-83dc-1da10ac7e736" />
    
   atau lewat query:
   ```
   -- 1. Mengizinkan petugas yang login (authenticated) untuk mengunggah foto

      CREATE POLICY "Izinkan upload foto untuk petugas" 
      ON storage.objects FOR INSERT 
      TO authenticated 
      WITH CHECK (bucket_id = 'job_photos');

   -- 2. Mengizinkan petugas yang login (authenticated) untuk melihat foto
      CREATE POLICY "Izinkan lihat foto untuk petugas" 
      ON storage.objects FOR SELECT 
      TO authenticated 
      USING (bucket_id = 'job_photos');

   ```

10. add user dummy account:
     1. Masuk ke Authentication > users > add users > create new user
        <img width="940" height="421" alt="image" src="https://github.com/user-attachments/assets/927c0ac8-4a34-4103-9963-fd7d8071f401" />

     2. Untuk uji coba, aktifkan auto confirm user dan masukan email address & password
        <img width="940" height="528" alt="image" src="https://github.com/user-attachments/assets/4eec00d1-4c50-4608-a332-41a001a3ef71" />
        
     3. Setelah di tambahkan, refresh tabel dan copy uuid
        <img width="940" height="321" alt="image" src="https://github.com/user-attachments/assets/e6e605ce-e357-4be4-9a5a-c6365c9018c2" />
        
     4. Pindah ke bagian Table editor > petugas > insert row > masukan UUID tadi dan input data sisanya > save
        <img width="940" height="399" alt="image" src="https://github.com/user-attachments/assets/fcc3ee5e-229d-4773-b3cb-083903398069" />
        <img width="614" height="466" alt="image" src="https://github.com/user-attachments/assets/f6b101ae-d4a9-44a0-b6b3-da68cb8f7564" />

        
11. jalankan development server
    ```
      npx expo start
    ```





