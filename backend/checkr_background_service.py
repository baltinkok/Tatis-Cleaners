import os
import requests
import uuid
from datetime import datetime
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class CheckrBackgroundCheckService:
    """Real Checkr background check service integration"""
    
    def __init__(self):
        self.api_key = os.getenv("CHECKR_API_KEY")
        self.base_url = "https://api.checkr.com/v1"
        
        if not self.api_key:
            logger.warning("CHECKR_API_KEY not found. Using sandbox mode.")
            self.base_url = "https://api.checkr.com/v1"  # Checkr uses same URL for sandbox
    
    async def initiate_background_check(self, application_data: Dict[str, Any]) -> Dict[str, Any]:
        """Initiate a background check with Checkr"""
        try:
            # Step 1: Create candidate
            candidate_data = {
                "first_name": application_data.get("personal_info", {}).get("first_name", ""),
                "last_name": application_data.get("personal_info", {}).get("last_name", ""),
                "email": application_data.get("email", ""),
                "phone": application_data.get("phone", ""),
                "zipcode": application_data.get("personal_info", {}).get("zip_code", ""),
                "dob": application_data.get("personal_info", {}).get("date_of_birth", ""),
                "ssn": application_data.get("personal_info", {}).get("ssn", ""),
                "driver_license_number": application_data.get("driver_license", ""),
                "driver_license_state": application_data.get("personal_info", {}).get("state", "")
            }
            
            candidate_response = await self._make_request("POST", "/candidates", candidate_data)
            candidate_id = candidate_response.get("id")
            
            if not candidate_id:
                raise Exception("Failed to create candidate")
            
            # Step 2: Create report (background check)
            report_data = {
                "candidate_id": candidate_id,
                "package": "driver_pro",  # You can customize this based on your needs
                "tags": [f"application_{application_data['application_id']}"]
            }
            
            report_response = await self._make_request("POST", "/reports", report_data)
            
            logger.info(f"Checkr background check initiated: {report_response.get('id')}")
            
            return {
                "check_id": report_response.get("id"),
                "candidate_id": candidate_id,
                "status": "in_progress",
                "estimated_completion": report_response.get("estimated_completion_time")
            }
            
        except Exception as e:
            logger.error(f"Checkr background check initiation failed: {e}")
            raise Exception(f"Background check initiation failed: {str(e)}")
    
    async def check_background_check_status(self, check_id: str) -> Dict[str, Any]:
        """Check the status of a background check"""
        try:
            report_response = await self._make_request("GET", f"/reports/{check_id}")
            
            status_mapping = {
                "pending": "in_progress",
                "consider": "completed",
                "clear": "completed",
                "suspended": "failed"
            }
            
            checkr_status = report_response.get("status")
            our_status = status_mapping.get(checkr_status, "in_progress")
            
            result = {
                "check_id": check_id,
                "status": our_status,
                "checkr_status": checkr_status
            }
            
            if our_status == "completed":
                result["results"] = await self._format_results(report_response)
            
            return result
            
        except Exception as e:
            logger.error(f"Checkr status check failed: {e}")
            return {"check_id": check_id, "status": "error", "error": str(e)}
    
    async def _make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict[str, Any]:
        """Make authenticated request to Checkr API"""
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        if response.status_code not in [200, 201]:
            raise Exception(f"Checkr API error: {response.status_code} - {response.text}")
        
        return response.json()
    
    async def _format_results(self, checkr_report: Dict[str, Any]) -> Dict[str, Any]:
        """Format Checkr results to our standard format"""
        return {
            "overall_status": checkr_report.get("status", "unknown"),
            "adjudication": checkr_report.get("adjudication", "unscheduled"),
            "identity_verification": {
                "status": "verified" if checkr_report.get("candidate", {}).get("ssn_trace") else "pending"
            },
            "criminal_background": {
                "status": self._get_criminal_status(checkr_report),
                "records": self._extract_criminal_records(checkr_report)
            },
            "checkr_report_url": checkr_report.get("report_url", ""),
            "completed_at": checkr_report.get("completed_at"),
            "raw_checkr_data": checkr_report  # Keep full data for reference
        }
    
    def _get_criminal_status(self, report: Dict[str, Any]) -> str:
        """Extract criminal background status from Checkr report"""
        # This depends on your specific Checkr package and what searches you're running
        # You'll need to customize this based on your screening requirements
        status = report.get("status", "")
        if status == "clear":
            return "clear"
        elif status == "consider":
            return "records_found"
        else:
            return "pending"
    
    def _extract_criminal_records(self, report: Dict[str, Any]) -> list:
        """Extract criminal records from Checkr report"""
        # This would extract specific criminal records found
        # Implementation depends on your Checkr package configuration
        records = []
        
        # Example extraction (customize based on your needs)
        searches = report.get("searches", [])
        for search in searches:
            if search.get("type") == "criminal":
                records.extend(search.get("records", []))
        
        return records

# Global instance
checkr_service = CheckrBackgroundCheckService()