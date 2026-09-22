export type PatientStatus = 'lead' | 'active' | 'lapsed' | 'dormant';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type CommunicationType = 'email' | 'sms' | 'review_request';
export type CommunicationDirection = 'inbound' | 'outbound';
export type Intent = 'booking_request' | 'post_op_complication' | 'review_response' | 'general' | 'spam';
export type Urgency = 'low' | 'medium' | 'high';

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  last_visit_date: string | null;
  status: PatientStatus;
  source?: string;
}

export interface Appointment {
  id: number;
  patient_id: number;
  date: string;
  procedure_type: string;
  status: AppointmentStatus;
}

export interface Communication {
  id: number;
  patient_id: number;
  type: CommunicationType;
  direction: CommunicationDirection;
  content: string;
  intent?: string;
  urgency?: Urgency;
  timestamp: string;
}

export interface Campaign {
  id: number;
  name: string;
  trigger_event: string;
  template_body: string;
  is_active?: boolean;
}

export interface ParsedIntent {
  intent: Intent;
  urgency: Urgency;
  patient_email?: string;
  summary: string;
  suggested_action: string;
}
