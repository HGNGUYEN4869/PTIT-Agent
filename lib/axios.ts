import axios from "axios"

export const api = axios.create({
  // baseURL: "http://172.16.6.91:2009",
  baseURL: "http://172.16.5.10:2004",
  headers: {
    "accept": "application/json",
    "Content-Type": "application/json",
  },
})
