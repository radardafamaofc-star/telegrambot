[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Migrate Supabase to Neon Postgres
  [x] 1. Move Supabase client calls to the server, use server-side PostgreSQL queries with Drizzle
  [x] 2. Port Supabase Edge Functions into a server route
  [x] 3. Secure API keys & env vars - TELEGRAM_API_ID and TELEGRAM_API_HASH moved to secrets, code updated to read from env
  [x] 4. Push the database schema using `npm run db:push`
  [x] 5. Remove Supabase code
[x] 4. Verify the project is working using the feedback tool
[x] 5. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] 6. Environment compatibility check
[x] 7. Common security vulnerability check
[x] 8. Client/server separation validation
[x] 9. Secrets & sensitive information management
[x] 10. Deployment configuration audit
