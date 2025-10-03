/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_OPENAI_API_KEY: string;
  readonly VITE_AZURE_OPENAI_ENDPOINT: string;
  readonly VITE_AZURE_OPENAI_DEPLOYMENT_NAME: string;
  readonly VITE_AZURE_OPENAI_API_VERSION: string;
  readonly VITE_OPENAI_MODEL?: string;
  readonly VITE_USE_MOCK_RESPONSES?: string;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly PROD: boolean;
  // Firebase environment variables
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
