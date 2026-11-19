# Morzsa web on CloudFront

This is an additive static-hosting deployment. Cognito, API Gateway, Lambda,
DynamoDB and private recipe/step images retain their existing backend. GitHub
Pages remains available during the transition.

The template creates a private, encrypted S3 bucket, signed CloudFront Origin
Access Control, HTTPS distribution, response security headers and a GitHub OIDC
publish role. The role can publish only to this bucket and invalidate this
specific distribution; its trust is restricted to szambaik/morzsa main.
The distribution uses PriceClass_100. It does not buy provisioned capacity,
WAF or Shield Advanced. Standard CloudFront/S3 usage is billed against the
account's applicable allowances; actual charges depend on traffic and credits.

The existing **Audit regression gate** remains mandatory. The CloudFront job
consumes the same github-pages artifact as the Pages job and validates its
revision and audit marker before uploading. Hashed assets upload before HTML;
old filenames remain available for already loaded clients. Every release
invalidates one wildcard path. Index, manifest and version responses must
revalidate; hashed filenames may be cached for a year; other assets for an hour.

The GitHub repository variables are AWS_FRONTEND_ROLE_ARN,
AWS_FRONTEND_BUCKET, and AWS_FRONTEND_DISTRIBUTION. With no configured role,
the new hosting job waits for provisioning while the existing Pages gate works.
No long-term AWS credential is stored in GitHub.

Before serving an authenticated app on the new URL, set the backend stack's
FrontendOrigin parameter to the exact HTTPS origin. This additive parameter
configures API/auth/AI CORS, Cognito callback/logout URLs and S3 image CORS.
Existing web and native origins remain accepted; arbitrary CloudFront hosts
are never trusted. The Google provider's /oauth2/idpresponse redirect does not
change. A session on github.io is not automatically shared with cloudfront.net;
Google login on the new origin resolves to the same application account and data.

Recipe generation runs independently from chat. Within one client, image
creation is queued; up to four cache reads run concurrently. Existing recipe
and step images remain persistently cached in backend S3 and recipe records.
The device caches metadata in IndexedDB and image blobs for seven days, scoped
to the account/household. This first distribution hosts only public frontend
assets. It does not expose private images or cache authenticated API replies.

## Current deployment

The deployment identifiers are recorded in deployment.json. The web entry point
is https://d149jrhkz4lpb2.cloudfront.net/ . The backend stack uses that exact
FrontendOrigin, preserving the previous Pages and native login callbacks.

This account's organization policy explicitly denies GitHub OIDC administration.
The frontend stack therefore uses EnableGitHubPublisher=false. Static hosting
and cache still work; automatic GitHub-to-AWS publishing is not enabled. Pages
continues its automatic protected release. Do not store permanent AWS keys in
GitHub to work around this restriction.

A signed-in local morzsa profile can publish the artifact from a successful main
Audit regression gate with deploy.mjs. Set AWS_PROFILE=morzsa,
AWS_FRONTEND_BUCKET and AWS_FRONTEND_DISTRIBUTION from deployment.json, and
GITHUB_SHA to the exact verified artifact revision. Pass the extracted artifact
directory as the script argument. The script refuses an unverified artifact or a
revision mismatch. No rebuild is needed or permitted in this publish step.

If organization policy later permits GitHub OIDC, update the frontend stack with
EnableGitHubPublisher=true, supplying an existing provider ARN when appropriate,
and configure the three repository variables from the stack outputs. Subsequent
main releases then publish the same audit-approved artifact automatically.
