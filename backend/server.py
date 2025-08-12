from fastapi import FastAPI, HTTPException, Request, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
from datetime import datetime, timedelta
import os
import uuid
from typing import List, Optional
import logging
from pydantic import BaseModel, Field
import json

# Authentication imports
from auth_models import *
from auth_handler import auth_handler
from auth_middleware import get_current_user, require_customer, require_cleaner, require_admin, require_any_auth
from background_check_service import background_check_service  # Use mock service by default
from file_upload_service import file_upload_service

# Configure logging with more details for production
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import Stripe integration with error handling
try:
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
    STRIPE_AVAILABLE = True
    logger.info("Stripe integration loaded successfully")
except ImportError as e:
    logger.warning(f"Stripe integration not available: {e}")
    STRIPE_AVAILABLE = False
    # Create mock classes for development
    class StripeCheckout:
        def __init__(self, *args, **kwargs):
            pass
    class CheckoutSessionResponse:
        pass
    class CheckoutStatusResponse:
        pass
    class CheckoutSessionRequest:
        pass

app = FastAPI(title="Tati's Cleaners API", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "tatiscleaners_production")
STRIPE_API_KEY = os.getenv("STRIPE_API_KEY", "")

# Environment detection
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT.lower() in ["production", "prod"]

logger.info(f"Starting application in {ENVIRONMENT} environment")
logger.info(f"Database name: {DB_NAME}")
logger.info(f"Production mode: {IS_PRODUCTION}")

# MongoDB connection with improved error handling

# Global variables for database connections
client = None
db = None
cleaners_collection = None
bookings_collection = None
payment_transactions_collection = None
users_collection = None
cleaner_applications_collection = None
ratings_collection = None

def init_database():
    """Initialize database connection with retry logic"""
    global client, db, cleaners_collection, bookings_collection, payment_transactions_collection
    global users_collection, cleaner_applications_collection, ratings_collection
    
    max_retries = 5
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            logger.info(f"Attempting to connect to MongoDB (attempt {retry_count + 1}/{max_retries})")
            logger.info(f"MongoDB URL: {MONGO_URL[:30]}...")
            
            # Create client with Atlas-optimized settings
            client = MongoClient(
                MONGO_URL, 
                serverSelectionTimeoutMS=30000,  # 30 second timeout for Atlas
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                maxPoolSize=50,
                minPoolSize=5,
                retryWrites=True,
                retryReads=True,
                w='majority',
                readPreference='primary'
            )
            
            # Test the connection
            client.admin.command('ping')
            logger.info("MongoDB connection successful")
            
            # Initialize database and collections
            db = client[DB_NAME]
            cleaners_collection = db.cleaners
            bookings_collection = db.bookings
            payment_transactions_collection = db.payment_transactions
            users_collection = db.users
            cleaner_applications_collection = db.cleaner_applications
            ratings_collection = db.ratings
            
            logger.info(f"Database '{DB_NAME}' initialized successfully")
            
            # Create indexes for production performance
            if IS_PRODUCTION:
                try:
                    logger.info("Creating database indexes for production...")
                    users_collection.create_index("email", unique=True)
                    users_collection.create_index("role")
                    bookings_collection.create_index("customer_email")
                    bookings_collection.create_index("cleaner_id")
                    bookings_collection.create_index("status")
                    bookings_collection.create_index("created_at")
                    cleaner_applications_collection.create_index("user_id")
                    cleaner_applications_collection.create_index("status")
                    ratings_collection.create_index("cleaner_id")
                    ratings_collection.create_index("booking_id")
                    logger.info("Database indexes created successfully")
                except Exception as e:
                    logger.warning(f"Index creation failed (may already exist): {e}")
            
            return True
            
        except (ServerSelectionTimeoutError, ConnectionFailure) as e:
            retry_count += 1
            logger.error(f"MongoDB connection failed (attempt {retry_count}/{max_retries}): {e}")
            
            if retry_count >= max_retries:
                logger.error("Failed to connect to MongoDB after maximum retries")
                return False
            
            # Wait before retry
            import time
            time.sleep(2)
            
        except Exception as e:
            logger.error(f"Unexpected database error: {e}")
            return False
    
    return False

