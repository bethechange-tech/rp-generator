import axios from "axios";

export class ApiClientFactory {
  private static instance: ReturnType<typeof axios.create> | null = null;

  static get() {
    if (!this.instance) {
      this.instance = axios.create({
        baseURL: "/api",
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
        },
      });

      this.instance.interceptors.response.use(
        (response) => response,
        (error) => {
          if (!error.response) {
            return Promise.reject(
              new Error("Network error. Please check your connection.")
            );
          }

          const message =
            error.response.data?.error || error.message || "An error occurred";
          return Promise.reject(new Error(message));
        }
      );
    }

    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}
