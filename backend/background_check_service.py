import uuid
import random
from datetime import datetime, timedelta
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class MockBackgroundCheckService:
    """Mock background check service for testing - replace with real service later"""
    
    def __init__(self):
        self.pending_checks = {}
    
    async def initiate_background_check(self, application_data: Dict[str, Any]) -> Dict[str, Any]:
        """Initiate a background check (mock implementation)"""
        check_id = str(uuid.uuid4())
        
        # Simulate random processing time (5-30 seconds for demo)
        completion_time = datetime.utcnow() + timedelta(seconds=random.randint(5, 30))
        
        # Store pending check
        self.pending_checks[check_id] = {
            'application_id': application_data['application_id'],
            'status': 'in_progress',
            'completion_time': completion_time,
            'application_data': application_data
        }
        
        logger.info(f"Mock background check initiated: {check_id}")
        
        return {
            'check_id': check_id,
            'status': 'in_progress',
            'estimated_completion': completion_time.isoformat()
        }
    
    async def check_background_check_status(self, check_id: str) -> Dict[str, Any]:
        """Check the status of a background check"""
        if check_id not in self.pending_checks:
            return {'status': 'not_found'}
        
        check_data = self.pending_checks[check_id]
        current_time = datetime.utcnow()
        
        if current_time >= check_data['completion_time']:
            # Generate mock results
            results = self._generate_mock_results(check_data['application_data'])
            
            # Update status
            check_data['status'] = 'completed'
            check_data['results'] = results
            
            return {
                'check_id': check_id,
                'status': 'completed',
                'results': results
            }
        else:
            return {
                'check_id': check_id,
                'status': 'in_progress',
                'estimated_completion': check_data['completion_time'].isoformat()
            }
    
    def _generate_mock_results(self, application_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate mock background check results"""
        # 90% pass rate for demo purposes
        passed = random.random() < 0.9
        
        results = {
            'overall_status': 'clear' if passed else 'consider',
            'identity_verification': {
                'status': 'verified',
                'ssn_valid': True,
                'name_match': True,
                'address_history': [
                    {
                        'address': application_data.get('address', ''),
                        'dates': '2020-present'
                    }
                ]
            },
            'criminal_background': {
                'status': 'clear' if passed else 'records_found',
                'county_searches': [
                    {
                        'county': 'Sample County',
                        'state': application_data.get('state', 'AZ'),
                        'status': 'clear' if passed else 'records_found',
                        'records': [] if passed else [
                            {
                                'case_number': 'SAMPLE-2019-123',
                                'charge': 'Minor Traffic Violation',
                                'disposition': 'Resolved',
                                'date': '2019-03-15'
                            }
                        ]
                    }
                ],
                'sex_offender_search': {
                    'status': 'clear'
                }
            },
            'employment_verification': {
                'status': 'verified' if random.random() < 0.8 else 'unable_to_verify',
                'positions_verified': 1 if random.random() < 0.8 else 0
            },
            'professional_license': {
                'status': 'not_required'
            }
        }
        
        return results

# Global instance
background_check_service = MockBackgroundCheckService()