# Initialize database connection
database_connected = init_database()

# Stripe setup
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
if STRIPE_API_KEY:
    logger.info("Stripe API key found")
else:
    logger.warning("Stripe API key not found")

# Data models
class Cleaner(BaseModel):
    id: str
    name: str
    rating: float
    experience_years: int
    specialties: List[str]
    avatar_url: str
    available: bool = True

class BookingRequest(BaseModel):
    service_type: str
    cleaner_id: str
    date: str
    time: str
    hours: int
    location: str
    address: str
    customer_name: str
    customer_email: str
    customer_phone: str
    special_instructions: Optional[str] = ""

class PaymentRequest(BaseModel):
    booking_id: str
    origin_url: str

# Service packages with updated pricing per cleaner
SERVICE_PACKAGES = {
    "regular_cleaning": {
        "name": "Regular Cleaning",
        "description": "Standard house cleaning service",
        "base_price": 40.0  # per hour
    },
    "deep_cleaning": {
        "name": "Deep Cleaning", 
        "description": "Thorough deep cleaning service",
        "base_price": 45.0  # per hour
    },
    "move_in_out": {
        "name": "Move In/Out Cleaning",
        "description": "Complete cleaning for moving",
        "base_price": 70.0  # per hour
    },
    "janitorial_cleaning": {
        "name": "Janitorial Cleaning",
        "description": "Commercial janitorial services", 
        "base_price": 70.0  # per hour
    }
}

# Service areas
SERVICE_AREAS = [
    "Tempe", "Chandler", "Gilbert", "Mesa", 
    "Phoenix", "Glendale", "Scottsdale", "Avondale"
]

# Initialize sample cleaners with error handling
def init_sample_cleaners():
    """Initialize sample cleaners data - only in development"""
    if not database_connected:
        logger.warning("Database not connected, skipping cleaner initialization")
        return False
    
    try:
        existing_cleaners = cleaners_collection.count_documents({})
        if existing_cleaners > 0:
            logger.info(f"Found {existing_cleaners} existing cleaners, skipping initialization")
            return True
        
        # Only initialize sample data in development
        if not IS_PRODUCTION:
            logger.info("Initializing sample cleaners for development environment")
            sample_cleaners = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Ivon Gamez",
                    "rating": 5.0,
                    "experience_years": 9,
                    "specialties": ["Kitchen Cleaning", "Deep Cleaning", "Move In/Out Cleaning"],
                    "avatar_url": "https://images.unsplash.com/photo-1494790108755-2616b932fc04?w=150&h=150&fit=crop&crop=face",
                    "available": True
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Lucia Coronado",
                    "rating": 4.9,
                    "experience_years": 3,
                    "specialties": ["Bathroom Cleaning", "Deep Cleaning"],
                    "avatar_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
                    "available": True
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Ana Garcia",
                    "rating": 4.9,
                    "experience_years": 7,
                    "specialties": ["Janitorial", "Deep Cleaning"],
                    "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
                    "available": True
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Jessica Martinez",
                    "rating": 4.7,
                    "experience_years": 4,
                    "specialties": ["Regular Cleaning", "Move In/Out"],
                    "avatar_url": "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face",
                    "available": True
                }
            ]
            cleaners_collection.insert_many(sample_cleaners)
            logger.info(f"Initialized {len(sample_cleaners)} sample cleaners")
        else:
            logger.info("Production environment - skipping sample data initialization")
        
        return True
    except Exception as e:
        logger.error(f"Error initializing sample cleaners: {e}")
        return False

# Health check endpoints
@app.get("/")
async def root():
    """Root endpoint for basic health check"""
    return {
        "service": "Tati's Cleaners API",
        "status": "healthy",
        "version": "1.0.0",
        "database_connected": database_connected
    }

