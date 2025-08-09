from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
from datetime import datetime, timedelta
import os
import uuid
from typing import List, Optional
import logging
from pydantic import BaseModel, Field
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
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

# MongoDB connection with improved error handling
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'tatis_cleaners')

# Global variables for database connections
client = None
db = None
cleaners_collection = None
bookings_collection = None
payment_transactions_collection = None

def init_database():
    """Initialize database connection with retry logic"""
    global client, db, cleaners_collection, bookings_collection, payment_transactions_collection
    
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            logger.info(f"Attempting to connect to MongoDB (attempt {retry_count + 1}/{max_retries})")
            logger.info(f"MongoDB URL: {MONGO_URL[:20]}...")
            
            # Create client with timeout settings for Atlas
            client = MongoClient(
                MONGO_URL, 
                serverSelectionTimeoutMS=10000,  # 10 second timeout
                connectTimeoutMS=10000,
                maxPoolSize=10,
                retryWrites=True
            )
            
            # Test the connection
            client.admin.command('ping')
            logger.info("MongoDB connection successful")
            
            # Initialize database and collections
            db = client[DB_NAME]
            cleaners_collection = db.cleaners
            bookings_collection = db.bookings
            payment_transactions_collection = db.payment_transactions
            
            logger.info(f"Database '{DB_NAME}' initialized successfully")
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

# Initialize sample cleaners
def init_sample_cleaners():
    if cleaners_collection.count_documents({}) == 0:
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

# API Routes
@app.get("/api/cleaners")
async def get_cleaners():
    """Get all available cleaners"""
    cleaners = list(cleaners_collection.find({"available": True}, {"_id": 0}))
    return {"cleaners": cleaners}

@app.get("/api/service-areas")
async def get_service_areas():
    """Get all service areas"""
    return {"areas": SERVICE_AREAS}

@app.get("/api/services")
async def get_services():
    """Get all service types"""
    return {"services": SERVICE_PACKAGES}

@app.post("/api/bookings")
async def create_booking(booking: BookingRequest):
    """Create a new booking"""
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/checkout/session")
async def create_checkout_session(payment: PaymentRequest, request: Request):
    """Create Stripe checkout session for booking payment"""
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    """Get payment status for a checkout session"""
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/bookings/{booking_id}")
async def get_booking(booking_id: str):
    """Get booking details"""
    booking = bookings_collection.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

# Initialize sample data on startup
@app.on_event("startup")
async def startup_event():
    init_sample_cleaners()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)