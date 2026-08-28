# 🚀 Setup Instructions

## 1️⃣ Install Dependencies

```bash
cd campaign-admin-app
npm install
```

## 2️⃣ Configure Database

1. Copy the environment file:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and replace `[YOUR-PASSWORD]` with your actual Supabase password:
```
DATABASE_URL="postgresql://postgres.wnfcsmtufgumtekhcdhh:YOUR_ACTUAL_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
```

## 3️⃣ Run Database Migrations

```bash
npm run db:apply
```

Applies every file in `migrations/` in order — there are three, and all of
them are needed: the initial schema, then auth and presence, then per-device
presence. Running only the first leaves the app unable to sign anyone in.

## 4️⃣ Start the App

```bash
npm run dev
```

Open: **http://localhost:3000**

---

## 🗄️ Database Schema

**Schema:** `Dynamic_campaign`

**Table:** `campaign_config`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (always 'default') |
| announcement_bar | JSONB | Announcement bar configuration |
| promo_card | JSONB | Promo card configuration |
| last_updated | TIMESTAMP | Last update timestamp |

---

## 🛠️ Drizzle Commands

```bash
# Generate migrations from schema changes
npm run db:generate

# Push schema directly to database (no migration files)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

---

## ✅ You're Ready!

Your app is now connected to Supabase PostgreSQL with proper layered architecture:

```
UI → API Route → Service → Repository → Database
```
