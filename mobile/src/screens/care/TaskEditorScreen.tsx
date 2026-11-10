import React from 'react';import {EntityForm} from '../shared/EntityForm';import {isoFromLocal} from '../../lib/utils/date';
export default function TaskEditorScreen(){return <EntityForm title="New care task" subtitle="Schedule an individual care occurrence. Recurrence is recorded for future scheduling." path="/pets/:petId/tasks" fields={[
{name:'title',label:'Task title',required:true,placeholder:'Evening feeding'},
{name:'type',label:'Task type',required:true,placeholder:'FEEDING, GROOMING, MEDICATION'},
{name:'dueAt',label:'Due at (ISO local)',required:true,placeholder:'2026-11-10T20:00'},
{name:'recurrenceRule',label:'Recurrence rule',placeholder:'Optional, e.g. FREQ=DAILY'}]}
 mapValues={v=>({title:v.title,type:v.type.toUpperCase(),dueAt:isoFromLocal(v.dueAt),recurrenceRule:v.recurrenceRule||null})}/>}
