const { getConfig } = require('./config');
const { getToken, clearSession } = require('./session');

let onUnauthorizedCallback = null;

function setOnUnauthorized(cb) {
  onUnauthorizedCallback = cb;
}

/**
 * Performs an HTTP request against the API server
 * @param {Object} options
 * @param {string} options.method - 'GET', 'POST', 'PATCH', 'DELETE'
 * @param {string} options.path - e.g. '/api/materials'
 * @param {Object} [options.body]
 * @param {Object} [options.query]
 * @returns {Promise<any>}
 */
async function request({ method = 'GET', path, body, query }) {
  const config = getConfig();
  let url = `${config.API_BASE_URL.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

  if (query && Object.keys(query).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        searchParams.append(k, String(v));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const headers = {
    'Accept': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let requestBody = undefined;
  if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: requestBody,
    });
  } catch (netErr) {
    throw {
      code: 'NETWORK_ERROR',
      message: `Failed to connect to server at ${config.API_BASE_URL}: ${netErr.message}`,
      status: 0,
    };
  }

  if (res.status === 401) {
    clearSession();
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  }

  const contentType = res.headers.get('content-type') || '';
  let responseData = null;
  if (contentType.includes('application/json')) {
    responseData = await res.json();
  } else {
    responseData = await res.text();
  }

  if (!res.ok) {
    const errorObj = responseData && responseData.error
      ? responseData.error
      : {
          code: `HTTP_${res.status}`,
          message: typeof responseData === 'string' ? responseData : res.statusText,
          status: res.status,
        };
    errorObj.status = res.status;
    throw errorObj;
  }

  return responseData;
}

module.exports = {
  request,
  setOnUnauthorized,
};

