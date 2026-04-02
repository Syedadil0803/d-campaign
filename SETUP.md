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

## 3️⃣ Run Database Migration

Run the SQL migration file in your Supabase dashboard:

1. Go to Supabase Dashboard → SQL Editor
2. Copy the content from `migrations/001_initial_schema.sql`
3. Paste and run it

This will:
- Create the `Dynamic_campaign` schema
- Create the `campaign_config` table
- Insert default configuration

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
