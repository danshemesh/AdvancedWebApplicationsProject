module.exports = {
  apps: [{
    name: 'rebook-backend',
    script: 'dist/app.js',
    instances: 1,
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000,
    },
  }],
};
