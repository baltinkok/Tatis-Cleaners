import os
import base64
import uuid
from typing import Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class FileUploadService:
    """Handle file uploads for cleaner applications"""
    
    def __init__(self):
        self.upload_dir = Path("/app/uploads")
        self.upload_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        (self.upload_dir / "documents").mkdir(exist_ok=True)
        (self.upload_dir / "temp").mkdir(exist_ok=True)
    
    async def save_document(self, file_data: str, file_name: str, application_id: str, document_type: str) -> Dict[str, Any]:
        """Save uploaded document"""
        try:
            # Decode base64 file data
            file_bytes = base64.b64decode(file_data)
            
            # Generate unique filename
            file_extension = Path(file_name).suffix
            unique_filename = f"{application_id}_{document_type}_{uuid.uuid4()}{file_extension}"
            
            # Save file
            file_path = self.upload_dir / "documents" / unique_filename
            with open(file_path, "wb") as f:
                f.write(file_bytes)
            
            logger.info(f"Document saved: {unique_filename}")
            
            return {
                'file_id': str(uuid.uuid4()),
                'original_name': file_name,
                'stored_name': unique_filename,
                'file_path': str(file_path),
                'file_size': len(file_bytes),
                'document_type': document_type,
                'upload_timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"File upload error: {e}")
            raise Exception(f"Failed to upload document: {str(e)}")
    
    async def get_document(self, file_path: str) -> bytes:
        """Retrieve document by file path"""
        try:
            with open(file_path, "rb") as f:
                return f.read()
        except Exception as e:
            logger.error(f"File retrieval error: {e}")
            raise Exception(f"Failed to retrieve document: {str(e)}")
    
    async def delete_document(self, file_path: str) -> bool:
        """Delete document"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Document deleted: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"File deletion error: {e}")
            return False

# Global instance
file_upload_service = FileUploadService()