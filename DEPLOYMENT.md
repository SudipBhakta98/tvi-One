# TVI One cost-efficient deployment profile

For ~50 active users, keep the architecture intentionally small:

- **Frontend:** deploy `frontend/dist` to a static host/CDN (or serve it from the same container during a pilot). Vite produces immutable hashed assets that are cheap to cache.
- **API:** one Node/Express instance is sufficient for normal departmental ERP traffic. Use the included multi-stage Dockerfile.
- **MongoDB:** one shared MongoDB/Atlas deployment with a small connection pool (`MONGO_MAX_POOL_SIZE=8` by default). Do not create separate finance connections.
- **Caching:** dashboard aggregates use a 10-second process-local cache; module contexts use a 15-second client cache. This is intentionally dependency-free to keep the bundle and operational cost low.
- **Compression:** Express compression is enabled for lower bandwidth/egress.
- **Indexes:** report/dashboard date/status and common relationship fields have compound indexes. In production, `autoIndex` is disabled; run index creation during controlled deployments/migrations.
- **Scaling:** if usage grows beyond a single API instance, move the dashboard cache to Redis only then; do not pay the complexity/cost before it is needed.

Required production secrets are supplied through the environment rather than committed files.
