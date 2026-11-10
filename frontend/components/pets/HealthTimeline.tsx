import type {Row} from '@/lib/types/domain';
import {str,field} from '@/lib/types/domain';
import {formatDate} from '@/lib/utils/currency';
import {EmptyState} from '@/components/ui/EmptyState';
import {medicalKind} from '@/lib/medical/records';

const LABELS={VACCINE:'Vaccination',MEDICATION:'Medication',APPOINTMENT:'Veterinary visit'} as const;

export function HealthTimeline({items}:{items:Row[]}){
 if(!items.length)return <EmptyState title="No health records yet" description="Vaccinations, medications, and veterinary visits will appear here."/>;
 return <ol className="timeline medical-timeline">{items.map((record,index)=>{
  const kind=medicalKind(record);
  const nextDue=field(record,'nextDueAt');
  const end=field(record,'endAt');
  const dosage=str(record,'dosageText');
  const eventId=str(record,'id');
  return <li key={`${kind??'OTHER'}-${eventId||index}`}>
   <div className="timeline-mark" aria-hidden="true"/>
   <div className="medical-timeline-content">
    <span className="eyebrow">{kind?LABELS[kind]:'Medical event'}</span>
    <h4>{str(record,'title','name','vaccineName','medicationName','description')||'Health activity'}</h4>
    <p>{formatDate(field(record,'occurredAt','eventAt','administeredAt','date','createdAt'))}</p>
    {kind==='VACCINE'&&nextDue?<p className="medical-record-detail"><strong>Next dose:</strong> {formatDate(nextDue)}</p>:null}
    {kind==='MEDICATION'&&dosage?<p className="medical-record-detail"><strong>Recorded dosage:</strong> {dosage}</p>:null}
    {kind==='MEDICATION'&&end?<p className="medical-record-detail"><strong>End date:</strong> {formatDate(end)}</p>:null}
   </div>
  </li>;
 })}</ol>;
}
