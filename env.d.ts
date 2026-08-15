/// <reference types="vite/client" />
/// <reference types="gapi" />
/// <reference types="google.accounts" />

interface Window {
  gapi: typeof gapi;
  google: typeof google;
}
