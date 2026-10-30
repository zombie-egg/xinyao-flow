# Tencent Cloud deployment

Application server: `82.157.149.167`. HTTPS domain: `xinyao.alag.cn`.

PostgreSQL and uploads migrated to this server on 2026-10-30. The application
uses local PostgreSQL 16.14 through `127.0.0.1:15433`. The Docker container is
`xinyao-postgres`, with persistent data in `/var/lib/xinyao/postgres`.
Uploads are local in `/var/lib/xinyao/uploads`, mounted as `/data/uploads`.
The application no longer depends on the original server or SSHFS.

The original database and uploads remain preserved on `101.32.241.158`, in
namespace `environment-6a7da4faf8fa433a2b5dfa7b`. Its application now only redirects
to the new HTTPS site; its attendance CronJob is suspended. The second namespace
is untouched. Keep the original server running to preserve that URL redirect;
the new site itself operates independently of it.

Service units: `xinyao-app`, `xinyao-postgres`, `nginx`, and
`xinyao-attendance-close.timer` (every five minutes, matching the original task).
`xinyao-db-tunnel` and `xinyao-uploads` are disabled. The migration SSH key is retired.
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

The previous Zeabur deployment workflow is removed. Legacy database audit/import/repair
workflows still reference the original server and must remain disabled until they
are explicitly adapted to the new environment. Application deployment does not invoke them.

The final logical dump, attachment archive, and source/target verification manifests
are retained on both servers under `/home/ubuntu/xinyao-full-migration-20261030`.
Verification matched all 26 tables, 288 columns, 75 indexes, and every one of the
371 uploaded files. No application schema migration or seed was run during cutover.
Original deployment and scheduler manifests are saved on the original server in
the same backup directory. Pre-cutover application configuration and units are
saved on the new server in `/etc/xinyao/pre-local-migration`.
