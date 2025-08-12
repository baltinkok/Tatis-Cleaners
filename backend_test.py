import requests
import sys
import json
import base64
from datetime import datetime, timedelta

class TatisCleanersAPITester:
    def __init__(self, base_url="https://7d48bb0e-5833-4874-a3b6-67b80d36311b.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.booking_id = None
        self.cleaner_id = None
        
        # Authentication tokens
        self.customer_token = None
        self.cleaner_token = None
        self.admin_token = None
        
        # User data
        self.customer_user_id = None
        self.cleaner_user_id = None
        self.admin_user_id = None
        self.application_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_get_services(self):
        """Test GET /api/services"""
        success, response = self.run_test(
            "Get Services",
            "GET",
            "api/services",
            200
        )
        
        if success and 'services' in response:
            services = response['services']
            expected_services = ['regular_cleaning', 'deep_cleaning', 'move_in_out', 'janitorial_cleaning']
            
            for service_key in expected_services:
                if service_key in services:
                    service = services[service_key]
                    if service.get('base_price') == 40.0:
                        print(f"   ✅ {service['name']}: ${service['base_price']}/hour")
                    else:
                        print(f"   ❌ {service['name']}: Wrong price ${service.get('base_price')}")
                        return False
                else:
                    print(f"   ❌ Missing service: {service_key}")
                    return False
            return True
        return False

    def test_get_cleaners(self):
        """Test GET /api/cleaners"""
        success, response = self.run_test(
            "Get Cleaners",
            "GET",
            "api/cleaners",
            200
        )
        
        if success and 'cleaners' in response:
            cleaners = response['cleaners']
            expected_cleaners = ['Maria Rodriguez', 'Sarah Johnson', 'Ana Garcia', 'Jessica Martinez']
            
            if len(cleaners) >= 4:
                print(f"   ✅ Found {len(cleaners)} cleaners")
                for cleaner in cleaners:
                    if cleaner['name'] in expected_cleaners:
                        print(f"   ✅ {cleaner['name']}: Rating {cleaner['rating']}, {cleaner['experience_years']} years exp")
                        if not self.cleaner_id:  # Store first cleaner ID for booking test
                            self.cleaner_id = cleaner['id']
                    else:
                        print(f"   ⚠️  Unexpected cleaner: {cleaner['name']}")
                return True
            else:
                print(f"   ❌ Expected at least 4 cleaners, got {len(cleaners)}")
                return False
        return False

    def test_get_service_areas(self):
        """Test GET /api/service-areas"""
        success, response = self.run_test(
            "Get Service Areas",
            "GET",
            "api/service-areas",
            200
        )
        
        if success and 'areas' in response:
            areas = response['areas']
            expected_areas = ["Tempe", "Chandler", "Gilbert", "Mesa", "Phoenix", "Glendale", "Scottsdale", "Avondale"]
            
            if len(areas) >= 8:
                print(f"   ✅ Found {len(areas)} service areas")
                for area in expected_areas:
                    if area in areas:
                        print(f"   ✅ {area}")
                    else:
                        print(f"   ❌ Missing area: {area}")
                        return False
                return True
            else:
                print(f"   ❌ Expected at least 8 areas, got {len(areas)}")
                return False
        return False

    def test_create_booking(self):
        """Test POST /api/bookings"""
        if not self.cleaner_id:
            print("❌ Cannot test booking - no cleaner ID available")
            return False

        # Create booking for tomorrow
        tomorrow = datetime.now() + timedelta(days=1)
        booking_data = {
            "service_type": "regular_cleaning",
            "cleaner_id": self.cleaner_id,
            "date": tomorrow.strftime("%Y-%m-%d"),
            "time": "10:00 AM",
            "hours": 3,
            "location": "Phoenix",
            "address": "123 Main St, Phoenix, AZ 85001",
            "customer_name": "John Smith",
            "customer_email": "john@example.com",
            "customer_phone": "(480) 555-1234",
            "special_instructions": "Test booking"
        }

        success, response = self.run_test(
            "Create Booking",
            "POST",
            "api/bookings",
            200,
            data=booking_data
        )
        
        if success:
            if 'booking_id' in response and 'total_amount' in response:
                self.booking_id = response['booking_id']
                expected_total = 3 * 40  # 3 hours * $40/hour
                if response['total_amount'] == expected_total:
                    print(f"   ✅ Booking created with ID: {self.booking_id}")
                    print(f"   ✅ Total amount correct: ${response['total_amount']}")
                    return True
                else:
                    print(f"   ❌ Wrong total amount: ${response['total_amount']}, expected ${expected_total}")
                    return False
            else:
                print("   ❌ Missing booking_id or total_amount in response")
                return False
        return False

    def test_get_booking(self):
        """Test GET /api/bookings/{booking_id}"""
        if not self.booking_id:
            print("❌ Cannot test get booking - no booking ID available")
            return False

        success, response = self.run_test(
            "Get Booking Details",
            "GET",
            f"api/bookings/{self.booking_id}",
            200
        )
        
        if success:
            required_fields = ['id', 'service_type', 'cleaner_id', 'date', 'time', 'hours', 
                             'location', 'customer_name', 'customer_email', 'total_amount', 'status']
            
            for field in required_fields:
                if field in response:
                    print(f"   ✅ {field}: {response[field]}")
                else:
                    print(f"   ❌ Missing field: {field}")
                    return False
            return True
        return False

    def test_create_checkout_session(self):
        """Test POST /api/checkout/session"""
        if not self.booking_id:
            print("❌ Cannot test checkout - no booking ID available")
            return False

        payment_data = {
            "booking_id": self.booking_id,
            "origin_url": "https://7d48bb0e-5833-4874-a3b6-67b80d36311b.preview.emergentagent.com"
        }

        success, response = self.run_test(
            "Create Checkout Session",
            "POST",
            "api/checkout/session",
            200,
            data=payment_data
        )
        
        if success:
            if 'url' in response and 'session_id' in response:
                print(f"   ✅ Checkout session created")
                print(f"   ✅ Stripe URL: {response['url'][:50]}...")
                print(f"   ✅ Session ID: {response['session_id']}")
                return True
            else:
                print("   ❌ Missing url or session_id in response")
                return False
        return False

    def test_invalid_booking(self):
        """Test POST /api/bookings with invalid data"""
        invalid_booking_data = {
            "service_type": "invalid_service",
            "cleaner_id": "invalid_cleaner",
            "date": "2024-01-01",
            "time": "10:00 AM",
            "hours": 3,
            "location": "Invalid Location",
            "address": "123 Main St",
            "customer_name": "Test User",
            "customer_email": "test@example.com",
            "customer_phone": "555-1234"
        }

        success, response = self.run_test(
            "Create Invalid Booking (should fail)",
            "POST",
            "api/bookings",
            400,  # Expecting 400 Bad Request
            data=invalid_booking_data
        )
        
        return success  # Success means we got the expected 400 error

def main():
    print("🧪 Starting Tati's Cleaners API Tests")
    print("=" * 50)
    
    tester = TatisCleanersAPITester()
    
    # Run all tests
    tests = [
        tester.test_get_services,
        tester.test_get_cleaners,
        tester.test_get_service_areas,
        tester.test_create_booking,
        tester.test_get_booking,
        tester.test_create_checkout_session,
        tester.test_invalid_booking
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())