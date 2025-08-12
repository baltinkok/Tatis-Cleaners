import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
import os

class AuthHandler:
    def __init__(self):
        self.secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 60 * 24  # 24 hours

    def encode_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def verify_password(self, password: str, encoded_password: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), encoded_password.encode('utf-8'))

    def encode_token(self, user_id: str, email: str, role: str) -> str:
        """Generate JWT token"""
        payload = {
            'exp': datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes),
            'iat': datetime.utcnow(),
            'sub': user_id,
            'email': email,
            'role': role
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def decode_token(self, token: str) -> Dict[str, Any]:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

auth_handler = AuthHandler()