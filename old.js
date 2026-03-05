const stagingApi = {
  ENDPOINTS: {
    TEXTRACT: 'https://9ons2gxhza.execute-api.us-east-1.amazonaws.com/staging/textract',
    SELFIE: 'https://9ons2gxhza.execute-api.us-east-1.amazonaws.com/staging/selfie',
    UNITI_API_BASE_URL: 'https://api-qa.unitinetworks.com'
  },
  KEYS: {
    API_KEY: 'VxL0yfeouT1GHV4MpBEN379T6HpMjn6c3WeTWavM',
    UNITI_CLIENT_TOKEN: '8pYNHgfns6vLqDRe2gC3nIcTV03zFe2CZHfx7lbxr0Tw2uzlJUhYw3gjNjAwiPrP'
  },
  FIRESTORE: {
    COLLECTIONS: {
      APP_USAGE_EVENTS: 'app_usage_events'
    }
  }
};

const prodApi = {
  ENDPOINTS: {
    TEXTRACT: 'https://91ohru6lw5.execute-api.us-east-1.amazonaws.com/prod/textract',
    SELFIE: 'https://91ohru6lw5.execute-api.us-east-1.amazonaws.com/prod/selfie',
    UNITI_API_BASE_URL: 'https://api.unitinetworks.com'
  },
  KEYS: {
    API_KEY: 'VxL0yfeouT1GHV4MpBEN379T6HpMjn6c3WeTWavM',
    UNITI_CLIENT_TOKEN: '2h32vIKiCHasRUTbGwvngqNrQJMrFsI3KtRZsC70Ed1Ho4S6arMW06bsy8ZbqrxP'
  },
  FIRESTORE: {
    COLLECTIONS: {
      APP_USAGE_EVENTS: 'app_usage_events_prod'
    }
  }
}

// API configuration
const appEnv = (Config.APP_ENV || "staging").toLowerCase();
export const API = appEnv === "production" ? prodApi : stagingApi;