@app.get("/health")
async def health_check():
    """Detailed health check endpoint"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database": "connected" if database_connected else "disconnected",
        "stripe": "available" if STRIPE_AVAILABLE and STRIPE_API_KEY else "unavailable"
    }
    
    # Test database connection
    if database_connected:
        try:
            client.admin.command('ping')
            health_status["database_test"] = "success"
        except Exception as e:
            health_status["database_test"] = f"failed: {str(e)}"
            health_status["status"] = "degraded"
    
    return health_status

# API Routes with error handling
@app.get("/api/cleaners")
async def get_cleaners():
    """Get all available cleaners"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        cleaners = list(cleaners_collection.find({"available": True}, {"_id": 0}))
        return {"cleaners": cleaners}
    except Exception as e:
        logger.error(f"Error fetching cleaners: {e}")
        raise HTTPException(status_code=500, detail="Error fetching cleaners")

@app.get("/api/service-areas")
async def get_service_areas():
    """Get all service areas"""
    try:
        return {"areas": SERVICE_AREAS}
    except Exception as e:
        logger.error(f"Error fetching service areas: {e}")
        raise HTTPException(status_code=500, detail="Error fetching service areas")

@app.get("/api/services")
async def get_services():
    """Get all service types"""
    try:
        return {"services": SERVICE_PACKAGES}
    except Exception as e:
        logger.error(f"Error fetching services: {e}")
        raise HTTPException(status_code=500, detail="Error fetching services")

@app.post("/api/bookings")
async def create_booking(booking: BookingRequest):
    """Create a new booking"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Validate service type
        if booking.service_type not in SERVICE_PACKAGES:
            raise HTTPException(status_code=400, detail="Invalid service type")
        
        # Validate cleaner exists
        cleaner = cleaners_collection.find_one({"id": booking.cleaner_id})
        if not cleaner:
            raise HTTPException(status_code=400, detail="Cleaner not found")
        
        # Validate service area
        if booking.location not in SERVICE_AREAS:
            raise HTTPException(status_code=400, detail="Service area not supported")
        
        # Calculate total amount
        service_price = SERVICE_PACKAGES[booking.service_type]["base_price"]
        total_amount = service_price * booking.hours
        
        # Create booking
        booking_id = str(uuid.uuid4())
        booking_data = {
            "id": booking_id,
            "service_type": booking.service_type,
            "cleaner_id": booking.cleaner_id,
            "cleaner_name": cleaner["name"],
            "date": booking.date,
            "time": booking.time,
            "hours": booking.hours,
            "location": booking.location,
            "address": booking.address,
            "customer_name": booking.customer_name,
            "customer_email": booking.customer_email,
            "customer_phone": booking.customer_phone,
            "special_instructions": booking.special_instructions,
            "total_amount": total_amount,
            "status": "pending_payment",
            "created_at": datetime.now().isoformat(),
            "payment_status": "pending"
        }
        
        bookings_collection.insert_one(booking_data)
        
        return {
            "booking_id": booking_id,
            "total_amount": total_amount,
            "message": "Booking created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating booking: {e}")
        raise HTTPException(status_code=500, detail="Error creating booking")

@app.post("/api/checkout/session")
async def create_checkout_session(payment: PaymentRequest, request: Request):
    """Create Stripe checkout session for booking payment"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Payment service not available")
    
    try:
        # Get booking details
        booking = bookings_collection.find_one({"id": payment.booking_id})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        if booking["payment_status"] == "paid":
            raise HTTPException(status_code=400, detail="Booking already paid")
        
        # Initialize Stripe checkout
        if not STRIPE_API_KEY:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        host_url = payment.origin_url
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Create checkout session
        success_url = f"{host_url}?session_id={{CHECKOUT_SESSION_ID}}&booking_id={payment.booking_id}"
        cancel_url = f"{host_url}?cancelled=true"
        
        checkout_request = CheckoutSessionRequest(
            amount=float(booking["total_amount"]),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "booking_id": payment.booking_id,
                "customer_email": booking["customer_email"],
                "service_type": booking["service_type"]
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        payment_transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "booking_id": payment.booking_id,
            "amount": float(booking["total_amount"]),
            "currency": "usd",
            "payment_status": "pending",
            "status": "initiated",
            "customer_email": booking["customer_email"],
            "created_at": datetime.now().isoformat(),
            "metadata": checkout_request.metadata
        }
        
        payment_transactions_collection.insert_one(payment_transaction)
        
        return {
            "url": session.url,
            "session_id": session.session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail="Error creating checkout session")

