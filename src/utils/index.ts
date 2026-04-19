export const ui_base_url = process.env.UI_BASE_URL || 'http://localhost:4000';
export const admin_ui_base_url =
  process.env.ADMIN_UI_BASE_URL || 'http://localhost:4010';
export const studio_ui_base_url =
  process.env.STUDIO_UI_BASE_URL || 'http://localhost:4020';
export const api_base_url = process.env.API_BASE_URL || 'http://localhost:3000';

/** Origins allowed for Socket.IO (align with HTTP CORS in `main.ts`). */
export const socket_io_cors_origins = [
  ...new Set([
    ui_base_url,
    admin_ui_base_url,
    studio_ui_base_url,
    'http://localhost:4000',
    'http://localhost:4010',
    'http://localhost:4020',
  ]),
];

