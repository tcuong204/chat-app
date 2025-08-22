/**
 * Authentication Utility for Voice Call Testing
 * 
 * Handles login to get JWT token for Socket.IO authentication
 */

class AuthService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Login to get JWT token
   */
  async login(phoneNumber, password) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          password,
          deviceInfo: {
            deviceId: 'voice-call-test-' + Date.now(),
            deviceName: 'Voice Call Test App',
            platform: 'web',
            deviceType: "mobile",
            pushToken: "expo_push_token_xyz789"
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      return {
        accessToken: data.tokens.accessToken,
        user: data.user
      };

    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Register new user (for testing)
   */
  async register(phoneNumber, password, fullName) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          password,
          fullName,
          username: phoneNumber.replace('+', '').replace(/\s/g, ''),
          deviceInfo: {
            deviceId: 'voice-call-test-' + Date.now(),
            deviceName: 'Voice Call Test App',
            platform: 'web',
            osVersion: navigator.userAgent,
            appVersion: '1.0.0'
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const data = await response.json();
      return {
        accessToken: data.accessToken,
        user: data.user
      };

    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Get user profile
   */
  async getProfile(token) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get profile');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get profile failed: ${error.message}`);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Test credentials for quick testing
const TEST_USERS = {
  user1: {
    phoneNumber: '+84901234567',
    password: 'SecurePassword123!',
    fullName: 'Test User 1',
    userId: '687cf0503cc129a28823e938' // From existing data
  },
  user2: {
    phoneNumber: '+84901234001',
    password: 'SecurePassword123!',
    fullName: 'Test User 2',
    userId: '687cf0623cc129a28823e944' // From existing data
  }
};
