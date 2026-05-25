from typing import Dict, Any, Optional
from datetime import datetime

class NotificationService:
    """Notification service for sending alerts"""
    
    def __init__(self):
        self.notifications_log = []
    
    def _create_db_notification(self, user_id: str, title: str, message: str, notif_type: str, app_id: Optional[str] = None) -> bool:
        """Insert a notification record into the Supabase database"""
        from .supabase_client import supabase
        
        try:
            data = {
                "user_id": user_id,
                "title": title,
                "message": message,
                "type": notif_type,
                "related_application_id": app_id,
                "is_read": False,
                "created_at": datetime.now().isoformat()
            }
            supabase.table("notifications").insert(data).execute()
            return True
        except Exception as e:
            print(f"Error creating notification in DB: {e}")
            return False

    def _send_sms_notification(self, phone_number: str, message: str) -> bool:
        """
        Placeholder for sending an SMS notification.
        In the future, integrate with an SMS gateway (e.g., Twilio, AWS SNS) here.
        """
        print(f"📱 SMS Notification to {phone_number}: {message}")
        return True

    def _get_val(self, obj: Any, key: str, default: Any = None) -> Any:
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    def send_application_submitted(self, application) -> bool:
        """Send notification for application submission"""
        # Get document type from service_type or document_type (for compatibility)
        doc_type = self._get_val(application, 'service_type') or self._get_val(application, 'document_type', 'Unknown')
        app_id = self._get_val(application, 'application_id', 'Unknown')
        user_id = self._get_val(application, 'user_id')
        user_phone = self._get_val(application, 'user_phone')
        
        message = f"Your application for {doc_type} has been submitted successfully. ID: {app_id}"
        
        # In-App Notification
        if user_id:
            self._create_db_notification(user_id, "Application Submitted", message, "SUBMISSION", app_id)
        
        # SMS Notification
        if user_phone:
            self._send_sms_notification(user_phone, message)
            
        return self._send_notification(self._get_val(application, 'user_email', 'Unknown'), "Application Submitted", message)
    
    def send_status_update(self, application, comment: str = "") -> bool:
        """Send notification for status change"""
        app_id = self._get_val(application, 'application_id', 'Unknown')
        user_id = self._get_val(application, 'user_id')
        user_phone = self._get_val(application, 'user_phone')
        new_status = self._get_val(application, 'current_state', 'Unknown')
        
        message = f"Status updated to {new_status} for application {app_id}."
        if comment:
            message += f" Comment: {comment}"
            
        # In-App Notification
        if user_id:
            self._create_db_notification(user_id, f"Status Update - {app_id}", message, "STATUS_UPDATE", app_id)
            
        # SMS Notification
        if user_phone:
            self._send_sms_notification(user_phone, message)
            
        return self._send_notification(self._get_val(application, 'user_email', 'Unknown'), f"Status Update - {app_id}", message)
    
    def send_assignment_notification(self, application, assignee_id: str) -> bool:
        """Send notification to an employee when an application is assigned to them"""
        doc_type = self._get_val(application, 'service_type') or self._get_val(application, 'document_type', 'Unknown')
        app_id = self._get_val(application, 'application_id', 'Unknown')
        
        message = f"You have been assigned a new application: {app_id} ({doc_type})."
        
        # In-App Notification (No SMS needed for employees typically, but can be added)
        if assignee_id:
            self._create_db_notification(assignee_id, "New Assignment", message, "ASSIGNMENT", app_id)
            
        return True

    def send_payment_reminder(self, application) -> bool:
        """Send payment reminder notification"""
        app_id = self._get_val(application, 'application_id', 'Unknown')
        fee = self._get_val(application, 'fee_amount', 0)
        message = f"Payment Reminder: Please complete the payment of ₹{fee} for your application {app_id}."
        
        user_id = self._get_val(application, 'user_id')
        user_phone = self._get_val(application, 'user_phone')
        
        if user_id:
            self._create_db_notification(user_id, f"Payment Reminder - {app_id}", message, "PAYMENT", app_id)
        if user_phone:
            self._send_sms_notification(user_phone, message)
            
        return self._send_notification(self._get_val(application, 'user_email', 'Unknown'), f"Payment Reminder - {app_id}", message)
    
    def send_payment_received(self, application) -> bool:
        """Send payment received/confirmation notification"""
        app_id = self._get_val(application, 'application_id', 'Unknown')
        fee = self._get_val(application, 'fee_amount', 0)
        message = f"Payment Received! We have received your payment of ₹{fee} for application {app_id}. Your application is now ready for processing."
        
        user_id = self._get_val(application, 'user_id')
        user_phone = self._get_val(application, 'user_phone')
        
        if user_id:
            self._create_db_notification(user_id, f"Payment Confirmed - {app_id}", message, "PAYMENT_CONFIRMED", app_id)
        if user_phone:
            self._send_sms_notification(user_phone, message)
            
        return self._send_notification(self._get_val(application, 'user_email', 'Unknown'), f"Payment Confirmed - {app_id}", message)
    
    def send_completion_notification(self, application, tracking_id: str) -> bool:
        """Send completion notification"""
        app_id = self._get_val(application, 'application_id', 'Unknown')
        message = f"Application Completed! Your tracking ID is {tracking_id} for application {app_id}."
        
        user_id = self._get_val(application, 'user_id')
        user_phone = self._get_val(application, 'user_phone')
        
        if user_id:
            self._create_db_notification(user_id, f"Application Completed - {app_id}", message, "COMPLETION", app_id)
        if user_phone:
            self._send_sms_notification(user_phone, message)
            
        return self._send_notification(self._get_val(application, 'user_email', 'Unknown'), f"Application Completed - {app_id}", message)
    
    def send_rejection_notification(self, application, reason: str) -> bool:
        """Send rejection notification"""
        app_id = self._get_val(application, 'application_id', 'Unknown')
        message = f"Your application {app_id} has been rejected. Reason: {reason}"
        
        user_id = self._get_val(application, 'user_id')
        user_phone = self._get_val(application, 'user_phone')
        
        if user_id:
            self._create_db_notification(user_id, f"Application Update - {app_id}", message, "REJECTION", app_id)
        if user_phone:
            self._send_sms_notification(user_phone, message)
            
        return self._send_notification(self._get_val(application, 'user_email', 'Unknown'), f"Application Update - {app_id}", message)
    
    def _send_notification(self, email: str, subject: str, message: str) -> bool:
        """Send notification (console logging for now)"""
        print("\n" + "="*60)
        print(f"📧 NOTIFICATION")
        print(f"To: {email}")
        print(f"Subject: {subject}")
        print("="*60)
        print(message)
        print("="*60 + "\n")
        
        # Log to list for auditing
        self.notifications_log.append({
            "timestamp": datetime.now().isoformat(),
            "email": email,
            "subject": subject,
            "message": message[:200]  # Truncate for log
        })
        
        return True