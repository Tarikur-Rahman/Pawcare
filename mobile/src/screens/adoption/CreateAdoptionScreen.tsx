import React from 'react';import {EntityForm} from '../shared/EntityForm';
export default function CreateAdoptionScreen(){return <EntityForm title="List for adoption" subtitle="Create a private draft for responsible review. Publishing requires moderation." path="/adoptions" fields={[
{name:'petId',label:'Your pet ID',numeric:true,required:true},{name:'title',label:'Title',required:true,placeholder:'Loving home needed'},
{name:'description',label:'Pet description & care needs',required:true,multiline:true},{name:'generalArea',label:'General area (not exact address)',required:true}]}
 mapValues={v=>({petId:Number(v.petId),title:v.title,description:v.description,generalArea:v.generalArea})} completeMessage="Draft saved. Submit it for moderation from My applications using the listing ID."/>;}
