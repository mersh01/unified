from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, JSON, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

# Database configuration - using SQLite for simplicity (no PostgreSQL needed)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./document_system.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(String, unique=True, index=True, nullable=False)
    service_type = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    user_name = Column(String, nullable=False)
    user_email = Column(String, nullable=False)
    user_phone = Column(String, nullable=True)
    form_data = Column(JSON, nullable=False)
    uploaded_files = Column(JSON, default=dict)
    multi_step_data = Column(JSON, default=dict)
    current_state = Column(String, default="SUBMITTED")
    status = Column(String, default="PENDING")
    fee_amount = Column(Float, default=0)
    fee_paid = Column(Boolean, default=False)
    payment_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    tracking_id = Column(String, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    history = Column(JSON, default=list)
    # Hierarchy scope
    hierarchy_country = Column(String, nullable=True)
    hierarchy_region = Column(String, nullable=True)
    hierarchy_zone = Column(String, nullable=True)
    hierarchy_woreda = Column(String, nullable=True)
    hierarchy_kebele = Column(String, nullable=True)
    service_level = Column(String, nullable=True)
    responsible_hierarchy = Column(String, nullable=True)
    department = Column(String, nullable=True)

class DocumentConfig(Base):
    __tablename__ = "document_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    document_type = Column(String, unique=True, index=True, nullable=False)
    config = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(String, index=True)
    action = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    old_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserHierarchy(Base):
    __tablename__ = "user_hierarchy"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, nullable=False)
    department = Column(String, nullable=False)
    hierarchy_country = Column(String, nullable=False, default="IND")
    hierarchy_region = Column(String, nullable=True)
    hierarchy_zone = Column(String, nullable=True)
    hierarchy_level = Column(String, nullable=False)  # "country", "region", "zone"
    can_access_higher_levels = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()