import React from 'react';import {EntityForm} from '../shared/EntityForm';import {isoFromLocal} from '../../lib/utils/date';
export default function BookVisitScreen(){return <EntityForm title="Book a vet visit" subtitle="Check the veterinarian and pet IDs before scheduling. The server prevents overlapping bookings." path="/appointments" fields={[
 {name:'petId',label:'Pet ID',required:true,numeric:true},{name:'vetId',label:'Vet ID',required:true,numeric:true},
 {name:'startsAt',label:'Starts at (ISO local)',required:true,placeholder:'2026-11-10T10:00'},
 {name:'endsAt',label:'Ends at (ISO local)',required:true,placeholder:'2026-11-10T10:30'},
 {name:'reason',label:'Reason',placeholder:'Vaccination or checkup'}]}
 mapValues={v=>({petId:Number(v.petId),vetId:Number(v.vetId),startsAt:isoFromLocal(v.startsAt),endsAt:isoFromLocal(v.endsAt),reason:v.reason})}/>;
}
