Build a production-ready Lead Management & Cold Outreach System as a full-stack web application. This is NOT a prototype — it must be fully functional, bug-free, and ready to use from day one.

## CORE FEATURES

### 1. Lead Input & Management
- Add leads manually: Business Name, Website URL, City, Niche/Industry, Contact Email
- Bulk CSV import support
- Lead list with search and filter (by status, city, niche)
- Delete / archive leads

### 2. AI Website Analysis
- When a lead is added with a website URL, system fetches and analyzes the website
- AI analyzes: design quality, missing features, SEO issues, speed issues, no chatbot, outdated design
- Shows a "pain points" summary per lead — what problems their website has
- This analysis is used to personalize the cold email

### 3. Personalized Cold Email Generation
- Using the pain points from website analysis, AI generates a personalized cold email for each lead
- Email should sound human, not AI-generated — conversational, short, benefit-focused
- Template variables: business name, specific problem found, proposed solution, CTA
- User can edit generated email before sending
- One-click regenerate option

### 4. Email Sending
- Integrate with SMTP (user provides their Gmail SMTP or any SMTP credentials in settings)
- Send email directly from the app
- Support for follow-up emails (Day 3, Day 7 follow-ups) — manual trigger
- Sending queue — don't spam, add delay between emails

### 5. Tracking & Pipeline
- Track each lead status: New → Analyzed → Email Sent → Followed Up → Replied → Converted
- Dashboard showing: total leads, emails sent, reply rate, conversion rate
- Mark replied manually (no email parsing needed)
- Notes field per lead for manual updates
- Simple Kanban-style or table view pipeline

### 6. Settings Page
- SMTP configuration (host, port, email, password)
- AI API key input (Anthropic Claude)
- Default email sender name and signature
- Follow-up delay settings

## TECH STACK
- Frontend: Next.js 16 with TypeScript
- Backend: Next.js API routes
- Database: SQLite with Prisma ORM (local, no external DB needed)
- AI: Anthropic Claude API (claude-sonnet-4-20250514)
- Email: Nodemailer with SMTP
- Styling: Tailwind CSS

## UI REQUIREMENTS — VERY IMPORTANT
- Clean, modern, dark theme dashboard (NOT purple gradients, NOT generic shadows)
- Professional SaaS look — think Linear.app or Vercel dashboard aesthetic
- Sharp typography — use a distinctive font, NOT Inter or Arial
- Sidebar navigation with icons
- Data tables with proper spacing, hover states, action buttons
- Status badges with clear color coding
- Responsive but desktop-first (this is a desktop tool)
- NO generic AI aesthetics — every component should look intentionally designed
- Smooth transitions, subtle animations on state changes
- Empty states with helpful messages (no blank white screens)

## CODE QUALITY REQUIREMENTS
- All TypeScript types properly defined — no "any" types
- Error handling on every API call — show user-friendly error messages, never crash
- Loading states on all async operations
- Form validation with clear error messages
- Environment variables for all secrets (.env.local)
- Prisma schema with proper relations
- API routes properly structured with error responses
- No console.log left in production code
- Comments on complex logic

## FOLDER STRUCTURE
Follow Next.js 14 app router conventions:
- /app for pages and layouts
- /app/api for API routes
- /components for reusable UI components
- /lib for utilities, db client, AI client
- /prisma for schema

## WHAT NOT TO DO
- No mock data that doesn't get replaced with real data
- No "coming soon" placeholder features — either build it or don't include it in UI
- No broken navigation links
- No unstyled default HTML elements
- No hardcoded API keys in code

## STARTING POINT
Begin with:
1. Project setup with all dependencies
2. Prisma schema and database setup
3. Basic layout with sidebar navigation
4. Lead CRUD operations
Then build features in order listed above.

Start by creating the project and confirm the folder structure before writing any feature code.