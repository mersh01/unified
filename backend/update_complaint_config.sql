-- Update complaint_submission service configuration to include map selection
-- Run this in Supabase SQL Editor

UPDATE service_definitions 
SET config = '{
  "category": "citizen_services",
  "name": "Submit Complaint",
  "description": "Lodge a formal complaint about government services or public infrastructure",
  "fee_amount": 0,
  "processing_time_days": 5,
  "workflow": "complaint_workflow",
  "multi_step": {
    "enabled": true,
    "auto_save": true,
    "allow_step_navigation": true,
    "save_progress_key": "complaint_draft"
  },
  "steps": [
    {
      "id": "complaint_type",
      "order": 1,
      "step_key": "step_1_complaint_type",
      "icon": "⚠️",
      "title": "Complaint Category",
      "description": "Select the type and subtype of your complaint",
      "fields": [
        {
          "name": "complaint_type",
          "type": "select",
          "required": true,
          "label": "Complaint Type",
          "options": [
            "service_delivery",
            "infrastructure",
            "corruption",
            "staff_conduct",
            "environmental",
            "healthcare",
            "education",
            "security",
            "other"
          ],
          "help_text": "Choose the main category of your complaint"
        },
        {
          "name": "complaint_subtype",
          "type": "select",
          "required": true,
          "label": "Complaint Subtype",
          "conditional_on": "complaint_type",
          "conditional_options": {
            "service_delivery": [
              "delayed_service",
              "poor_quality",
              "staff_unavailable",
              "missing_documentation"
            ],
            "infrastructure": [
              "road_damage",
              "water_issue",
              "electricity_problem",
              "waste_management"
            ],
            "corruption": [
              "bribery_demand",
              "unfair_process",
              "favoritism",
              "misuse_of_power"
            ],
            "staff_conduct": [
              "rude_behavior",
              "discrimination",
              "harassment",
              "unprofessional"
            ],
            "environmental": [
              "pollution",
              "illegal_dumping",
              "deforestation",
              "water_contamination"
            ],
            "healthcare": [
              "poor_service",
              "medication_shortage",
              "staff_neglect",
              "unhygienic_conditions"
            ],
            "education": [
              "poor_teaching",
              "inadequate_facilities",
              "staff_absence",
              "fee_issue"
            ],
            "security": [
              "theft",
              "assault",
              "harassment",
              "negligence"
            ],
            "other": [
              "miscellaneous"
            ]
          },
          "help_text": "Provide more details about your complaint"
        }
      ]
    },
    {
      "id": "location_info",
      "order": 2,
      "step_key": "step_2_location_info",
      "icon": "📍",
      "title": "Location Details",
      "description": "Specify where the issue occurred",
      "fields": [
        {
          "name": "landmark",
          "type": "text",
          "required": true,
          "label": "Landmark or Address",
          "placeholder": "e.g., Near Main Market, Kebele 5 Office, Next to School",
          "validation": {
            "min_length": 5,
            "max_length": 200
          },
          "help_text": "Describe the location using nearby landmarks or address"
        },
        {
          "name": "region",
          "type": "hierarchical_dropdown",
          "required": true,
          "label": "Region",
          "depends_on": null,
          "source": "regions",
          "hierarchy_level": 1
        },
        {
          "name": "zone",
          "type": "hierarchical_dropdown",
          "required": true,
          "label": "Zone",
          "depends_on": "region",
          "source": "zones",
          "hierarchy_level": 2
        },
        {
          "name": "woreda",
          "type": "hierarchical_dropdown",
          "required": true,
          "label": "Woreda",
          "depends_on": "zone",
          "source": "woredas",
          "hierarchy_level": 3
        },
        {
          "name": "kebele",
          "type": "hierarchical_dropdown",
          "required": false,
          "label": "Kebele",
          "depends_on": "woreda",
          "source": "kebeles",
          "hierarchy_level": 4
        }
      ]
    },
    {
      "id": "complaint_map",
      "order": 3,
      "step_key": "step_3_complaint_map",
      "icon": "🗺️",
      "title": "Complaint Location on Map",
      "description": "Pin the complaint location on the map. Initial position is Addis Ababa.",
      "fields": [
        {
          "name": "complaint_location",
          "type": "map",
          "required": true,
          "label": "Complaint Location",
          "placeholder": "9.03, 38.74",
          "default_value": "9.03,38.74",
          "help_text": "Provide the coordinates for the complaint location or use the map preview."
        }
      ]
    },
    {
      "id": "complaint_details",
      "order": 4,
      "step_key": "step_4_complaint_details",
      "icon": "📝",
      "title": "Complaint Description",
      "description": "Provide detailed information about your complaint",
      "fields": [
        {
          "name": "incident_date",
          "type": "date",
          "required": true,
          "label": "Date of Incident",
          "validation": {
            "type": "date",
            "max_future_days": 0,
            "min_days_ago": 365
          },
          "help_text": "When did this issue occur?"
        },
        {
          "name": "description",
          "type": "textarea",
          "required": true,
          "label": "Detailed Description",
          "placeholder": "Please provide a detailed account of the issue, including what happened, who was involved, and the impact",
          "rows": 6,
          "validation": {
            "min_length": 20,
            "max_length": 2000
          },
          "help_text": "Be as specific as possible to help us investigate"
        }
      ]
    },
    {
      "id": "document_upload",
      "order": 5,
      "step_key": "step_5_document_upload",
      "icon": "📎",
      "title": "Supporting Documents",
      "description": "Upload any documents to support your complaint (optional)",
      "fields": [
        {
          "name": "supporting_documents",
          "type": "file",
          "required": false,
          "label": "Supporting Documents",
          "help_text": "Upload photos, receipts, correspondence, or other relevant documents",
          "multiple": true,
          "accepted_formats": [
            "pdf",
            "jpg",
            "png",
            "jpeg",
            "doc",
            "docx",
            "xls",
            "xlsx"
          ],
          "max_size_mb": 5,
          "max_files": 5
        },
        {
          "name": "photo_evidence",
          "type": "file",
          "required": false,
          "label": "Photo Evidence",
          "help_text": "Upload photos showing the issue if available",
          "multiple": true,
          "accepted_formats": [
            "jpg",
            "png",
            "jpeg"
          ],
          "max_size_mb": 5,
          "max_files": 3
        }
      ]
    }
  ],
  "hierarchical_fields": {
    "region": {
      "type": "dropdown",
      "source": "regions",
      "depends_on": null
    },
    "zone": {
      "type": "dropdown",
      "source": "zones",
      "depends_on": "region"
    },
    "woreda": {
      "type": "dropdown",
      "source": "woredas",
      "depends_on": "zone"
    },
    "kebele": {
      "type": "dropdown",
      "source": "kebeles",
      "depends_on": "woreda"
    }
  }
}'::jsonb,
updated_at = NOW()
WHERE service_id = 'complaint_submission';
