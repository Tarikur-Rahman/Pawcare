import React from 'react';import {EntityForm} from '../shared/EntityForm';import {isoFromLocal} from '../../lib/utils/date';
export default function CreateLostReportScreen(){return <EntityForm title="Post lost / found" subtitle="Keep the location approximate to protect pets and owners." path="/lost-found" fields={[
{name:'category',label:'Category',required:true,placeholder:'LOST or FOUND'},
{name:'species',label:'Species',required:true,placeholder:'DOG or CAT'},
{name:'description',label:'Description',required:true,multiline:true},
{name:'generalArea',label:'General area',required:true},
{name:'observedAt',label:'Last seen (ISO local)',required:true,placeholder:'2026-11-10T18:00'}]}
 mapValues={v=>({category:v.category.toUpperCase(),species:v.species,description:v.description,generalArea:v.generalArea,observedAt:isoFromLocal(v.observedAt)})}
 completeMessage="Draft saved for review. Your exact location remains private."/>;}
