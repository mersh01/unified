# Workflow System Guide

## Overview
The document system uses a config-driven workflow engine that supports multiple service types with different complexity levels. This document explains how the system handles various services and how to add new services with complex workflows.

## Current Services

### Service Level Mapping
Services are organized by hierarchy level:
- **Country Level**: passport_renewal, pan_card_reprint
- **Region Level**: (none currently)
- **Zone Level**: tenth_grade_certificate, driver_license_renewal, police_clearance
- **Woreda Level**: birth_certificate, eighth_grade_certificate, business_license
- **Kebele Level**: land_registration, complaint_submission

### Service to Workflow Mapping
Each service is mapped to a specific workflow:
- `birth_certificate` → standard_document_workflow
- `tenth_grade_certificate` → standard_document_workflow
- `eighth_grade_certificate` → standard_document_workflow
- `passport_renewal` → national_service_workflow
- `pan_card_reprint` → national_service_workflow
- `driver_license_renewal` → standard_document_workflow
- `business_license` → standard_document_workflow
- `land_registration` → local_service_workflow
- `police_clearance` → standard_document_workflow
- `complaint_submission` → complaint_workflow

## Current Workflows

### 1. Standard Document Workflow
**Complexity**: High
**States**: SUBMITTED → VERIFICATION → DOCUMENT_VERIFICATION → PAYMENT_PENDING → PAYMENT_COMPLETED → CERTIFICATE_GENERATED → COMPLETED
**Features**:
- Multi-stage verification process
- Document verification step
- Payment processing
- Certificate generation and dispatch
- Appeal mechanism from rejected state

**Used by**: birth_certificate, tenth_grade_certificate, eighth_grade_certificate, driver_license_renewal, business_license, police_clearance

### 2. National Service Workflow
**Complexity**: Medium
**States**: SUBMITTED → VERIFICATION → PAYMENT_PENDING → PAYMENT_COMPLETED → COMPLETED
**Features**:
- Simplified verification (single stage)
- Payment processing
- Appeal mechanism
- Country-level only

**Used by**: passport_renewal, pan_card_reprint

### 3. Local Service Workflow
**Complexity**: Low
**States**: SUBMITTED → VERIFICATION → COMPLETED
**Features**:
- Single verification stage
- Site visit capability
- Appeal mechanism
- Kebele/Woreda level

**Used by**: land_registration

### 4. Complaint Workflow
**Complexity**: Medium
**States**: SUBMITTED → ASSIGNED → RESOLVED → COMPLETED
**Features**:
- GRO to LME assignment
- Resolution with citizen rating
- Reopen mechanism
- Custom actions (ASSIGN_TO_LME, RESOLVE, REASSIGN)

**Used by**: complaint_submission

## System Capabilities

### 1. Config-Driven Architecture
- Workflows defined in JSON files (`config/workflows.json`)
- Service mapping in `config/services.json`
- Database override capability (can load workflows from `workflow_definitions` table)
- Runtime configuration changes without code deployment

### 2. Permission-Based Access Control
- Granular permission checking for each action
- State-level permission requirements
- Role-based access control
- Action-specific permission mappings

**Supported Permissions**:
- verify_applications
- verify_documents
- assign_complaints
- resolve_complaints
- reassign_complaints
- reject_complaints
- process_payments
- issue_certificates
- dispatch_certificates
- appeal_decision
- rate_service
- reopen_complaint
- cancel_applications
- process_applications

### 3. Hierarchy-Based Access Control
- Service level restrictions (country, region, zone, woreda, kebele)
- Geographic matching for application access
- Higher-level users can see lower-level applications
- LME role special handling for region-level visibility

### 4. Action Definitions
Actions can have:
- Display labels
- Required payload fields (textarea, text, rating, number)
- Field validation (required, min, max)
- Assignable actions (can assign to specific users)

### 5. State Transitions
- Deterministic state transitions based on actions
- Support for loops (e.g., REQUEST_INFO → VERIFICATION)
- Support for branching (multiple actions leading to different states)
- End states (COMPLETED, REJECTED)

### 6. Notifications
- State-based notification triggers
- Citizen notifications for state changes
- Assignment notifications for staff
- In-app notifications with application tracking

## Adding New Services

### Step 1: Define Service in services.json
```json
{
  "service_level_mapping": {
    "your_new_service": {
      "level": "zone",
      "description": "Description of your service",
      "responsible_hierarchy": ["zone", "region", "country"]
    }
  }
}
```

### Step 2: Choose or Create Workflow
You can either:
- Use an existing workflow (standard_document_workflow, national_service_workflow, local_service_workflow)
- Create a new custom workflow

