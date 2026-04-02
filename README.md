# 🎨 Frontend - Campaign Admin Panel

Next.js React application for campaign management UI.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

3. Run development server:
```bash
npm run dev
```

Frontend runs on http://localhost:3000

## File Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx         ← Main admin page
│   │   ├── layout.tsx       ← Root layout
│   │   └── globals.css      ← Global styles
│   ├── components/          ← React components
│   │   ├── Header.tsx
│   │   ├── Dashboard.tsx
│   │   ├── AnnouncementSection.tsx
│   │   ├── PromoSection.tsx
│   │   ├── SamplePromoTemplates.tsx
│   │   └── Toast.tsx
│   ├── lib/
│   │   └── utils.ts         ← Helper functions
│   └── types/
│       └── campaign.ts      ← TypeScript types
└── package.json
```

## Important

Make sure the backend server is running on port 4000 before starting the frontend!
