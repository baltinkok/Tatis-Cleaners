from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from auth_handler import auth_handler
from auth_models import UserRole
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    try:
        payload = auth_handler.decode_token(credentials.credentials)
        user_id = payload.get('sub')
        email = payload.get('email')
        role = payload.get('role')
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        return {
            'user_id': user_id,
            'email': email,
            'role': role
        }
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

def require_roles(allowed_roles: List[UserRole]):
    """Decorator to require specific roles"""
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user['role'] not in [role.value for role in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[role.value for role in allowed_roles]}"
            )
        return current_user
    return role_checker

# Convenience decorators
require_customer = require_roles([UserRole.CUSTOMER, UserRole.ADMIN])
require_cleaner = require_roles([UserRole.CLEANER, UserRole.ADMIN])  
require_admin = require_roles([UserRole.ADMIN])
require_any_auth = require_roles([UserRole.CUSTOMER, UserRole.CLEANER, UserRole.ADMIN])