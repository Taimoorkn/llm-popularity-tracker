import FingerprintJS from '@fingerprintjs/fingerprintjs';

class FingerprintService {
  constructor() {
    this.fpPromise = null;
    this.cachedFingerprint = null;
    this.storageKey = 'llm-tracker-fingerprint';
  }

  async initialize() {
    if (!this.fpPromise) {
      this.fpPromise = FingerprintJS.load();
    }
    return this.fpPromise;
  }

  async getFingerprint() {
    // Return cached fingerprint if available
    if (this.cachedFingerprint) {
      return this.cachedFingerprint;
    }

    // Try to get from localStorage first
    const storedFingerprint = this.getStoredFingerprint();
    if (storedFingerprint) {
      this.cachedFingerprint = storedFingerprint;
      return storedFingerprint;
    }

    // Generate new fingerprint
    try {
      const fp = await this.initialize();
      const result = await fp.get();
      const fingerprint = result.visitorId;
      
      // Store for future use
      this.storeFingerprint(fingerprint);
      this.cachedFingerprint = fingerprint;
      
      return fingerprint;
    } catch (error) {
      console.error('Failed to generate fingerprint:', error);
      // Fallback to a random ID stored in localStorage
      return this.generateFallbackFingerprint();
    }
  }

  getStoredFingerprint() {
    if (typeof window === 'undefined') return null;
    
    try {
      return localStorage.getItem(this.storageKey);
    } catch (error) {
      console.error('Failed to read stored fingerprint:', error);
      return null;
    }
  }

  storeFingerprint(fingerprint) {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.storageKey, fingerprint);
      // Also store in sessionStorage as backup
      sessionStorage.setItem(this.storageKey, fingerprint);
    } catch (error) {
      console.error('Failed to store fingerprint:', error);
    }
  }

  generateFallbackFingerprint() {
    // Generate a random fallback ID
    const fallbackId = 'fallback_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    this.storeFingerprint(fallbackId);
    this.cachedFingerprint = fallbackId;
    return fallbackId;
  }

  // Get fingerprint with multiple fallback options
  async getFingerprintWithFallbacks() {
    // Primary: Generated fingerprint
    try {
      return await this.getFingerprint();
    } catch (error) {
      console.error('Primary fingerprint failed:', error);
    }

    // Secondary: SessionStorage
    try {
      const sessionFingerprint = sessionStorage.getItem(this.storageKey);
      if (sessionFingerprint) {
        this.cachedFingerprint = sessionFingerprint;
        return sessionFingerprint;
      }
    } catch (error) {
      console.error('SessionStorage fallback failed:', error);
    }

    // Tertiary: Generate new fallback
    return this.generateFallbackFingerprint();
  }

  // Clear stored fingerprint (for testing or user request)
  clearFingerprint() {
    this.cachedFingerprint = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.storageKey);
        sessionStorage.removeItem(this.storageKey);
      } catch (error) {
        console.error('Failed to clear fingerprint:', error);
      }
    }
  }
}

// Singleton instance
const fingerprintService = new FingerprintService();

export default fingerprintService;