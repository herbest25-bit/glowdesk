module.exports = {
  apps: [
    {
      name: 'glowdesk-backend',
      cwd: './backend',
      script: 'src/index.js',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: { NODE_ENV: 'development' }
    },
    {
      name: 'glowdesk-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: { NODE_ENV: 'development' }
    }
  ]
}