@app.get("/api/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    """Get payment status for a checkout session"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Payment service not available")
    
    try:
        # Get payment transaction
        transaction = payment_transactions_collection.find_one({"session_id": session_id})
        if not transaction:
            raise HTTPException(status_code=404, detail="Payment session not found")
        
        # Initialize Stripe checkout
        if not STRIPE_API_KEY:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        
        # Get status from Stripe  
        checkout_status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        update_data = {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "updated_at": datetime.now().isoformat()
        }
        
        payment_transactions_collection.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        # Update booking status if payment successful
        if checkout_status.payment_status == "paid" and transaction["payment_status"] != "paid":
            bookings_collection.update_one(
                {"id": transaction["booking_id"]},
                {"$set": {
                    "payment_status": "paid",
                    "status": "confirmed",
                    "confirmed_at": datetime.now().isoformat()
                }}
            )
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency,
            "booking_id": transaction["booking_id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking payment status: {e}")
        raise HTTPException(status_code=500, detail="Error checking payment status")

@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Payment service not available")
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        if not STRIPE_API_KEY:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Process webhook event
        if webhook_response.event_type == "checkout.session.completed":
            # Update payment transaction
            payment_transactions_collection.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {
                    "payment_status": webhook_response.payment_status,
                    "webhook_processed_at": datetime.now().isoformat()
                }}
            )
            
            # Update booking status
            transaction = payment_transactions_collection.find_one({"session_id": webhook_response.session_id})
            if transaction:
                bookings_collection.update_one(
                    {"id": transaction["booking_id"]},
                    {"$set": {
                        "payment_status": "paid",
                        "status": "confirmed",
                        "confirmed_at": datetime.now().isoformat()
                    }}
                )
        
        return {"status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Error processing webhook")

