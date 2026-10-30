# Tencent Cloud deployment

Application server: `82.157.149.167`. HTTPS domain: `xinyao.alag.cn`.

PostgreSQL remains on `101.32.241.158`, in the existing Zeabur namespace
`environment-6a7da4faf8fa433a2b5dfa7b`. The second namespace is untouched.
The new application uses an SSH tunnel bound to `127.0.0.1:15432`.
Uploads use the original persistent directory through SSHFS, so both sites see
the same attachments. The original server must remain online.

The original application and attendance scheduler remain running. Do not add a
second attendance scheduler. Normal business operations through either site
use the same live database and files.

Service units: `xinyao-app`, `xinyao-db-tunnel`, `xinyao-uploads`, `nginx`.
Secrets are root-readable under `/etc/xinyao`; no application secrets belong in Git.
`APP_URL` must be `https://xinyao.alag.cn` so authentication redirects use the
public origin behind Nginx. Nginx also rewrites legacy redirects from
`localhost:8080` to the public HTTPS origin. Verify `/` with redirects enabled,
as testing `/login` alone does not exercise the authentication redirect.

Pushes to `main` deploy only the application. A restricted SSH key stored in
the GitHub secret `TENCENT_DEPLOY_KEY` can invoke only the deployment gateway.
Builds use separate release directories. A failed build keeps the current
application running; a failed startup restores the preceding release.
Database migrations, seeding, restoration, and database restarts are excluded.
Any future schema change requires separate explicit authorization.

Server helpers are installed as `/usr/local/sbin/xinyao-deploy` and
`/usr/local/sbin/xinyao-deploy-gateway`, from the scripts in this directory.
These installed helpers must be updated deliberately when their source changes.
Older releases are retained under `/opt/xinyao-releases`.

The previous Zeabur deployment workflow is removed. Database audit/import/repair
workflows retain their original target and are never invoked by application deployment.
