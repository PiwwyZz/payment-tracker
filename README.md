# 💳 Payment Tracker

> ระบบติดตามการเก็บเงินรายสัปดาห์สำหรับนักเรียน 35 คน · ฿40/สัปดาห์

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white)

## ✨ Features

- 🔐 **Admin/Student แยกสิทธิ์** — แอดมินใช้ PIN เข้าสู่ระบบ
- 📊 **Dashboard** — ดูสถานะการจ่ายเงินของนักเรียนทั้งหมด
- 📱 **อัปโหลดสลิป** — นักเรียนอัปโหลดสลิปเพื่อยืนยันการจ่าย
- 🤖 **ตรวจจับอัตโนมัติ** — ระบบตรวจสอบประเภทการจ่าย (KBank / PromptPay / TrueMoney)
- ☁️ **Cloud Sync** — ข้อมูลซิงค์ทุกอุปกรณ์ผ่าน Supabase
- 🔒 **PIN เข้ารหัส SHA-256** — ปลอดภัยจากการโดนอ่านรหัส
- 💸 **ฟรี 100%** — ไม่มีค่าใช้จ่าย

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML/CSS/JS | Frontend |
| Supabase | Database + File Storage |
| GitHub Pages | Hosting |

## 📁 Project Structure

```
website/
├── index.html          # หน้าเว็บหลัก
├── styles.css          # ธีม Dark Mode + Glassmorphism
├── app.js              # ลอจิกทั้งหมด
└── supabase-config.js  # การเชื่อมต่อ Supabase
```

## 🚀 Setup (สำหรับ Developer)

### 1. สร้างโปรเจค Supabase
- ไปที่ [supabase.com](https://supabase.com) → สร้างโปรเจค
- คัดลอก URL และ Anon Key

### 2. สร้างตาราง
รันใน SQL Editor ของ Supabase:

```sql
CREATE TABLE settings (
  id int PRIMARY KEY DEFAULT 1,
  start_date date DEFAULT '2026-05-14',
  weekly_amount int DEFAULT 40,
  pin_hash text
);
INSERT INTO settings (id, pin_hash) VALUES (1, 'YOUR_SHA256_HASH');

CREATE TABLE students (
  id int PRIMARY KEY,
  name text NOT NULL DEFAULT 'Student'
);
INSERT INTO students (id, name) SELECT g, 'Student ' || g FROM generate_series(1, 35) g;

CREATE TABLE payments (
  id serial PRIMARY KEY,
  student_id int REFERENCES students(id) ON DELETE CASCADE,
  amount int NOT NULL,
  method text NOT NULL,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE pending (
  id serial PRIMARY KEY,
  student_id int REFERENCES students(id) ON DELETE CASCADE,
  amount int NOT NULL,
  method text NOT NULL,
  note text DEFAULT '',
  slip_url text,
  created_at timestamptz DEFAULT now()
);
```

### 3. ตั้งค่า Config
แก้ไข `supabase-config.js`:
```js
const SUPABASE_URL = 'YOUR_URL';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### 4. Deploy
Push ขึ้น GitHub → เปิด GitHub Pages

---

## 📖 วิธีใช้งาน (สำหรับเพื่อนๆ)

### 🎓 สำหรับนักเรียน (Student)

1. **เข้าเว็บไซต์** → กดปุ่ม **"Student"**
2. **ค้นหาชื่อ** ของตัวเองในรายชื่อ แล้วกดเลือก
3. ดูสถานะการจ่ายเงิน:
   - 🔴 **Owed** = ยังค้างจ่าย
   - 🟢 **Clear** = จ่ายครบแล้ว
   - 🟣 **Ahead** = จ่ายเกินแล้ว
4. **อัปโหลดสลิป**:
   - กดที่กล่อง Upload หรือลากไฟล์มาวาง
   - ระบบจะตรวจจับประเภทอัตโนมัติ (KBank/PromptPay/TrueMoney)
   - ใส่จำนวนเงิน → กด **"Submit for Review"**
   - รอแอดมินอนุมัติ ✅

### 🔐 สำหรับแอดมิน (Admin)

1. **เข้าเว็บไซต์** → กดปุ่ม **"Admin"** → ใส่ PIN
2. **Dashboard** — ดูภาพรวมทั้งหมด:
   - จำนวนนักเรียน / เงินที่เก็บได้ / เงินที่ค้าง / อัตราการจ่าย
3. **บันทึกการจ่ายเงิน**:
   - กด **"+ Record"** → เลือกนักเรียน → ใส่จำนวน → เลือกช่องทาง → ยืนยัน
4. **อนุมัติสลิป**:
   - กดปุ่ม **"Pending"** (มีตัวเลขแจ้งเตือน)
   - ดูสลิป → กด ✅ **Approve** หรือ ❌ **Reject**
5. **เปลี่ยนชื่อนักเรียน**:
   - คลิกที่ชื่อในการ์ด → พิมพ์ชื่อใหม่ → กด Enter
6. **ตั้งค่า** (⚙️):
   - เปลี่ยนวันเริ่มต้น / จำนวนเงินต่อสัปดาห์ / PIN
7. **Export/Import** — สำรองข้อมูลเป็นไฟล์ JSON

---

## 🔒 ความปลอดภัย

- PIN ถูกเข้ารหัสด้วย **SHA-256** (ไม่เก็บเป็นตัวอักษรปกติ)
- ใช้ **Row Level Security (RLS)** ของ Supabase
- Anon Key เป็น public key ที่ปลอดภัย (ถูกจำกัดสิทธิ์ด้วย RLS)

## 📝 License

MIT License — ใช้ได้ฟรีตามสบาย

---

Made with ❤️ by PiwwyZz
