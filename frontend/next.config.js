// This file helps Vercel understand this is a React SPA
module.exports = {
  trailingSlash: true,
  exportPathMap: function() {
    return {
      '/': { page: '/' }
    };
  }
};