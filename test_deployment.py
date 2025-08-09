#!/usr/bin/env python3
"""
Test script to verify all critical endpoints are working
This helps debug deployment issues
"""

import requests
import json
import sys

BACKEND_URL = "http://localhost:8001"

def test_endpoint(name, url, expected_keys=None):
    """Test a single endpoint"""
    try:
        print(f"Testing {name}...")
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ {name}: SUCCESS")
            
            if expected_keys:
                for key in expected_keys:
                    if key in data:
                        print(f"   ✓ Found key: {key}")
                    else:
                        print(f"   ✗ Missing key: {key}")
            
            return True
        else:
            print(f"❌ {name}: FAILED (Status: {response.status_code})")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ {name}: ERROR - {e}")
        return False
    except Exception as e:
        print(f"❌ {name}: UNEXPECTED ERROR - {e}")
        return False

def main():
    """Run all endpoint tests"""
    print("🧪 Testing Tati's Cleaners API Endpoints")
    print("=" * 50)
    
    tests = [
        ("Root Endpoint", f"{BACKEND_URL}/", ["service", "status", "version"]),
        ("Health Check", f"{BACKEND_URL}/health", ["status", "timestamp", "database"]),
        ("Cleaners API", f"{BACKEND_URL}/api/cleaners", ["cleaners"]),
        ("Services API", f"{BACKEND_URL}/api/services", ["services"]),
        ("Service Areas API", f"{BACKEND_URL}/api/service-areas", ["areas"]),
    ]
    
    results = []
    for name, url, keys in tests:
        result = test_endpoint(name, url, keys)
        results.append(result)
        print()
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print("=" * 50)
    print(f"📊 SUMMARY: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Ready for deployment!")
        return 0
    else:
        print("❌ Some tests failed - Check the issues above")
        return 1

if __name__ == "__main__":
    sys.exit(main())