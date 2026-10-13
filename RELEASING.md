# Releasing

ReAgent is published to npm by GitHub Actions when a **GitHub Release** is
published. The release tag must be `v<version>` and must match the `version` in
`package.json`.

The release workflow (`.github/workflows/publish.yml`) authenticates to npm with
**trusted publishing (OIDC)** — there is no long-lived npm token stored in the
repository — and attaches a signed provenance attestation.

## One-time setup

These steps are done once, after which every release publishes automatically.

1. **First publish** (creates the package on npm). Run locally:

   ```bash
   pnpm publish --access public --no-git-checks
   ```

   npm will ask for your two-factor one-time password.

2. **Register the trusted publisher** so the release workflow may publish:

   ```bash
   npm trust github @liyu1981/reagent \
     --file publish.yml \
     --repo liyu1981/reagent \
     --allow-publish
   ```

   Confirm it was recorded:

   ```bash
   npm trust list @liyu1981/reagent
   ```

   > Alternative: create a granular npm access token that bypasses 2FA, store it
   > as the `NPM_TOKEN` repository secret, and pass it to the publish step as
   > `NODE_AUTH_TOKEN`. Trusted publishing is preferred: nothing to leak or
   > rotate, and provenance is automatic.

3. **GitHub Pages** is deployed by `.github/workflows/deploy-pages.yml` on every
   push to `main`. Enable it once under **Settings → Pages → Build and
   deployment → Source: GitHub Actions**.

## Cutting a release

```bash
# 1. Bump the version and commit it.
npm version patch --no-git-tag-version   # or minor / major
git commit -am "chore: release v$(node -p "require('./package.json').version")"
git push

# 2. Create the GitHub Release. This triggers the publish workflow.
gh release create "v$(node -p "require('./package.json').version")" --generate-notes
```

The workflow then installs, typechecks, builds, checks the tag against
`package.json`, and runs `npm publish --access public --provenance`.

## Manual publish

A maintainer can always publish by hand (needs the 2FA password):

```bash
pnpm publish --access public --no-git-checks
```
