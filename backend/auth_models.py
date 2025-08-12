from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum

class UserRole(str, Enum):
    CUSTOMER = "customer"
    CLEANER = "cleaner"
    ADMIN = "admin"

class CleanerStatus(str, Enum):
    PENDING = "pending"
    DOCUMENTS_REQUIRED = "documents_required"
    DOCUMENTS_SUBMITTED = "documents_submitted"
    BACKGROUND_CHECK = "background_check"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

class DocumentType(str, Enum):
    ID_FRONT = "id_front"
    ID_BACK = "id_back"
    SSN_CARD = "ssn_card"
    WORK_PERMIT = "work_permit"
    RESUME = "resume"

# User Registration Models
class UserRegistration(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=2)
    last_name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    role: UserRole = UserRole.CUSTOMER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    role: UserRole
    is_active: bool
    created_at: datetime
    
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Cleaner Application Models
class CleanerApplication(BaseModel):
    user_id: str
    application_id: str
    status: CleanerStatus
    personal_info: dict
    documents: dict = {}
    background_check_results: dict = {}
    hourly_rate: Optional[float] = None
    service_areas: List[str] = []
    specialties: List[str] = []
    availability: dict = {}
    created_at: datetime
    updated_at: datetime

class CleanerApplicationRequest(BaseModel):
    ssn: str = Field(..., min_length=9, max_length=9)
    date_of_birth: str
    address: str
    city: str
    state: str
    zip_code: str
    emergency_contact_name: str
    emergency_contact_phone: str
    has_vehicle: bool = True
    has_cleaning_experience: bool = True
    years_experience: int = Field(default=0, ge=0)
    hourly_rate: float = Field(..., gt=0)
    service_areas: List[str] = []
    specialties: List[str] = []

class DocumentUpload(BaseModel):
    application_id: str
    document_type: DocumentType
    file_name: str
    file_data: str  # base64 encoded file data

# Dashboard Models
class CustomerStats(BaseModel):
    total_bookings: int
    completed_bookings: int
    upcoming_bookings: int
    total_spent: float
    favorite_cleaners: List[dict]

class CleanerStats(BaseModel):
    total_jobs: int
    completed_jobs: int
    upcoming_jobs: int
    total_earnings: float
    average_rating: float
    pending_requests: int

class BookingRating(BaseModel):
    booking_id: str
    cleaner_id: str
    rating: int = Field(..., ge=1, le=5)
    review: Optional[str] = None

class BookingAcceptance(BaseModel):
    booking_id: str
    accepted: bool
    reason: Optional[str] = None