declare global {
  namespace App {
    interface PageData {}
    interface Error {
      message?: string;
    }
    interface Locals {}
    interface Platform {}
  }
}

export {};