### Step 3: Add Workflow to workflows.json (if creating new)
```json
{
  "workflows": {
    "your_custom_workflow": {
      "name": "Your Custom Workflow",
      "states": {
        "SUBMITTED": {
          "type": "start",
          "display_name": "Submitted",
          "color": "#f59e0b",
          "assigned_role": "verification_officer",
          "allowed_permissions": ["verify_applications"],
          "actions": ["PROCESS", "REJECT"],
          "next_states": {
            "PROCESS": "VERIFICATION",
            "REJECT": "REJECTED"
          },
          "allowed_hierarchy_levels": ["zone", "woreda", "kebele"]
        },
        // Add more states as needed...
      }
    }
  }
}
```

### Step 4: Map Service to Workflow
```json
{
  "service_to_workflow_mapping": {
    "your_new_service": "your_custom_workflow"
  }
}
```

### Step 5: Define Action Definitions (if using custom actions)
```json
{
  "action_definitions": {
    "YOUR_CUSTOM_ACTION": {
      "display_label": "Your Custom Action",
      "requires_payload": true,
      "fields": [
        {"name": "field_name", "type": "textarea", "label": "Field Label", "required": true}
      ]
    }
  }
}
```

### Step 6: Update Action Permission Map (in workflow_engine.py)
Add your custom action to the `action_permission_map`:
```python
action_permission_map = {
    # ... existing mappings ...
    'YOUR_CUSTOM_ACTION': 'your_custom_permission',
}
```

### Step 7: Add Permission to Roles (in config/roles.json)
```json
{
  "roles": {
    "your_role": {
      "permissions": ["your_custom_permission"]
    }
  }
}
```

## Complex Workflow Support

The system supports complex workflows with:

### 1. Multiple Parallel Paths
States can have multiple actions leading to different states:
```json
"actions": ["APPROVE", "REJECT", "REQUEST_INFO"],
"next_states": {
  "APPROVE": "NEXT_STATE_A",
  "REJECT": "REJECTED",
  "REQUEST_INFO": "CURRENT_STATE"
}
```

### 2. Conditional Transitions
While not natively supported in JSON, you can implement conditional logic in the backend by extending the workflow engine.

### 3. Parallel Processing
The system supports multiple users working on different applications simultaneously.

### 4. State History
All state transitions are tracked in the application history with:
- Timestamp
- Actor information
- Comments
- Payload data

### 5. SLA Tracking
Workflows can define SLA days for specific states:
```json
"sla_days": {
  "VERIFICATION": 3,
  "DOCUMENT_VERIFICATION": 5
}
```

## Testing New Services

1. **Create Test Application**: Submit an application for the new service
2. **Verify Workflow**: Check that state transitions work correctly
3. **Test Permissions**: Verify users can only perform actions they have permissions for
4. **Test Hierarchy**: Ensure hierarchy restrictions work as expected
5. **Test Notifications**: Verify notifications are sent at appropriate states
6. **Test Assignment**: If workflow includes assignment, test user assignment

## Database Override

The system supports loading workflows from the database instead of JSON files:

1. Insert workflow into `workflow_definitions` table:
```sql
INSERT INTO workflow_definitions (workflow_name, definition, is_active)
VALUES ('your_workflow', '{...json definition...}', true);
```

2. Insert service mapping into `app_settings`:
```sql
INSERT INTO app_settings (key, value)
VALUES ('service_level_mapping', '{...json...}');
```

3. Reload workflow engine (automatic on next request)

## Limitations and Considerations

1. **Action Permission Mapping**: Currently hardcoded in workflow_engine.py. Consider moving to config for full flexibility.
2. **Conditional Logic**: Complex conditional transitions require backend code changes.
3. **Parallel State Machines**: Not supported (each application follows a single workflow).
4. **Dynamic Workflows**: Cannot change workflow for an existing application once created.

## Best Practices

1. **Reuse Existing Workflows**: When possible, use existing workflows to reduce complexity.
2. **Clear State Names**: Use descriptive state names that make the process clear.
3. **Permission Granularity**: Use fine-grained permissions for better security.
4. **Hierarchy Alignment**: Ensure service levels match organizational hierarchy.
5. **Testing**: Thoroughly test new workflows before production deployment.
6. **Documentation**: Document custom workflows for future maintainers.

## Conclusion

The workflow system is highly flexible and can handle:
- Multiple service types at different hierarchy levels
- Complex multi-stage workflows
- Permission-based access control
- Hierarchy-based visibility
- Custom actions with payload fields
- Database-driven configuration

To add a new service, follow the steps outlined above. The system is designed to be extensible without requiring code changes for most use cases.
