import React from 'react';import {ResourceDetail} from '../shared/ResourceDetail';
export default function LostReportDetailsScreen(){return <ResourceDetail title="Lost / found report" path="/lost-found/:id" publicData actions={[{label:'Report a sighting or claim',route:'Sighting'}]} description="Only general areas are public. Identity evidence and exact locations remain private."/>;}
