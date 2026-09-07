# Shoe Store

Local shoe store MVP scaffold with a React + Vite client and Node.js/Express API.

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL client tools
- PostgreSQL with pgvector for the full RAG setup
- A PostgreSQL database URL in `server/.env` or exported as `DATABASE_URL`
- Optional: `OPENAI_API_KEY` in `server/.env` for AI-ranked product advice
- Optional: `GEMINI_API_KEY` in `server/.env` or deployment environment for RAG embeddings and grounded answers

If `DATABASE_URL` is not set, the API starts with an in-memory demo
database loaded from `database/schema.sql` and `database/seed.sql`. This
is useful for quick local review, but data resets when the server restarts.
If `OPENAI_API_KEY` is not set, product advice still works with the
backend's local filtered fallback response.
Do not commit Gemini or OpenAI keys. Gemini keys belong only in
`server/.env` for local development or in the backend deployment
environment; the frontend must never receive or store `GEMINI_API_KEY`.
When `GEMINI_API_KEY` is missing, RAG stays in a degraded/unconfigured
state: admin RAG checks can show setup gaps and customer chat receives a
graceful fallback response instead of grounded Gemini answers.

## Local URLs

- Frontend: http://161.248.81.90:5173
- Backend: http://161.248.81.90:5000

## Demo Accounts

- Admin: admin@shoestore.local / Admin123!
- Customer: customer@shoestore.local / Customer123!

## Setup

```bash
cd shoe-store
npm install
cp server/.env.example server/.env
```

Edit `server/.env` for local backend configuration. Use local-only
placeholder values first, then replace them outside git:

```env
DATABASE_URL=postgres://...
JWT_SECRET=...
GEMINI_API_KEY=your-gemini-api-key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_CHAT_MODEL=gemini-3.6-flash
RAG_TOP_K=6
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Never commit Gemini keys. Set secrets in `server/.env` locally and in
the deployment environment for production. The frontend must never
receive or store `GEMINI_API_KEY`. If `GEMINI_API_KEY` is empty, the
admin RAG page may show an unconfigured/degraded status and customers
will receive a graceful fallback response from chat.

To upload product images from the admin product form, configure the three
Cloudinary variables above in `server/.env`. The backend signs uploads, while
the browser sends image files directly to Cloudinary and stores only the
returned URL and public ID in PostgreSQL.

Set up the database and start the app:

```bash
npm run db:setup
npm run dev
```

For quick UI review without PostgreSQL, skip `server/.env` and
`npm run db:setup`, then run:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm test
npm run build
npm run db:setup
```

- Health check: `GET /api/health`

## RAG Admin Workflow

The Gemini/RAG integration stores product and policy knowledge in
PostgreSQL tables backed by pgvector embeddings. After `npm run db:setup`
has created the schema and seeded local data, sign in with the demo admin
account and open `/admin/rag`.

From the "Kho tri thức AI" page, admins can:

- Review the overview counters for policy documents, active chunks and
  entries that need reindexing.
- Create or edit policy documents such as returns, shipping, warranty,
  terms and size guidance.
- Reindex one document after changing its content, or run a full reindex
  after product/catalog changes.
- Test grounded answers with prompts such as `Shop đổi trả thế nào?`.

Customer chat at `/api/ai/chat` uses the same RAG context. With Gemini
configured and the RAG tables indexed, a prompt such as `giày leo núi nam
dưới 3 triệu` should return trail/outdoor products and sources from the
knowledge base.
