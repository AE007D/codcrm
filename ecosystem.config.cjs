module.exports = {
  apps: [
    {
      name: "crm",
      script: "node_modules/.bin/next",
      args: "dev",
      cwd: "/Users/ayoubelkihel/Desktop/codcrm",
      watch: false,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
    },
    {
      name: "wa-server",
      script: "whatsapp-server/server.js",
      cwd: "/Users/ayoubelkihel/Desktop/codcrm",
      interpreter: "node",
      watch: false,
      autorestart: true,
      max_restarts: 50,
      restart_delay: 4000,
      env: {
        NODE_ENV: "production",
        CRM_URL: "http://127.0.0.1:3000",
        WA_INTERNAL_TOKEN: "codcrm-wa-secret-2024",
      },
    },
  ],
};
