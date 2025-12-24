import axios from "axios";

// Create axios instance with default config
export const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      return Promise.reject(new Error("Network error. Please check your connection."));
    }
    
    // Handle API errors
    const message = error.response.data?.error || error.message || "An error occurred";
    return Promise.reject(new Error(message));
  }
);

export default api;
