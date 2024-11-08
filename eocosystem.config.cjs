module.exports = {
  apps: [
    {
      name: "bree-api",
      script: "npm start",
      port: 3000,
      cwd: "./",

      env: {
        NODE_ENV: "production",
        // VITE_API_BASE_URL: "https://bree.social/api",
      },

      // Process management
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,

      // Logging
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",

      max_memory_restart: "1G", // Restart if memory usage exceeds 1GB
    },
  ],
};
