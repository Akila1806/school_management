import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  };
};

// GET /api/students
// GET /api/students/:id
// GET /api/dashboard
export const fetchDataFromApi = async <T = unknown>(url: string): Promise<T> => {
  try {
    const { data } = await axios.get<T>(BASE_URL + url, getAuthHeaders());
    return data;
  } catch (error: unknown) {
    console.error("API Fetch Error:", error);
    if (axios.isAxiosError(error)) return (error.response?.data ?? error) as T;
    throw error;
  }
};

// POST /api/agent
// POST /api/students
// POST /api/dashboard/metrics
export const postData = async <T = unknown>(url: string, formData: unknown): Promise<T> => {
  try {
    const { data } = await axios.post<T>(BASE_URL + url, formData, getAuthHeaders());
    return data;
  } catch (error: unknown) {
    console.error("POST Request Error:", error);
    if (axios.isAxiosError(error)) return (error.response?.data ?? error) as T;
    throw error;
  }
};

// PUT /api/students/:id
export const editData = async <T = unknown>(url: string, updatedData: unknown): Promise<T> => {
  try {
    const { data } = await axios.put<T>(BASE_URL + url, updatedData, getAuthHeaders());
    return data;
  } catch (error: unknown) {
    console.error("Edit Request Error:", error);
    if (axios.isAxiosError(error)) return (error.response?.data ?? error) as T;
    throw error;
  }
};

// DELETE /api/dashboard/cache
export const deleteData = async <T = unknown>(url: string): Promise<T> => {
  try {
    const { data } = await axios.delete<T>(BASE_URL + url, getAuthHeaders());
    return data;
  } catch (error: unknown) {
    console.error("Delete Request Error:", error);
    if (axios.isAxiosError(error)) return (error.response?.data ?? error) as T;
    throw error;
  }
};

// POST /api/export (returns file blob)
export const postBlob = async (url: string, body: unknown): Promise<Blob | null> => {
  try {
    const response = await fetch(BASE_URL + url, {
      method: "POST",
      headers: getAuthHeaders().headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return response.blob();
  } catch (error) {
    console.error("Post Blob Error:", error);
    return null;
  }
};
