/**
 * API Service for CMR Admin Dashboard
 * Connects to the backend server
 */

// API Configuration - Change this to your server URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let authToken = localStorage.getItem('admin_token') || null;

export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('admin_token', token);
  } else {
    localStorage.removeItem('admin_token');
  }
};

export const getAuthToken = () => authToken;

const getHeaders = (additionalHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...additionalHeaders
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return headers;
};

/**
 * Generic fetch wrapper with error handling
 */
const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: getHeaders(options.headers)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// ==================== AUTH ====================

/**
 * Admin login
 */
export const adminLogin = async (email, password) => {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  
  if (data.token) {
    setAuthToken(data.token);
  }
  
  return data;
};

/**
 * Admin logout
 */
export const adminLogout = () => {
  setAuthToken(null);
};

// ==================== DASHBOARD ====================

/**
 * Get dashboard overview data
 */
export const getDashboardData = async () => {
  return apiRequest('/admin/dashboard');
};

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async () => {
  return apiRequest('/reports/stats/overview');
};

// ==================== REPORTS ====================

/**
 * Get all reports with optional filters
 */
export const getAllReports = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  
  const queryString = params.toString();
  return apiRequest(`/admin/reports${queryString ? `?${queryString}` : ''}`);
};

/**
 * Get aggregated locations (for map and road grouping)
 */
export const getAggregatedLocations = async () => {
  return apiRequest('/reports/aggregated/locations');
};

/**
 * Get report by ID
 */
export const getReportById = async (reportId) => {
  return apiRequest(`/reports/${reportId}`);
};

/**
 * Update report status
 */
export const updateReportStatus = async (reportId, status, notes = '') => {
  return apiRequest(`/reports/${reportId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes })
  });
};

// ==================== POTHOLES ====================

/**
 * Get all pothole detections
 */
export const getPotholeDetections = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.severity) params.append('severity', filters.severity);
  
  const queryString = params.toString();
  return apiRequest(`/admin/potholes${queryString ? `?${queryString}` : ''}`);
};

/**
 * Get potholes grouped by road/location
 */
export const getPotholesGroupedByRoad = async () => {
  return apiRequest('/admin/potholes/grouped');
};

// ==================== CONTRACTORS ====================

/**
 * Get all contractors
 */
export const getContractors = async () => {
  return apiRequest('/admin/contractors');
};

/**
 * Create a new contractor
 */
export const createContractor = async (contractorData) => {
  return apiRequest('/admin/contractors', {
    method: 'POST',
    body: JSON.stringify(contractorData)
  });
};

/**
 * Update contractor
 */
export const updateContractor = async (contractorId, data) => {
  return apiRequest(`/admin/contractors/${contractorId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

// ==================== ASSIGNMENTS ====================

/**
 * Assign location/potholes to contractor
 */
export const assignToContractor = async (assignmentData) => {
  return apiRequest('/admin/assign', {
    method: 'POST',
    body: JSON.stringify(assignmentData)
  });
};

/**
 * Batch assign multiple locations to contractor
 */
export const batchAssignToContractor = async (locationIds, contractorId, dueDate, notes) => {
  return apiRequest('/admin/assign/batch', {
    method: 'POST',
    body: JSON.stringify({ locationIds, contractorId, dueDate, notes })
  });
};

/**
 * Get all assignments
 */
export const getAssignments = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.contractorId) params.append('contractorId', filters.contractorId);
  
  const queryString = params.toString();
  return apiRequest(`/admin/assignments${queryString ? `?${queryString}` : ''}`);
};

// ==================== VERIFICATION ====================

/**
 * Verify completed work
 */
export const verifyWork = async (locationId, verificationData) => {
  return apiRequest(`/admin/verify/${locationId}`, {
    method: 'POST',
    body: JSON.stringify(verificationData)
  });
};

/**
 * Batch verify multiple locations
 */
export const batchVerifyWork = async (locationIds, notes = '') => {
  return apiRequest('/admin/verify/batch', {
    method: 'POST',
    body: JSON.stringify({ locationIds, notes })
  });
};

/**
 * Reject verification (needs rework)
 */
export const rejectVerification = async (locationId, reason) => {
  return apiRequest(`/admin/verify/${locationId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
};

// ==================== USERS ====================

/**
 * Get all users
 */
export const getAllUsers = async () => {
  return apiRequest('/admin/users');
};

// ==================== MAP DATA ====================

/**
 * Get map points for visualization
 */
export const getMapPoints = async () => {
  return apiRequest('/admin/map/points');
};

/**
 * Get heatmap data
 */
export const getHeatmapData = async () => {
  return apiRequest('/admin/map/heatmap');
};

// ==================== HISTORY ====================

/**
 * Get verified/completed repairs history
 */
export const getRepairHistory = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.roadName) params.append('roadName', filters.roadName);
  
  const queryString = params.toString();
  return apiRequest(`/admin/history${queryString ? `?${queryString}` : ''}`);
};

export default {
  // Auth
  adminLogin,
  adminLogout,
  setAuthToken,
  getAuthToken,
  
  // Dashboard
  getDashboardData,
  getDashboardStats,
  
  // Reports
  getAllReports,
  getAggregatedLocations,
  getReportById,
  updateReportStatus,
  
  // Potholes
  getPotholeDetections,
  getPotholesGroupedByRoad,
  
  // Contractors
  getContractors,
  createContractor,
  updateContractor,
  
  // Assignments
  assignToContractor,
  batchAssignToContractor,
  getAssignments,
  
  // Verification
  verifyWork,
  batchVerifyWork,
  rejectVerification,
  
  // Users
  getAllUsers,
  
  // Map
  getMapPoints,
  getHeatmapData,
  
  // History
  getRepairHistory
};
