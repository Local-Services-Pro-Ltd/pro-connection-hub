import "@tanstack/router-core";

// The app's route boundaries intentionally render Error instances. Keep that
// contract explicit after the router made its default error type unknown.
declare module "@tanstack/router-core" {
  interface ErrorBoundaryTypes {
    error: Error;
  }
}

export {};
