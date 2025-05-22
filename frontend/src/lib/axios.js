import axios from "axios";

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api";

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper function to get token from cookies
const getTokenFromCookies = () => {
  const cookies = document.cookie.split("; ");
  const jwtCookie = cookies.find((row) => row.startsWith("jwt="));
  return jwtCookie ? jwtCookie.split("=")[1] : null;
};

// Add a request interceptor to add the token to requests
axiosInstance.interceptors.request.use(
  (config) => {
    // Skip token check for login and signup endpoints
    if (config.url.includes('/auth/login') || config.url.includes('/auth/signup')) {
      console.log("Skipping token check for auth endpoints");
      return config;
    }
    
    // Get token from multiple sources
    let token = getTokenFromCookies();
    if (!token) {
      token = localStorage.getItem("token");
    }

    if (token) {
      console.log("Adding token to request:", config.url);
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log("No token found for request:", config.url);
    }
    
    return config;
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token updates
axiosInstance.interceptors.response.use(
  (response) => {
    console.log("Response from:", response.config.url, {
      status: response.status,
      headers: response.headers
    });
    
    let token = null;
    
    // 1. Try to get token from Authorization header
    const authHeader = response.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
      console.log("Found token in Authorization header");
    }
    
    // 2. Try to get token from response data
    if (!token && response.data && response.data.token) {
      token = response.data.token;
      console.log("Found token in response data");
    }
    
    // If we found a token, store it
    if (token) {
      console.log("Storing new token");
      localStorage.setItem("token", token);
      
      // Update Authorization header for future requests
      axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    
    return response;
  },
  (error) => {
    // Log detailed error information
    console.error("Response error for URL:", error?.config?.url, {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      message: error.message
    });
    
    // Handle 401 Unauthorized errors
    if (error?.response?.status === 401) {
      console.log("Authentication error (401) - redirecting to login");
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    
    return Promise.reject(error);
  }
);