@app.get("/api/bookings/{booking_id}")
async def get_booking(booking_id: str):
    """Get booking details"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        booking = bookings_collection.find_one({"id": booking_id}, {"_id": 0})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        return booking
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching booking: {e}")
        raise HTTPException(status_code=500, detail="Error fetching booking")

# === AUTHENTICATION ENDPOINTS ===

@app.post("/api/auth/register", response_model=TokenResponse)
async def register_user(user_data: UserRegistration):
    """Register a new user"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Check if user already exists
        existing_user = users_collection.find_one({"email": user_data.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        user_id = str(uuid.uuid4())
        hashed_password = auth_handler.encode_password(user_data.password)
        
        user_document = {
            "id": user_id,
            "email": user_data.email,
            "password": hashed_password,
            "first_name": user_data.first_name,
            "last_name": user_data.last_name,
            "phone": user_data.phone,
            "role": user_data.role.value,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        users_collection.insert_one(user_document)
        
        # Generate token
        token = auth_handler.encode_token(user_id, user_data.email, user_data.role.value)
        
        # Return response
        user_response = UserResponse(
            id=user_id,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            role=user_data.role,
            is_active=True,
            created_at=user_document["created_at"]
        )
        
        return TokenResponse(
            access_token=token,
            user=user_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@app.post("/api/auth/login", response_model=TokenResponse)
async def login_user(login_data: UserLogin):
    """Login user"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Find user
        user = users_collection.find_one({"email": login_data.email})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Verify password
        if not auth_handler.verify_password(login_data.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Check if user is active
        if not user.get("is_active", True):
            raise HTTPException(status_code=401, detail="Account is deactivated")
        
        # Update last login
        users_collection.update_one(
            {"id": user["id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        # Generate token
        token = auth_handler.encode_token(user["id"], user["email"], user["role"])
        
        # Return response
        user_response = UserResponse(
            id=user["id"],
            email=user["email"],
            first_name=user["first_name"],
            last_name=user["last_name"],
            phone=user.get("phone"),
            role=UserRole(user["role"]),
            is_active=user["is_active"],
            created_at=user["created_at"]
        )
        
        return TokenResponse(
            access_token=token,
            user=user_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        user = users_collection.find_one({"id": current_user["user_id"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse(
            id=user["id"],
            email=user["email"],
            first_name=user["first_name"],
            last_name=user["last_name"],
            phone=user.get("phone"),
            role=UserRole(user["role"]),
            is_active=user["is_active"],
            created_at=user["created_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user information")

# === CLEANER APPLICATION ENDPOINTS ===

@app.post("/api/cleaner/apply")
async def submit_cleaner_application(
    application: CleanerApplicationRequest,
    current_user: dict = Depends(require_customer)
):
    """Submit cleaner application"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Check if user already has an application
        existing_app = cleaner_applications_collection.find_one({"user_id": current_user["user_id"]})
        if existing_app:
            raise HTTPException(status_code=400, detail="Application already exists")
        
        # Create application
        application_id = str(uuid.uuid4())
        app_data = {
            "application_id": application_id,
            "user_id": current_user["user_id"],
            "status": CleanerStatus.DOCUMENTS_REQUIRED.value,
            "personal_info": {
                "ssn": application.ssn,
                "date_of_birth": application.date_of_birth,
                "address": application.address,
                "city": application.city,
                "state": application.state,
                "zip_code": application.zip_code,
                "emergency_contact_name": application.emergency_contact_name,
                "emergency_contact_phone": application.emergency_contact_phone,
                "has_vehicle": application.has_vehicle,
                "has_cleaning_experience": application.has_cleaning_experience,
                "years_experience": application.years_experience
            },
            "hourly_rate": application.hourly_rate,
            "service_areas": application.service_areas,
            "specialties": application.specialties,
            "documents": {},
            "background_check_results": {},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        cleaner_applications_collection.insert_one(app_data)
        
        return {
            "message": "Application submitted successfully",
            "application_id": application_id,
            "status": CleanerStatus.DOCUMENTS_REQUIRED.value,
            "next_steps": "Please upload required documents: ID (front and back), SSN card, and work permit (if applicable)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Application submission error: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit application")

@app.post("/api/cleaner/upload-document")
async def upload_document(
    document: DocumentUpload,
    current_user: dict = Depends(require_customer)
):
    """Upload document for cleaner application"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Verify application ownership
        application = cleaner_applications_collection.find_one({
            "application_id": document.application_id,
            "user_id": current_user["user_id"]
        })
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Save document
        file_info = await file_upload_service.save_document(
            document.file_data,
            document.file_name,
            document.application_id,
            document.document_type.value
        )
        
        # Update application with document info
        update_data = {
            f"documents.{document.document_type.value}": file_info,
            "updated_at": datetime.utcnow()
        }
        
        # Check if all required documents are uploaded
        required_docs = [DocumentType.ID_FRONT, DocumentType.ID_BACK, DocumentType.SSN_CARD]
        current_docs = application.get("documents", {})
        current_docs[document.document_type.value] = file_info
        
        all_required_uploaded = all(doc.value in current_docs for doc in required_docs)
        
        if all_required_uploaded and application["status"] == CleanerStatus.DOCUMENTS_REQUIRED.value:
            update_data["status"] = CleanerStatus.DOCUMENTS_SUBMITTED.value
        
        cleaner_applications_collection.update_one(
            {"application_id": document.application_id},
            {"$set": update_data}
        )
        
        return {
            "message": "Document uploaded successfully",
            "document_type": document.document_type.value,
            "status": update_data.get("status", application["status"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload document")

@app.post("/api/cleaner/initiate-background-check")
async def initiate_background_check(
    application_id: str,
    current_user: dict = Depends(require_admin)
):
    """Initiate background check for cleaner application (admin only)"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Get application
        application = cleaner_applications_collection.find_one({"application_id": application_id})
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        if application["status"] != CleanerStatus.DOCUMENTS_SUBMITTED.value:
            raise HTTPException(status_code=400, detail="Application not ready for background check")
        
        # Initiate background check
        check_result = await background_check_service.initiate_background_check({
            "application_id": application_id,
            "personal_info": application["personal_info"]
        })
        
        # Update application status
        cleaner_applications_collection.update_one(
            {"application_id": application_id},
            {"$set": {
                "status": CleanerStatus.BACKGROUND_CHECK.value,
                "background_check_id": check_result["check_id"],
                "background_check_initiated_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {
            "message": "Background check initiated",
            "check_id": check_result["check_id"],
            "estimated_completion": check_result.get("estimated_completion")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Background check initiation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate background check")

# === DASHBOARD ENDPOINTS ===

@app.get("/api/customer/dashboard")
async def get_customer_dashboard(current_user: dict = Depends(require_customer)):
    """Get customer dashboard data"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Get user's bookings
        user_bookings = list(bookings_collection.find(
            {"customer_email": current_user["email"]},
            {"_id": 0}
        ).sort("created_at", -1))
        
        # Calculate stats
        total_bookings = len(user_bookings)
        completed_bookings = len([b for b in user_bookings if b.get("status") == "completed"])
        upcoming_bookings = len([b for b in user_bookings if b.get("status") in ["confirmed", "in_progress"]])
        total_spent = sum(float(b.get("total_amount", 0)) for b in user_bookings if b.get("payment_status") == "paid")
        
        # Get favorite cleaners (most booked)
        cleaner_counts = {}
        for booking in user_bookings:
            cleaner_id = booking.get("cleaner_id")
            if cleaner_id:
                cleaner_counts[cleaner_id] = cleaner_counts.get(cleaner_id, 0) + 1
        
        favorite_cleaners = []
        for cleaner_id, count in sorted(cleaner_counts.items(), key=lambda x: x[1], reverse=True)[:3]:
            cleaner = cleaners_collection.find_one({"id": cleaner_id}, {"_id": 0})
            if cleaner:
                favorite_cleaners.append({
                    "cleaner": cleaner,
                    "booking_count": count
                })
        
        return {
            "stats": {
                "total_bookings": total_bookings,
                "completed_bookings": completed_bookings,
                "upcoming_bookings": upcoming_bookings,
                "total_spent": total_spent,
                "favorite_cleaners": favorite_cleaners
            },
            "recent_bookings": user_bookings[:5],
            "upcoming_bookings": [b for b in user_bookings if b.get("status") in ["confirmed", "in_progress"]][:5]
        }
        
    except Exception as e:
        logger.error(f"Customer dashboard error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard")

@app.get("/api/cleaner/dashboard")
async def get_cleaner_dashboard(current_user: dict = Depends(require_cleaner)):
    """Get cleaner dashboard data"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Find cleaner record
        cleaner = cleaners_collection.find_one({"email": current_user["email"]})
        if not cleaner:
            raise HTTPException(status_code=404, detail="Cleaner profile not found")
        
        # Get cleaner's jobs
        cleaner_jobs = list(bookings_collection.find(
            {"cleaner_id": cleaner["id"]},
            {"_id": 0}
        ).sort("created_at", -1))
        
        # Calculate stats
        total_jobs = len(cleaner_jobs)
        completed_jobs = len([j for j in cleaner_jobs if j.get("status") == "completed"])
        upcoming_jobs = len([j for j in cleaner_jobs if j.get("status") in ["confirmed", "in_progress"]])
        total_earnings = sum(float(j.get("total_amount", 0)) for j in cleaner_jobs if j.get("payment_status") == "paid")
        
        # Get ratings
        cleaner_ratings = list(ratings_collection.find({"cleaner_id": cleaner["id"]}))
        average_rating = sum(r["rating"] for r in cleaner_ratings) / len(cleaner_ratings) if cleaner_ratings else 0
        
        # Get pending requests (new bookings)
        pending_requests = len([j for j in cleaner_jobs if j.get("status") == "pending_acceptance"])
        
        return {
            "stats": {
                "total_jobs": total_jobs,
                "completed_jobs": completed_jobs,
                "upcoming_jobs": upcoming_jobs,
                "total_earnings": total_earnings,
                "average_rating": round(average_rating, 1),
                "pending_requests": pending_requests
            },
            "recent_jobs": cleaner_jobs[:5],
            "upcoming_jobs": [j for j in cleaner_jobs if j.get("status") in ["confirmed", "in_progress"]][:5],
            "pending_jobs": [j for j in cleaner_jobs if j.get("status") == "pending_acceptance"][:5]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleaner dashboard error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard")

@app.post("/api/bookings/{booking_id}/rate")
async def rate_booking(
    booking_id: str,
    rating_data: BookingRating,
    current_user: dict = Depends(require_customer)
):
    """Rate a completed booking"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Verify booking ownership
        booking = bookings_collection.find_one({
            "id": booking_id,
            "customer_email": current_user["email"]
        })
        
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        if booking.get("status") != "completed":
            raise HTTPException(status_code=400, detail="Can only rate completed bookings")
        
        # Check if already rated
        existing_rating = ratings_collection.find_one({"booking_id": booking_id})
        if existing_rating:
            raise HTTPException(status_code=400, detail="Booking already rated")
        
        # Create rating
        rating_doc = {
            "id": str(uuid.uuid4()),
            "booking_id": booking_id,
            "cleaner_id": rating_data.cleaner_id,
            "customer_id": current_user["user_id"],
            "rating": rating_data.rating,
            "review": rating_data.review,
            "created_at": datetime.utcnow()
        }
        
        ratings_collection.insert_one(rating_doc)
        
        # Update cleaner's average rating
        cleaner_ratings = list(ratings_collection.find({"cleaner_id": rating_data.cleaner_id}))
        avg_rating = sum(r["rating"] for r in cleaner_ratings) / len(cleaner_ratings)
        
        cleaners_collection.update_one(
            {"id": rating_data.cleaner_id},
            {"$set": {"rating": round(avg_rating, 1)}}
        )
        
        return {"message": "Rating submitted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rating submission error: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit rating")

@app.post("/api/bookings/{booking_id}/accept")
async def accept_booking(
    booking_id: str,
    acceptance: BookingAcceptance,
    current_user: dict = Depends(require_cleaner)
):
    """Accept or decline a booking"""
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Find cleaner record
        cleaner = cleaners_collection.find_one({"email": current_user["email"]})
        if not cleaner:
            raise HTTPException(status_code=404, detail="Cleaner profile not found")
        
        # Verify booking
        booking = bookings_collection.find_one({
            "id": booking_id,
            "cleaner_id": cleaner["id"]
        })
        
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        if booking.get("status") != "pending_acceptance":
            raise HTTPException(status_code=400, detail="Booking not available for acceptance")
        
        # Update booking status
        if acceptance.accepted:
            new_status = "confirmed"
            message = "Booking accepted successfully"
        else:
            new_status = "declined"
            message = "Booking declined"
        
        bookings_collection.update_one(
            {"id": booking_id},
            {"$set": {
                "status": new_status,
                "cleaner_response": {
                    "accepted": acceptance.accepted,
                    "reason": acceptance.reason,
                    "responded_at": datetime.utcnow()
                },
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {"message": message}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Booking acceptance error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process booking response")

# Keep existing endpoints below...

# Initialize sample data on startup with proper error handling
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("Starting Tati's Cleaners API...")
    logger.info(f"Database connected: {database_connected}")
    logger.info(f"Stripe available: {STRIPE_AVAILABLE}")
    
    if database_connected:
        try:
            init_result = init_sample_cleaners()
            if init_result:
                logger.info("Sample cleaners initialized successfully")
            else:
                logger.warning("Sample cleaners initialization skipped or failed")
        except Exception as e:
            logger.error(f"Error during startup initialization: {e}")
            # Don't crash the app, just log the error
    else:
        logger.warning("Skipping sample data initialization - database not connected")
    
    logger.info("Tati's Cleaners API startup completed")

# Graceful shutdown
@app.on_event("shutdown")
async def shutdown_event():
    """Clean shutdown of the application"""
    logger.info("Shutting down Tati's Cleaners API...")
    if client:
        try:
            client.close()
            logger.info("Database connection closed")
        except Exception as e:
            logger.error(f"Error closing database connection: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)