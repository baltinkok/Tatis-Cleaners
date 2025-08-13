#!/usr/bin/env python3
"""
Production startup script for Tati's Cleaners backend
Handles database initialization and health checks before starting the server
"""

import os
import sys
import time
import logging
from pymongo import MongoClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_mongodb_connection():
    """Check MongoDB connection and wait for it to be available"""
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    max_retries = 10
    retry_delay = 5
    
    logger.info("Checking MongoDB connection...")
    
    for attempt in range(max_retries):
        try:
            # Atlas-optimized connection settings
            client_options = {
                'serverSelectionTimeoutMS': 10000,
                'connectTimeoutMS': 10000,
                'socketTimeoutMS': 10000,
                'retryWrites': True,
                'retryReads': True,
            }
            
            # Additional settings for Atlas
            if 'mongodb+srv' in mongo_url:
                client_options.update({
                    'ssl': True,
                    'authSource': 'admin'
                })
            
            client = MongoClient(mongo_url, **client_options)
            client.admin.command('ping')
            
            logger.info("✅ MongoDB connection successful")
            client.close()
            return True
            
        except Exception as e:
            logger.warning(f"MongoDB connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error("❌ MongoDB connection failed after all retries")
                return False
    
    return False

def check_required_env_vars():
    """Check that all required environment variables are set"""
    required_vars = [
        'MONGO_URL',
        'DB_NAME'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        return False
    
    logger.info("✅ All required environment variables are set")
    return True

def main():
    """Main startup function"""
    logger.info("🚀 Starting Tati's Cleaners backend startup checks...")
    
    # Check environment variables
    if not check_required_env_vars():
        sys.exit(1)
    
    # Check MongoDB connection
    if not check_mongodb_connection():
        sys.exit(1)
    
    logger.info("✅ All startup checks passed - ready to start server")
    return True

if __name__ == "__main__":
    main()