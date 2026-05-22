from pydantic import BaseModel, EmailStr
from typing import Dict, Any, List, Optional
from datetime import datetime

class FormData(BaseModel):
    pass  # Dynamic form data, will be validated at runtime

class ApplicationCreate(BaseModel):
    service_type: str
    user_id: str
    user_name: str
    user_email: EmailStr
    user_phone: Optional[str] = None
    form_data: Dict[str, Any]
    uploaded_files: Optional[Dict[str, Any]] = None
    multi_step_data: Optional[Dict[str, Any]] = None

class ApplicationUpdate(BaseModel):
    action: str
    user_id: str
    comment: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

class ApplicationResponse(BaseModel):
    id: int
    application_id: str
    service_type: str
    user_id: str
    user_name: str
    user_email: str
    user_phone: Optional[str]
    form_data: Dict[str, Any]
    uploaded_files: Optional[Dict[str, Any]]
    multi_step_data: Optional[Dict[str, Any]]
    current_state: str
    status: str
    fee_amount: float
    fee_paid: bool
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime]
    completed_at: Optional[datetime]
    tracking_id: Optional[str]
    rejection_reason: Optional[str]
    history: List[Dict[str, Any]]
    hierarchy_country: Optional[str]
    hierarchy_region: Optional[str]
    hierarchy_zone: Optional[str]
    hierarchy_woreda: Optional[str]
    hierarchy_kebele: Optional[str]
    service_level: Optional[str]
    responsible_hierarchy: Optional[str]
    department: Optional[str]
    
    class Config:
        from_attributes = True

class DocumentTypeResponse(BaseModel):
    document_type: str
    name: str
    fee_amount: float
    processing_time_days: int

class StatusResponse(BaseModel):
    application_id: str
    status: str
    current_state: str
    message: Optional[str] = None

class WorkflowActionRequest(BaseModel):
    action: str
    user_id: str
    comment: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

class PaymentRequest(BaseModel):
    payment_method: str
    card_number: Optional[str] = None
    upi_id: Optional[str] = None