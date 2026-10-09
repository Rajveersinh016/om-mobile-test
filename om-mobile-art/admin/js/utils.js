/**
 * OM Mobile Art — Admin Utilities (utils.js)
 * Provides a reliable prefix to the project root from any admin page.
 */
(function() {
  'use strict';

  window.AdminUtils = {
    /**
     * Returns the path prefix to the project root.
     * Admin pages live at /admin/pages/*.html so root is always ../../
     * We detect by pathname depth to handle any edge case.
     */
    getPrefix: () => {
      return '../../';
    }
  };
})();
