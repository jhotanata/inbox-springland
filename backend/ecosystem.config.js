module.exports = {
  apps: [
    {
      name: 'inbox-backend',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/inbox/error.log',
      out_file: '/var/log/inbox/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
