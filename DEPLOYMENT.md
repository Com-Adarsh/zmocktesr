# Deployment

## Supabase

1. Create a separate development/staging Supabase project.
2. Review and apply the versioned migration in `supabase/migrations/`.
3. Configure Auth email/redirect settings for the staging host, including the invitation redirect.
4. Configure the private `question-source-files` storage bucket policy. The current UI imports JSON directly; source-file storage is reserved and is not exposed as a file-upload workflow.
5. Configure Vercel environment variables from `.env.example`: public project URL and anon key, the deployment's HTTPS `NEXT_PUBLIC_SITE_URL`, plus the server-only service-role key for administrator invitations.
6. Bootstrap the first administrator from the trusted Supabase SQL editor as described in [ADMIN_GUIDE.md](ADMIN_GUIDE.md).

## Vercel

Import `Com-Adarsh/ZMock-test-` into Vercel with the Next.js framework preset and the repository root as the Root Directory. Set environment variables separately for Preview and Production. Do not use production credentials for preview deployments.

The tracked `vercel.json` explicitly selects Next.js, installs the lockfile with `npm ci`, builds with `npm run build`, and uses `.next` as the build output. This prevents an older project's "Other" preset or static output override from silently serving an empty/static deployment. Do not add a catch-all rewrite to `index.html`; this app requires Next.js server routes.

Use Node.js 22.x for the same runtime as the build workflow. The workflow runs the regression tests and a production build on pull requests and pushes to `main` or `fix/**` branches; it does not configure a database or Vercel domain.

### If the URL returns Vercel `404 NOT_FOUND`

This platform error is distinct from an application exception. A successful GitHub Vercel status alone does not prove that the intended production domain serves the app.

1. Open the Vercel deployment linked from the latest commit's status. During the 19 October 2026 investigation, the linked project was `catmocktest`, while `https://sficusatcatmocktest.vercel.app/` returned Vercel's `404 NOT_FOUND` page.
2. Verify that the project's Git repository is `Com-Adarsh/ZMock-test-`, the Production Branch is `main`, and the Root Directory is the repository root (leave it empty), not `app` or `public`.
3. Deploy the commit containing `vercel.json`. In the build log, confirm that `next build` runs and produces the `/`, `/login`, `/courses` and API routes. If the root is wrong, correct it in project settings first.
4. In Settings > Domains, verify that `sficusatcatmocktest.vercel.app` belongs to this project and is assigned to Production. If it belongs to another project, resolve that ownership/assignment in Vercel rather than guessing a replacement URL.
5. Verify the ready deployment is assigned to Production, then test both its deployment URL and the intended domain. A working deployment URL with a failing domain points to domain assignment; two failing URLs require checking the build/output settings and deployment logs.

Missing Supabase variables intentionally produce a setup notice. They do not explain a Vercel platform 404. Once the URL serves the app, configure Supabase and apply the migration to a reviewed staging database before testing the complete exam workflow.

Validate sign-in, invitation, RLS boundaries, course publishing, test-code validation, import, attempt limits, autosave, expiry submission, scoring and release controls on a non-production project before enabling production traffic.

## Rollback

Keep existing hosting and production services unchanged during development. For an application-only rollback, restore the prior deployment. Treat schema rollback separately: take a backup and use a reviewed forward migration or restore plan; do not delete user data or reset the database as a deployment shortcut.

No deployment, production environment, DNS, live database or user data has been changed by this repository work.
