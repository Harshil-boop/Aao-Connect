/**
 * Centralized API utility for handling API requests across local and production environments.
 * 
 * In development: Uses relative paths (e.g. '/api/...') proxied by Vite to http://localhost:5000.
 * In production: Uses VITE_API_URL (e.g. 'https://your-backend.onrender.com') if specified,
 *                or falls back to relative paths if using same-origin or reverse proxy (vercel rewrites).
 */

const RAW_API_URL = import.meta.env.VITE_API_URL || '';
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

/**
 * Returns the fully qualified URL for an API endpoint.
 * @param {string} endpoint - e.g. '/api/submissions' or '/api/admin/login'
 * @returns {string} - e.g. 'https://backend.com/api/submissions' or '/api/submissions'
 */
export const getApiUrl = (endpoint = '') => {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
};

/**
 * Safely parses response body without crashing on non-JSON payloads (e.g. HTML 404 / 502 error pages).
 */
export const parseResponseBody = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    const text = await response.text();
    return { _rawText: text };
  } catch {
    return null;
  }
};

/**
 * Universal API fetch wrapper with automated error handling and URL resolution.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = getApiUrl(endpoint);

  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new Error(
      'Unable to connect to the backend server. Please verify your connection or check that the backend is running.'
    );
  }

  const data = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Backend API endpoint '${endpoint}' was not found (404). Please ensure the backend server is deployed and running, and VITE_API_URL is configured.`
      );
    }

    const message =
      (data && data.message) ||
      (data && data._rawText && data._rawText.length < 200 ? data._rawText : null) ||
      `Server returned error ${response.status} (${response.statusText})`;

    const error = new Error(message);
    if (data && data.errors) {
      error.errors = data.errors;
    }
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

