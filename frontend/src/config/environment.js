// Environment configuration for different deployment environments

const getEnvironmentConfig = () => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return {
      backendUrl: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001',
      environment: 'server'
    };
  }

  // Get environment from build-time variables
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  const nodeEnv = process.env.NODE_ENV;
  const hostname = window.location.hostname;
  
  // Determine environment and backend URL
  let finalBackendUrl;
  let environment;

  if (backendUrl) {
    // Explicit backend URL set
    finalBackendUrl = backendUrl;
    environment = nodeEnv || 'production';
  } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Local development
    finalBackendUrl = 'http://localhost:8001';
    environment = 'development';
  } else {
    // Production deployment - use same origin (Kubernetes ingress routing)
    finalBackendUrl = window.location.origin;
    environment = 'production';
  }

  return {
    backendUrl: finalBackendUrl,
    environment,
    isProduction: environment === 'production',
    isDevelopment: environment === 'development',
    hostname
  };
};

export const ENV_CONFIG = getEnvironmentConfig();

// For debugging in development
if (ENV_CONFIG.isDevelopment) {
  console.log('Environment Config:', ENV_CONFIG);
}