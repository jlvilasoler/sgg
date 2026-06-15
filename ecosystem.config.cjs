/** PM2 en el servidor: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "scg",
      cwd: __dirname,
      script: "server/dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        HOST: "127.0.0.1",
        SCG_TRUST_PROXY: "1",
        SCG_CLIENT_ORIGIN: "https://tu-dominio.com",
      },
    },
  ],
};
