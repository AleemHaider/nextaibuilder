// nextaibuilder — PM2 Ecosystem Configuration
// FIR-83
//
// Used for bare-metal EC2 deployments (non-Docker).
// The Docker Compose deployment (current DEV setup) does not use PM2.
//
// Start:   pm2 start ecosystem.config.cjs
// Reload:  pm2 reload ecosystem.config.cjs --update-env
// Save:    pm2 save
// Startup: pm2 startup  (run the printed command with sudo)

module.exports = {
  apps: [
    {
      name: 'nab-api',
      // Entry point: compiled TypeScript output (tsc → dist/index.js)
      script: 'node',
      args: 'dist/index.js',
      cwd: '/var/www/nextaibuilder/apps/api',

      // Cluster mode: 2 instances for zero-downtime reload + basic HA
      // Set to 'max' to use all CPU cores on larger instances
      instances: 2,
      exec_mode: 'cluster',

      // Restart if process exceeds 512 MB (guards against memory leaks)
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'production',
        // API runs on port 4000; Nginx on the host proxies /api/* and /socket.io/* to it
        PORT: 4000,
      },

      // Log files — directory must exist (created by ec2-setup.sh)
      error_file: '/var/log/pm2/nab-api-error.log',
      out_file: '/var/log/pm2/nab-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Delay between restarts to avoid hammering MongoDB/Redis on crash loops
      restart_delay: 3000,
      max_restarts: 10,

      // Disable file watching in production (use pm2 reload for deploys)
      watch: false,
    },
  ],
}
