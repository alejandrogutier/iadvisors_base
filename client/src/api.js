import axios from 'axios';

const apiBase = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({
  baseURL: apiBase
});

export default api;
